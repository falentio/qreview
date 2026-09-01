# URL Expander API Alternatives

**Research date:** 2026-09-02
**Scope:** Evaluate URL expansion and redirect-chain APIs for the QR application, with emphasis on resolving Google Maps short links during administrative setup. The comparison covers API shape, ongoing free usage, authentication, rate-limit scope, redirect-chain support, latency and timeout behavior, safety controls, and backend suitability.

## Decision Summary

The application currently needs to follow a constrained Google Maps short URL, validate the resulting Google Maps URL, and persist the final QR destination. It does not need to fetch page content, render JavaScript, or perform threat intelligence. The existing self-hosted redirect path is therefore the best production choice for this specific workflow.

**Recommendation:** keep the Google Maps resolver self-hosted and restricted to an explicit Google host allowlist. Use `fetch` with manual redirect handling, validate every hop, cap hop count and total time, and reject private or unexpected destinations. This avoids sending customer URLs to a third party, avoids an external quota dependency, and keeps the QR setup flow deterministic.

If the product later needs generic short-link expansion, use one of these two paths:

1. **Paid, purpose-built option:** evaluate [unshorten.app](https://unshorten.app/docs). It has a small API, structured chains, a 15-hop cap, 5-second per-hop timeout, and a 500-check/24-hour Pro quota, but the API requires a Pro key and the public documentation does not state the price or an SLA.
2. **Low-volume no-key option:** prototype against [301check.com](https://www.301check.com/en/api.html) or [Redirect Check](https://www.redirectcheck.org/api). Both return redirect chains without an API key. 301check has an explicit 5 requests per IP per 10 seconds limit; Redirect Check has no hard per-minute quota documented but only promises reasonable use, and its Terms page describes a paid API tier. Neither should be treated as an unlimited production dependency without written provider confirmation.

Do not use urlscan.io or VirusTotal as the normal URL resolver. They are scanning and threat-intelligence products, not low-latency redirect primitives. Their public limits, asynchronous behavior, visibility rules, commercial restrictions, or data model make them a poor fit for this QR setup path.

## Application Contract

The relevant application behavior is documented in the repository's existing research and implementation:

- The admin flow accepts a Google Maps URL and follows short-link redirects before extracting and validating a Google Maps feature ID ([`url.ts`](../../src/orpc-server/resource/qr/url.ts)).
- The QR service persists the raw Maps URL, Google Place ID, and canonical review URL ([`service.ts`](../../src/orpc-server/resource/qr/service.ts)).
- Public QR requests use the stored canonical destination and do not need a provider call at scan time ([`public.ts`](../../src/orpc-server/resource/qr/public.ts)).

The resolver should therefore provide:

- A synchronous server-side request for one input URL.
- The final URL after HTTP redirects.
- Preferably the ordered redirect chain and status code at each hop.
- A bounded timeout and hop limit.
- SSRF protection or enough per-hop information for the application to enforce it.
- No requirement to execute arbitrary destination page JavaScript.
- A usage model that remains acceptable for administrative setup traffic, not public scan traffic.

## Comparison Matrix

| Candidate                     | API shape and output                                                                                                                                                                                                                                                                                                              | Free ongoing usage and authentication                                                                                                                                                                                                                                                                                                                                            | Limits, safety, and operational fit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Self-hosted resolver**      | Implemented in the Worker; manual `Location` handling can return exactly the final URL and chain needed by the application.                                                                                                                                                                                                       | No provider quota or API key.                                                                                                                                                                                                                                                                                                                                                    | Best fit for Google-only input. The application owns SSRF controls, latency, retries, logging, and availability. It must validate every hop and keep the destination allowlist narrow.                                                                                                                                                                                                                                                                                                                                                          |
| **unshorten.app**             | `POST /api/v1/unshorten`; returns `finalUrl`, a structured `chain`, per-hop status and milliseconds, and heuristic security flags. Bulk endpoint accepts up to 200 URLs. ([API docs](https://unshorten.app/docs))                                                                                                                 | API requires a Pro Bearer key. Free tier is UI-only at 30 checks per 24 hours per IP; Pro is 500 checks per 24 hours per Pro key. ([API docs](https://unshorten.app/docs), [Terms](https://unshorten.app/terms))                                                                                                                                                                 | 15-hop maximum and 5-second per-hop timeout. Terms say it follows redirects and returns metadata but does not proxy, cache, or store page content. The API docs mention forbidden hosts but do not document the exact SSRF policy or a public price/SLA. ([API docs](https://unshorten.app/docs), [Terms](https://unshorten.app/terms))                                                                                                                                                                                                         |
| **301check.com**              | `POST https://www.301check.com/check.php`; returns `finalUrl`, total time, loop/max-redirect flags, and a full chain with status, headers, server IP, and TLS details. ([API docs](https://www.301check.com/en/api.html))                                                                                                         | No signup and no API key. The official API page describes it as free. ([API docs](https://www.301check.com/en/api.html))                                                                                                                                                                                                                                                         | 5 requests per 10 seconds per IP; excess returns 429. Connection timeout is 15 seconds and private/internal IPs are blocked. The per-IP rule is risky when many Worker requests share one egress identity. ([API docs](https://www.301check.com/en/api.html))                                                                                                                                                                                                                                                                                   |
| **Redirect Check**            | `POST https://www.redirectcheck.org/api/check`; accepts one URL or up to 100 and returns `final_result.final_url`, ordered redirects, status, headers, loop information, and timings. ([API docs](https://www.redirectcheck.org/api))                                                                                             | No authentication or signup. The API page says there is no hard per-minute quota currently, but asks users to observe reasonable use and not hammer the service. ([API docs](https://www.redirectcheck.org/api))                                                                                                                                                                 | Default 20 hops, 15 seconds per hop, and 60 seconds for a bulk run. It blocks private, loopback, link-local, carrier-grade NAT, and unique-local IPv6 destinations at every hop. Fetch failures are represented as HTTP 200 with `error: true`. The Terms page separately describes a paid API tier, so production pricing and entitlement need confirmation. ([API docs](https://www.redirectcheck.org/api), [Terms](https://www.redirectcheck.org/terms))                                                                                     |
| **Domainee Redirect Checker** | `GET https://api.domainee.dev/v1/tools/redirect-checker?url=...`; returns `finalUrl` and hops with status text and response time. ([API docs](https://domainee.dev/free-apis/redirect-checker))                                                                                                                                   | No API key. 30 requests per minute and 500 per day per IP. ([API docs](https://domainee.dev/free-apis/redirect-checker))                                                                                                                                                                                                                                                         | Stops at 20 hops and returns 429 with `Retry-After` when the IP quota is exceeded. The reviewed API page does not document SSRF behavior, timeout limits, commercial-use terms, or an availability guarantee. ([API docs](https://domainee.dev/free-apis/redirect-checker))                                                                                                                                                                                                                                                                     |
| **Unshorten.me**              | `GET https://unshorten.me/api/v2/unshorten?url=...`; returns `unshortened_url`, `shortened_url`, and success status. ([API docs](https://unshorten.me/api))                                                                                                                                                                       | Requires `Authorization: Token ...`. The official page says hourly limits apply to new short URLs according to subscription and that URLs already shortened by Unshorten.me are cached. It does not state a numeric free quota on the reviewed page. ([API docs](https://unshorten.me/api))                                                                                      | Final URL only; no documented redirect-chain response, hop cap, timeout, or SSRF policy on the reviewed page. The hourly limit is not stated as IP-, key-, or account-based, so its scope is undisclosed. This is usable for low-volume experiments but weak for a production contract.                                                                                                                                                                                                                                                         |
| **WhereGoes**                 | `POST /v1/route` with `X-WhereGoes-Access-Token`; follows one URL or a batch of up to 100 and returns route data. ([Overview](https://wheregoes.com/api-docs/v1/overview/), [Route](https://wheregoes.com/api-docs/v1/route/))                                                                                                    | Requires an access token. The API documentation says the API is not public and is still in a testing phase. ([User guide](https://wheregoes.com/api-docs/v1/user-guide/))                                                                                                                                                                                                        | 3 API requests per second, with a temporary 10-second block after exceeding it; no daily limit currently; monthly limit depends on the account/key. It allows up to 100 redirects, 15-second connection timeouts, and 120 seconds total. The non-public/testing status disqualifies it for a current production dependency. ([User guide](https://wheregoes.com/api-docs/v1/user-guide/))                                                                                                                                                       |
| **APIVerve URL Unshortener**  | `POST https://api.apiverve.com/v1/urlunshortener` with `X-API-Key`; returns destination, redirect count, and a structured chain. The chain is marked Premium. ([API docs](https://docs.apiverve.com/ref/urlunshortener))                                                                                                          | Requires an API key. The current pricing page lists 100 credits/month, 5 requests/minute, attribution, and non-commercial use on Free. The URL Unshortener endpoint costs 5 credits per successful call, so that is about 20 calls/month before any bonus or pricing change. ([Pricing](https://apiverve.com/pricing), [API docs](https://docs.apiverve.com/ref/urlunshortener)) | Published endpoint latency is average 1703 ms and p50 1550 ms. Paid Starter is listed at $29.99/month with 100,000 credits, commercial use, and 60 requests/minute. The endpoint documentation also says the Free plan includes 1,000 credits plus a 500-credit bonus, which conflicts with the current pricing page; this must be resolved before budgeting. ([API docs](https://docs.apiverve.com/ref/urlunshortener), [Pricing](https://apiverve.com/pricing))                                                                               |
| **Geekflare URL Redirection** | `POST https://api.geekflare.com/redirectcheck` with `x-api-key`; returns an array of hops with URL, status, and headers. The product page says it returns the final destination and full chain. ([OpenAPI](https://docs.geekflare.com/api/endpoint/url-redirect), [Product page](https://geekflare.com/redirectchecker/))         | Requires an API key. Free has 500 monthly credits, 1 request/second, and URL Redirection costs 1 credit per request. ([Pricing](https://geekflare.com/pricing/), [Credit mapping](https://docs.geekflare.com/api-credit-mapping))                                                                                                                                                | The product FAQ says it follows up to 10 redirects. It documents plan-based RPS limits and 429 responses, but the reviewed endpoint docs do not document SSRF protection or request timeout behavior. ([Product page](https://geekflare.com/redirectchecker/), [Introduction](https://docs.geekflare.com/intro))                                                                                                                                                                                                                                |
| **Oanor URL Tools API**       | `GET /url-api/v1/expand?url=...` with `x-oanor-key`; returns `final_url`, status, and a boolean `redirected`. ([API reference](https://www.oanor.com/api/url-api/llms.txt), [Endpoint](https://www.oanor.com/api/url-api/get-v1-expand))                                                                                          | Requires an API key for API use. Free is listed as 300 calls/month and 1 request/second; Basic is $7/month with 40,000 calls/month and 5 requests/second. The interactive docs offer one unauthenticated call per session through the gateway, which is not an API quota. ([API reference](https://www.oanor.com/api/url-api/llms.txt), [Terms](https://www.oanor.com/terms))    | The reviewed response is final URL only; no redirect chain, timeout, SSRF policy, or SLA is documented there. Oanor's Terms say plans and limits are provider-defined, so the exact commercial terms should be checked with the provider before adoption. ([API reference](https://www.oanor.com/api/url-api/llms.txt), [Terms](https://www.oanor.com/terms))                                                                                                                                                                                   |
| **urlscan.io**                | Submit with `POST /api/v1/scan`, wait for a scan, then retrieve the result. `data.redirects` contains the chain and `page.url` is the final primary page. ([Scanning](https://docs.urlscan.io/apis/urlscan-openapi/scanning/submitscan.md), [Result reference](https://docs.urlscan.io/pages/result-api-reference))               | API key recommended; unauthenticated requests receive only minor quotas. The Free API Only pricing table lists 5,000 public scans, 50 private scans, and 1,000 search requests. ([API introduction](https://docs.urlscan.io/pages/api-intro), [Pricing](https://api.urlscan.io/pricing/))                                                                                        | This is asynchronous browser scanning, not a low-latency resolver. The quickstart says scans take at least 30 seconds before the first result poll. Public scans are visible to anyone; private scans are deleted after a retention period. Rate limits have separate minute/hour/day windows and are scoped to a user/API key or IP for unauthenticated calls. ([Quickstart](https://docs.urlscan.io/guides/quickstart), [Visibility](https://docs.urlscan.io/pages/visibility), [Rate limits](https://docs.urlscan.io/pages/api-rate-limits)) |
| **VirusTotal URL API**        | URL objects expose `last_final_url` and `redirection_chain`; the final URL is not included in the chain because it is in `last_final_url`. ([URL object](https://docs.virustotal.com/reference/url-object))                                                                                                                       | Requires a VirusTotal Community API key. Public API is limited to 500 requests/day and 4 requests/minute. ([Public vs Premium](https://docs.virustotal.com/reference/public-vs-premium-api))                                                                                                                                                                                     | The public API must not be used in commercial products, services, or business workflows that do not contribute new files. The full `redirects_to` relationship is Premium-only. URL objects represent VirusTotal analysis data, not a guaranteed fresh one-request redirect trace. ([Public vs Premium](https://docs.virustotal.com/reference/public-vs-premium-api), [Redirect relationship](https://docs.virustotal.com/reference/url-object-redirects-to))                                                                                   |
| **CheckShortURL**             | Official site documents a browser form for expanding short URLs; no machine-readable API contract was found in the reviewed official pages. ([Official site](https://checkshorturl.com/))                                                                                                                                         | Free web service, limited to 120 requests/day. No API key or API quota basis is documented for a backend integration. ([Official site](https://checkshorturl.com/))                                                                                                                                                                                                              | Useful for manual inspection, not a backend dependency. Do not automate the web form or infer an undocumented API.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Link Unshortener**          | Official product is a macOS app with a support page and custom URL scheme, not a hosted HTTP API. ([Product page](https://underpassapp.com/LinkUnshortener/), [Support](https://underpassapp.com/LinkUnshortener/support.html))                                                                                                   | No hosted API, API key, or server quota documented.                                                                                                                                                                                                                                                                                                                              | Not compatible with an Astro/Cloudflare backend. The app's local privacy behavior does not provide a server-side integration contract.                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Abstract API**              | The official documentation index lists validation, intelligence, scraping, screenshot, and related APIs, but no URL-unshortener API. Its Web Scraping API returns page content rather than a redirect-chain result. ([Documentation index](https://docs.abstractapi.com/llms.txt), [API index](https://docs.abstractapi.com/api)) | Abstract says its APIs have free plans, but the free tiers cannot be used in commercial projects. This does not create a URL-expander option because no such API is listed. ([API index](https://docs.abstractapi.com/api))                                                                                                                                                      | Exclude from this comparison. Do not substitute the Web Scraping API for a redirect resolver: it adds content-fetching cost and behavior without a documented final-URL contract.                                                                                                                                                                                                                                                                                                                                                               |

## Candidate Analysis

### 1. Self-hosted redirect handling

This is the recommended path for the current application. The input is already intended to be a Google Maps URL, so the application can reduce SSRF risk by allowing only the Google hosts and URL forms it actually supports. It can then follow redirects manually and validate each `Location` before making the next request.

The resolver should:

- Accept only absolute `http` and `https` URLs after normalizing the user input.
- Enforce an allowlist for the initial Google short-link and Maps hosts.
- Use `redirect: "manual"` so every `Location` can be inspected before following it.
- Reject credentials, unexpected ports, private address ranges, loopback, link-local, and non-HTTP(S) schemes.
- Re-resolve and validate every redirect hop rather than validating only the first URL.
- Cap redirect hops and total elapsed time.
- Persist the final URL only after validating that it is the expected Google Maps form.
- Return a useful setup error when the chain cannot be resolved; never make QR scanning depend on this setup-time provider call.

The existing implementation already follows the principle that public QR redirects use persisted data rather than resolving a third-party URL at scan time. That keeps the external-network failure surface out of the high-volume public path.

### 2. unshorten.app

This is the cleanest purpose-built API found in the research. The response shape directly matches the desired contract: final URL, ordered hops, status codes, timings, and bounded limits. Its heuristic security flags can be useful for administration, but the provider explicitly says they are not verdicts and should not be the sole security decision. ([API docs](https://unshorten.app/docs))

The tradeoff is that there is no free API tier, the Pro key is a paid credential, the quota is only 500 checks per 24 hours, and the public docs do not state price or SLA. The service is a good candidate for a small, paid administrative workflow, not for resolving every public scan request.

### 3. 301check.com

301check is the simplest no-key integration with a conventional JSON response. It supports the common 301/302/303/307/308 redirect types and exposes the full chain. Its explicit private/internal-IP block is useful, but the API also returns server IP and TLS details that the application does not need. ([API docs](https://www.301check.com/en/api.html))

The main concern is the limit basis: 5 requests per 10 seconds per IP. A Worker deployment may concentrate many tenants and administrative users behind the same provider-visible egress identity. The service is reasonable for a low-volume prototype or operator tool, but the provider should confirm whether production SaaS use is permitted and whether a higher quota is available.

### 4. Redirect Check

Redirect Check has the richest no-key API among the candidates: single and bulk requests, chain data, loop detection, custom method and headers, metadata refresh, and an explicit per-hop SSRF block. The API also documents a structured error envelope, which is better than treating a failed fetch as a missing final URL. ([API docs](https://www.redirectcheck.org/api))

Its weakness is contractual rather than technical. The API page says no hard per-minute quota currently, but the same page asks for reasonable use and the Terms page says the service offers a paid API access tier. The privacy policy says submitted URLs may be logged for performance monitoring, caching, and debugging, and that API requests may be logged for rate limiting and billing. This makes it unsuitable as an assumed unlimited backend dependency for customer URLs without a provider agreement. ([API docs](https://www.redirectcheck.org/api), [Terms](https://www.redirectcheck.org/terms), [Privacy](https://www.redirectcheck.org/privacy))

### 5. Domainee

Domainee is a useful fallback for a bounded operator workflow because it is keyless, returns a compact final URL and hop list, and publishes numeric IP-based limits. Its 500/day allowance is more concrete than Redirect Check's reasonable-use language. ([API docs](https://domainee.dev/free-apis/redirect-checker))

However, the endpoint documentation does not state private-address blocking, timeout behavior, commercial-use terms for the diagnostic endpoint, or an SLA. It should remain a prototype or low-risk fallback until those points are confirmed.

### 6. APIVerve, Geekflare, and Oanor

These are conventional paid API products with credentials and plan quotas, but they are not equally suitable:

- APIVerve has the best documented endpoint-level latency and a structured chain, but the chain is Premium and the current Free-plan figures conflict between the endpoint docs and pricing page. Its $29.99/month Starter plan is materially more expensive than the small administrative workload likely requires. ([API docs](https://docs.apiverve.com/ref/urlunshortener), [Pricing](https://apiverve.com/pricing))
- Geekflare has a clear 500-credit free tier, one credit per redirect check, and a conventional chain response. Its 10-hop cap may be sufficient for ordinary short links, but the reviewed docs do not establish SSRF controls or timeout behavior. ([Endpoint docs](https://docs.geekflare.com/api/endpoint/url-redirect), [Pricing](https://geekflare.com/pricing/), [Product page](https://geekflare.com/redirectchecker/))
- Oanor has a low-cost free and Basic plan and a very small final-URL response. It is attractive when only the final URL is needed, but it does not document chain output, timeout behavior, or SSRF controls in the reviewed reference. The interactive one-free-call experience is not an API entitlement. ([API reference](https://www.oanor.com/api/url-api/llms.txt), [Endpoint](https://www.oanor.com/api/url-api/get-v1-expand))

These services are viable only after confirming acceptable-use rights, data handling, provider egress behavior, and failure semantics. None is a better choice than the local constrained resolver for the existing Google Maps flow.

### 7. urlscan.io and VirusTotal

Both services can expose redirect information, but they solve a different problem:

- urlscan uses a headless browser and asynchronous scan retrieval. It records page activity, cookies, resources, and other observations; it is not a simple HTTP redirect call. Public visibility can disclose submitted URLs, while private scans are subject to deletion. ([About urlscan](https://docs.urlscan.io/about), [Quickstart](https://docs.urlscan.io/guides/quickstart), [Visibility](https://docs.urlscan.io/pages/visibility))
- VirusTotal's URL object is an analysis record with a final URL and historical redirection chain. Its public API has strict quotas and commercial-use restrictions, and the complete relationship API is Premium-only. ([URL object](https://docs.virustotal.com/reference/url-object), [Public vs Premium](https://docs.virustotal.com/reference/public-vs-premium-api))

They may be useful as an optional security-analysis feature, separate from URL expansion, but they should not sit in the QR creation critical path.

## Safety and SSRF Requirements

An external resolver reduces the application's direct outbound-fetch implementation, but it does not remove the need for product-level controls:

- The service will receive the submitted URL, which may contain customer data or tracking identifiers.
- A provider's SSRF block may not cover every private range, DNS rebinding case, redirect scheme, or unusual URL parser behavior relevant to this application.
- A redirect chain can cross from a permitted host to an unrelated host, so the application must validate the final URL against its business contract.
- API responses can be syntactically valid while representing a timeout, loop, partial chain, or a login/interstitial page.
- The final URL must be treated as untrusted input until parsed and validated.
- API keys belong in server-only secrets and must never be exposed in browser code.
- Cache only after deciding whether URL query values can contain secrets or personal data.
- Log provider request IDs and normalized error classes, not raw submitted URLs by default.

Redirect Check and 301check explicitly document private/internal address blocking, but the absence of a documented control from the other providers is not proof that they are unsafe. It is a verification gap, not a safety guarantee. ([Redirect Check API](https://www.redirectcheck.org/api), [301check API](https://www.301check.com/en/api.html))

## Operational Recommendation

For the current application:

1. Keep the current local Google Maps redirect resolver.
2. Add explicit hop-by-hop validation and bounded timeout behavior if not already guaranteed by the implementation.
3. Keep provider resolution out of the public QR redirect route.
4. If generic URL expansion becomes a product feature, put it behind a provider interface and a cache keyed by normalized input URL.
5. Start provider integration tests with `unshorten.app` and `301check.com`, because their documented response contracts are closest to the required chain/final-URL shape.
6. Use Redirect Check or Domainee only for low-volume fallback or operator tooling until their production-use terms and limits are confirmed.
7. Never describe any candidate as unlimited. The closest wording found was either a reasonable-use policy, a plan-dependent limit, or a paid-plan marketing claim.

## Verification Gaps

- CheckShortURL has a documented free web limit but no reviewed official API contract.
- Link Unshortener is a macOS application, not a hosted API.
- Abstract's official API index has no URL-unshortener product; its Web Scraping API is not an equivalent.
- Unshorten.me does not state a numeric free quota, hop cap, timeout, or rate-limit identity on its reviewed API page.
- Redirect Check's API page and Terms page describe different free/paid API positioning.
- APIVerve's endpoint documentation and pricing page show conflicting Free-plan credit figures.
- Domainee, Geekflare, and Oanor do not document enough SSRF and timeout detail in the reviewed pages to treat their safety behavior as equivalent to the application's own controls.
- Provider pricing, quotas, terms, retention, and API availability can change. Recheck the linked first-party pages immediately before implementation and deployment.

## Sources

All sources below were accessed on 2026-09-02.

### Purpose-built resolvers

- [unshorten.app API docs](https://unshorten.app/docs)
- [unshorten.app Terms of Service](https://unshorten.app/terms)
- [301check API docs](https://www.301check.com/en/api.html)
- [Redirect Check API docs](https://www.redirectcheck.org/api)
- [Redirect Check Terms](https://www.redirectcheck.org/terms)
- [Redirect Check Privacy Policy](https://www.redirectcheck.org/privacy)
- [Domainee Redirect Checker API](https://domainee.dev/free-apis/redirect-checker)
- [Domainee API introduction](https://domainee.dev/docs)
- [Domainee Privacy Policy](https://domainee.dev/privacy)
- [Unshorten.me API](https://unshorten.me/api)
- [WhereGoes API overview](https://wheregoes.com/api-docs/v1/overview/)
- [WhereGoes user guide](https://wheregoes.com/api-docs/v1/user-guide/)
- [WhereGoes route endpoint](https://wheregoes.com/api-docs/v1/route/)

### Paid API platforms

- [APIVerve URL Unshortener docs](https://docs.apiverve.com/ref/urlunshortener)
- [APIVerve rate limits](https://docs.apiverve.com/rate-limits)
- [APIVerve pricing](https://apiverve.com/pricing)
- [APIVerve Terms](https://apiverve.com/terms/)
- [Geekflare URL Redirection OpenAPI](https://docs.geekflare.com/api/endpoint/url-redirect)
- [Geekflare API introduction](https://docs.geekflare.com/intro)
- [Geekflare credit mapping](https://docs.geekflare.com/api-credit-mapping)
- [Geekflare pricing](https://geekflare.com/pricing/)
- [Geekflare URL Redirection product page](https://geekflare.com/redirectchecker/)
- [Oanor URL Tools API reference](https://www.oanor.com/api/url-api/llms.txt)
- [Oanor expand endpoint](https://www.oanor.com/api/url-api/get-v1-expand)
- [Oanor Terms](https://www.oanor.com/terms)

### Security and analysis platforms

- [urlscan API introduction](https://docs.urlscan.io/pages/api-intro)
- [urlscan scan submission](https://docs.urlscan.io/apis/urlscan-openapi/scanning/submitscan.md)
- [urlscan result API reference](https://docs.urlscan.io/pages/result-api-reference)
- [urlscan quickstart](https://docs.urlscan.io/guides/quickstart)
- [urlscan API rate limits](https://docs.urlscan.io/pages/api-rate-limits)
- [urlscan visibility](https://docs.urlscan.io/pages/visibility)
- [urlscan FAQ](https://docs.urlscan.io/pages/faq)
- [urlscan pricing](https://api.urlscan.io/pricing/)
- [VirusTotal URL object](https://docs.virustotal.com/reference/url-object)
- [VirusTotal public vs premium API](https://docs.virustotal.com/reference/public-vs-premium-api)
- [VirusTotal URL `redirects_to` relationship](https://docs.virustotal.com/reference/url-object-redirects-to)
- [VirusTotal quota handling](https://docs.virustotal.com/docs/consumption-quotas-handled)

### Web tools and non-candidates

- [CheckShortURL](https://checkshorturl.com/)
- [Link Unshortener product](https://underpassapp.com/LinkUnshortener/)
- [Link Unshortener support](https://underpassapp.com/LinkUnshortener/support.html)
- [Abstract API documentation index](https://docs.abstractapi.com/llms.txt)
- [Abstract API index](https://docs.abstractapi.com/api)

## Source Caveats

- “Free” means the provider currently publishes a no-cost allowance; it does not mean unlimited, suitable for commercial use, or backed by an SLA.
- A documented IP limit is not interchangeable with a per-key or per-account limit. This report preserves the provider's stated scope and marks undisclosed scopes as undisclosed.
- Provider pages can contain marketing claims, dynamic pricing, or inconsistent figures. Conflicts are called out rather than silently reconciled.
- This is engineering research, not legal advice. Acceptable-use, privacy, data-processing, and commercial licensing decisions need confirmation for the deployment's jurisdiction and use case.
