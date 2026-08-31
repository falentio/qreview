# QR Link-Visit Analytics Research

**Research date:** 2026-08-29
**Scope:** Determine how to record useful QR link-visit analytics in this Astro application on Cloudflare Workers and D1 while preserving redirect reliability, tenant isolation, and a privacy-minimizing default.

## Decision Summary

The public QR endpoint currently resolves a slug in D1 and returns either a setup response or a `307` redirect to the stored Google review URL. Analytics must not become a prerequisite for that redirect. The endpoint sees a request, not proof that a person scanned the QR code: crawlers, link scanners, retries, browser prefetching, and other automated clients can all produce the same request.

**Recommendation:** start with privacy-minimized time-bucket aggregates in D1, written asynchronously after the redirect response is ready. Do not store raw IP addresses, cookies, device fingerprints, raw user-agent strings, or raw referrer URLs. Treat this first version as best effort if it uses `ctx.waitUntil()`. If the product requires durable counting, publish a small event to Cloudflare Queues and have a consumer update the same D1 aggregates idempotently. Do not use Workers Analytics Engine as the exact long-term source of truth because its data can be sampled and is retained for three months.

The initial product should call the metric **redirect attempts** or **link visits**, not human scans or unique visitors. A unique-visitor metric requires an identifier and creates a materially different privacy and consent decision.

## Confirmed Product Decisions

Confirmed on 2026-08-29. These decisions define the implementation scope.

- Emit one typed `QrRedirected` event for each request that resolves an active QR to the existing `307` redirect. Repeated requests count separately.
- Carry only `qrCodeId` and the event timestamp. Do not collect IP addresses, cookies, user-agent strings, referrers, country, device class, or visitor identifiers.
- Use a typed in-process event listener scheduled through the Worker execution context. Analytics is best effort and must never change the redirect response.
- Store hourly aggregate counts in D1 using UTC buckets.
- Expose a top-level analytics resource with an authenticated per-QR hourly read API and a global-admin-only cleanup mutation.
- Authorize reads with `organizationId` and `qrCodeId`. Organization admins can read owned QR history and global admins can read all history.
- Preserve analytics history when an orphan QR is claimed and when a QR is archived. Orphan history is global-admin-only until claim.
- Require an explicit UTC hour-aligned `[from, to)` range, reject ranges longer than 60 days, and return a complete zero-filled hourly series.
- Enforce the 60-day window in reads. Physical deletion is lazy and manual: a global admin deletes all stored buckets older than 60 days, and the mutation returns the deleted bucket count.
- Limit the first slice to ingestion, the read API, and the cleanup mutation. Do not add a dashboard or UI yet.

## Current Codebase

### Public redirect flow

- [`src/pages/r/[slug].ts`](../../src/pages/r/[slug].ts) exports a non-prerendered `GET` route and currently passes only `params.slug` to `qrPublicResponse`.
- [`src/orpc-server/resource/qr/public.ts`](../../src/orpc-server/resource/qr/public.ts) calls `service.resolvePublic()` and returns `200`, `307`, or `404`. All three responses use `Cache-Control: no-store`.
- [`src/orpc-server/resource/qr/service.ts`](../../src/orpc-server/resource/qr/service.ts) looks up the unique slug, rejects archived records, returns setup for incomplete records, and returns the stored `canonicalReviewUrl` for active records.
- The public path is not protected by the application admin or organization route checks. The global middleware performs a session lookup, but the route remains usable anonymously.

### Persistence and ownership

- [`src/db/schema.ts`](../../src/db/schema.ts) defines `qr_codes` with a unique slug and an index on `organization_id`.
- `organization_id` is nullable because orphan QR codes can later be claimed. A foreign-key deletion sets it to null.
- Organization authorization is enforced in [`service.ts`](../../src/orpc-server/resource/qr/service.ts) and [`implementer.ts`](../../src/orpc-server/implementer.ts), rather than by the public slug lookup.
- [`alchemy.run.ts`](../../alchemy.run.ts) binds the `DB` D1 database and KV namespaces for Places data and public QR projections; there is no Analytics Engine or Queue binding.

### Application architecture

- Resources are created through factories. The QR factory returns its repository, service, router, and public response function.
- Authenticated API composition is in [`src/orpc-server/index.ts`](../../src/orpc-server/index.ts), with contracts in `src/orpc-contract`.
- The API context currently contains `request`, `db`, `auth`, and `sessionService` ([`context.ts`](../../src/orpc-server/context.ts)).
- Astro's Cloudflare integration exposes the Cloudflare execution context as `Astro.locals.cfContext` and runtime bindings through the Cloudflare runtime. The route currently does not pass either request metadata or execution context into the QR public response helper.

## Metric Semantics

### What can be observed

The server can observe a request for a valid slug and record an attempt before or after returning the redirect. It cannot reliably observe:

- Whether a person physically scanned the printed QR code.
- Whether the client followed the `307` redirect.
- Whether a browser request came from a person rather than automation.
- Whether two requests came from the same person without using an identifier.

Suggested base metric:

```text
redirect_attempts(qr_code_id, time_bucket) += 1
```

The implementation should define whether setup, archived, unknown, and active QR requests are counted. The recommended default is to count only requests for an existing, active QR record because that is the useful customer-facing metric; separately count invalid or incomplete requests only if operational monitoring needs it.

### Useful dimensions

The default should keep dimensions coarse and bounded:

- QR record ID, resolved from the slug.
- UTC hour or day bucket.
- Optional country code from Cloudflare's `CF-IPCountry` or `request.cf.country`.
- Optional bounded device class derived from the user-agent, such as `mobile`, `tablet`, `desktop`, or `other`.
- Optional bounded request classification such as `prefetch`, `bot`, or `unknown`, treated as a heuristic rather than a fact.

Do not persist these by default:

- `CF-Connecting-IP`, `X-Forwarded-For`, or any other IP address.
- A hash of the IP address. A keyed or unkeyed hash is still a persistent identifier or pseudonym, not anonymization by itself.
- Cookies, local-storage identifiers, canvas identifiers, TLS fingerprints, or generated visitor IDs.
- The complete `User-Agent` header.
- The complete `Referer` header, which can contain paths, query values, or identifiers.
- Full request URLs or arbitrary query parameters.

Country is an estimate and can be missing or wrong. It should be treated as a coarse report dimension, not an exact location or compliance signal. If small buckets can identify a person or event, suppress, merge, or avoid exposing those buckets in the dashboard.

## Storage Models

| Model                                 | Strengths                                                                                | Costs and risks                                                                                                                         | Fit                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Raw event rows in D1                  | Exact events, replayable queries, easy audit trail                                       | One row per request, privacy exposure, retention/deletion burden, larger indexes, and D1 write contention                               | Only if event-level history is an explicit requirement and retention is short |
| D1 aggregate buckets from the request | Compact, queryable, exact integer counts for accepted writes, simple tenant-scoped reads | Synchronous writes add redirect latency; `waitUntil` is best effort; popular QR codes can hot-spot one D1 database                      | Best first model for moderate traffic                                         |
| Queue to D1 aggregate buckets         | Durable handoff, retries, decoupled redirect latency, compact final storage              | Additional binding and consumer deployment, delayed dashboards, at-least-once duplicates, idempotency required                          | Best when count durability matters                                            |
| Workers Analytics Engine              | Background write API, high-volume time-series queries, no D1 write on the redirect path  | Automatic write/read sampling, three-month retention, account-level query integration, and not suitable for reconstructing exact events | Useful for approximate high-volume analytics, not the source of truth         |

### Recommended D1 shape

The exact schema is an implementation decision, but the aggregate should be keyed by the smallest queryable scope:

```text
(qr_code_id, bucket_start, dimension_key) UNIQUE
```

The row can contain a non-negative counter and a small, fixed set of dimension values. A composite index should match the dashboard query pattern, likely `(qr_code_id, bucket_start)` and, if organization filtering is denormalized, `(organization_id, bucket_start)`. Every dashboard query must still validate organization membership and ownership through the QR record or an equivalent invariant.

An atomic upsert is required for concurrent increments. D1 processes each individual database sequentially, so a single popular QR or a single dimension bucket can become a write hot spot. If that becomes a real throughput problem, use coarser buckets, shard counters, or move ingestion through a Queue before adding complexity.

## Cloudflare Constraints

### Request metadata

Workers exposes ordinary request headers and Cloudflare-specific `request.cf` metadata. Cloudflare documents `CF-Connecting-IP` as the client IP sent from the edge to the origin, and `CF-IPCountry` as a two-letter country code when IP geolocation is enabled. Cloudflare can rewrite some headers, and client-provided values should not be treated as authoritative identity.

Cloudflare's current Workers documentation lists 128 MB isolate memory, 50 subrequests per request on Free and 10,000 on Paid, and a 30-second default CPU limit on Paid. These are not the primary analytics design constraints, but a synchronous D1 write still consumes request work and can affect redirect latency.

### `waitUntil()`

`ctx.waitUntil(promise)` allows analytics work to continue after the response is returned. It is not a durable queue: Cloudflare documents a shared maximum of 30 seconds after the response or client disconnect, after which unfinished work is canceled. An unawaited promise that is not passed to `waitUntil()` may be canceled immediately when the invocation ends.

Astro's Cloudflare adapter exposes this context as `Astro.locals.cfContext`. The current route must explicitly carry the context into the capture seam if this approach is selected.

### D1

Cloudflare currently documents these relevant D1 limits and behaviors:

- Maximum database size: 10 GB on Workers Paid and 500 MB on Workers Free.
- One D1 database is inherently single-threaded and processes queries one at a time.
- Queries are limited to 1,000 per Worker invocation on Paid and 50 on Free.
- Maximum SQL query duration is 30 seconds.
- Maximum bound parameters per query is 100.
- `batch()` executes statements sequentially and non-concurrently. The sequence is transactional and failure aborts or rolls back the sequence.
- D1 bills by rows read and written, so indexes are important for both latency and cost.

These facts favor pre-aggregated counters over an unbounded raw event table for the first version. They also mean that a single aggregate row should not be updated with a read-then-write race; use one atomic SQL operation.

### Workers Analytics Engine

Workers Analytics Engine creates a dataset from a Wrangler binding and accepts ordered blobs, doubles, and one index per data point. `writeDataPoint()` returns immediately and does not need to be awaited. Current limits include twenty blobs, twenty doubles, one index, 16 KB of blobs per data point, and 250 data points per Worker invocation.

Analytics Engine uses weighted adaptive sampling at write and query time. Queries must account for `_sample_interval`; the documentation explicitly says that individual records, exact event sequences, and unique values outside a suitable index may not be recoverable. Data is retained for three months. The current pricing page lists 10 million writes and 1 million read queries included per month on Workers Paid, with future overage prices, and 100,000 writes and 10,000 reads per day on Free; it also says billing is not currently active.

Analytics Engine is therefore a strong approximate time-series backend, but it does not satisfy an exact, customer-visible historical count requirement without product acceptance of sampling and retention limits.

### Queues

Cloudflare Queues is a buffer for asynchronous processing. A successful message write is intended not to be lost, but delivery is at least once and messages can be delivered more than once. Cloudflare recommends generating a unique message ID and using it as a database primary key or idempotency key when duplicate processing would be harmful.

For QR analytics, the event can contain a generated event ID, QR record ID, bucket, and bounded dimensions. The consumer should either deduplicate event IDs before incrementing or make the aggregate update itself idempotent through a durable event table. The latter adds storage; the former requires a bounded deduplication strategy. The choice depends on the required guarantee and retention period.

## HTTP and Browser Behavior

RFC 9110 defines `GET` as a safe method intended for read-only semantics. That does not mean every `GET` represents a human action. Servers can perform accounting and logging side effects, but clients and intermediaries are allowed to make safe requests automatically.

The HTML Standard defines speculative loading and navigational prefetching. Browsers may issue requests because of speculation rules, user-interest heuristics, or implementation-defined behavior. A prefetch request can therefore increment a server-side visit counter even when the user never navigates. Fetch Metadata, `Sec-Purpose`, and user-agent strings can be used as imperfect signals, but their absence does not prove a human navigation and their presence does not prove a QR scan.

The application should not alter the public redirect status or target based on analytics classification. If prefetch classification is important, record it as a separate bounded category and report total attempts separately from likely navigations.

## Privacy and Compliance Considerations

This is engineering research, not legal advice. The applicable analysis depends on the operator, users, jurisdictions, purpose, contract, and configuration.

The privacy-minimizing design follows these principles:

- Collect only what is needed for aggregate QR performance reporting.
- Avoid identifiers that allow cross-request or cross-site tracking.
- Aggregate as early as practical, ideally at ingestion.
- Keep dimensions bounded and suppress low-count combinations in the UI.
- Define a retention schedule and delete or anonymize data when it is no longer needed.
- Document the purpose, categories collected, recipients, retention, and objection or consent mechanism as applicable.
- Do not reuse analytics data for advertising, profiling, eligibility decisions, or cross-site tracking.

CNIL's audience-measurement guidance says consent exemption conditions include a purpose strictly limited to audience measurement, no global tracking, anonymous statistical output, and no reuse or transfer to third parties. It recommends informing users, limiting tracker lifetime, and a maximum 25-month retention period for collected information in that guidance. Those are conditions and recommendations for its stated context, not blanket authorization for every server-side analytics design.

The ICO's current storage/access guidance describes a narrow statistical-purposes exception: aggregate statistics about how a service is used, not identifying or tracking people. It requires clear information and a simple free objection mechanism when the exception applies. The ICO also states that individual-level information should not be retained longer than needed for aggregation. Its anonymisation guidance distinguishes anonymization from pseudonymization; a reversible or linkable hash is not automatically anonymous. The storage-limitation guidance requires a justified retention period and periodic deletion or anonymization.

The practical default for this application is therefore server-side aggregate counting with no client storage and no per-visitor identifier. A privacy review is still needed because request metadata, small aggregates, and the operator's ability to combine datasets can affect identifiability.

## Proposed Application Seam

The lowest-risk shape is:

1. Resolve the QR slug and determine whether it is active.
2. Build the existing `200`, `307`, or `404` response.
3. Capture only the selected bounded event fields.
4. Use `Astro.locals.cfContext.waitUntil()` for best-effort D1 aggregation, or send a Queue message when durability is required.
5. Return the existing response regardless of analytics success or failure.

The analytics code should be a separate resource-style module rather than putting request parsing and D1 writes directly into `QrService.resolvePublic()`. A likely shape is an internal analytics service and repository created by `createAnalytics()`, with an authenticated organization-scoped read router composed in `src/orpc-server/index.ts`. Public ingestion should remain an internal service call from the redirect path, not an unauthenticated public oRPC mutation.

The public response helper currently receives only `{ slug }`, and `PublicQrResponse` currently contains only the response kind and canonical URL. The implementation must decide whether the capture seam receives the resolved QR record, a small event context, or a callback. Passing the full request into the domain service would couple QR resolution to transport metadata; passing a resolved record plus a capture dependency keeps the domain and storage boundaries clearer.

## Testing Implications

- Add sociable unit tests around the analytics service and repository contract, using typed repository fixtures rather than mocking implementation details.
- Add D1 integration coverage for migrations, unique aggregate keys, atomic increments, organization-scoped reads, archive behavior, and retention deletion.
- Test that an analytics failure does not change the setup, redirect, or not-found response.
- Test that the public path does not require an authenticated session.
- Test duplicate Queue delivery or duplicate event IDs if Queue ingestion is selected.
- Test missing and malformed Cloudflare metadata, including absent country and unknown user-agent classification.
- Avoid tautological tests that only assert a helper calls another helper without verifying observable behavior.

## Questions Before Implementation

- Is the required metric a redirect attempt, a successful redirect, a destination visit, or an estimated human scan?
- Are exact counts required, or are approximate counts and three-month retention acceptable?
- Must accepted analytics events survive client disconnects and Worker restarts?
- What dimensions are required: country, device class, referrer category, language, time of day, or only total counts?
- Should setup, archived, unknown, bot, and prefetch requests be included or separated?
- What retention period and export/deletion behavior does the product require?
- Should orphan QR analytics be visible to global admins, organization admins after claim, both, or neither?
- What privacy notice, objection, consent, or jurisdiction-specific controls are required?
- What is the expected peak rate for one QR code and across the D1 database?
- Is a small amount of redirect latency acceptable for a durable Queue send, or must ingestion always be post-response?

## Assumptions

- The QR URL remains a public, server-rendered redirect with no client-side analytics script.
- The first dashboard needs aggregate time-series reporting, not an event-by-event audit log.
- No cross-site or cross-device tracking is a product requirement.
- Cloudflare is the production edge, and country metadata is optional rather than guaranteed.
- Organization authorization for analytics reads must follow the existing QR ownership model.
- The product team will make the final legal determination for each deployment jurisdiction.
- Cloudflare documentation and pricing can change; verify the linked pages again before implementation and deployment.

## Sources

All sources below were accessed on 2026-08-29.

### Cloudflare

- [Workers Request](https://developers.cloudflare.com/workers/runtime-apis/request/)
- [Workers Context and `waitUntil()`](https://developers.cloudflare.com/workers/runtime-apis/context/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-request-headers/)
- [IP geolocation](https://developers.cloudflare.com/network/ip-geolocation/)
- [D1 database Worker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
- [Workers Analytics Engine getting started](https://developers.cloudflare.com/analytics/analytics-engine/get-started/)
- [Workers Analytics Engine limits](https://developers.cloudflare.com/analytics/analytics-engine/limits/)
- [Workers Analytics Engine sampling](https://developers.cloudflare.com/analytics/analytics-engine/sampling/)
- [Workers Analytics Engine SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/)
- [Workers Analytics Engine pricing](https://developers.cloudflare.com/analytics/analytics-engine/pricing/)
- [Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/)
- [How Queues works](https://developers.cloudflare.com/queues/reference/how-queues-works/)
- [Astro Cloudflare integration: execution context and runtime](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)

### Web standards

- [RFC 9110, Section 9.2.1: Safe methods](https://www.rfc-editor.org/rfc/rfc9110#section-9.2.1)
- [HTML Standard: Speculative loading](https://html.spec.whatwg.org/multipage/speculative-loading.html)
- [HTML Standard: Link type `prefetch`](https://html.spec.whatwg.org/multipage/links.html#link-type-prefetch)
- [Fetch Standard](https://fetch.spec.whatwg.org/)

### Privacy authorities

- [CNIL: Measuring website and application audience](https://www.cnil.fr/fr/mesurer-la-frequentation-de-vos-sites-web-et-de-vos-applications)
- [CNIL: Audience measurement self-assessment PDF](https://www.cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf)
- [ICO: Storage and access technology exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/)
- [ICO: Anonymisation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-sharing/anonymisation/)
- [ICO: Storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)

## Source Caveats

- Cloudflare plan limits, pricing, retention, and Analytics Engine behavior are operational facts that should be rechecked at implementation time.
- IP geolocation is explicitly an estimate and is not suitable as the sole signal for precise or compliance-critical location decisions.
- CNIL and ICO material is guidance, not a legal determination for this product.
- The report intentionally does not claim that a request classifier can reliably distinguish human scans from automation.
