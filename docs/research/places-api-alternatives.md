# Places API Alternatives for the Google Review QR Flow

**Research date:** 2026-08-29
**Scope:** Determine whether the QR application can replace Google Places for place resolution while preserving a reliable Google review destination.

## Decision Summary

The application does not only need place search. It needs to persist a Google Place ID and a canonical Google write-review URL. The current adapter obtains those values from Google Places, and the public redirect later uses the stored URL without making a provider request ([`places.ts`](../../src/orpc-server/resource/qr/places.ts), [`service.ts`](../../src/orpc-server/resource/qr/service.ts)).

Nominatim, HERE, Mapbox, Foursquare, and Geoapify can provide place or address search, but their result identifiers belong to their own datasets. Their documented APIs do not provide a Google Place ID or Google's `writeAReviewUri`. They are therefore not drop-in replacements for the current flow.

**Recommendation:** make an owner-supplied Google Business Profile review link the preferred no-Places-API workflow. Google documents a Business Profile flow for generating a link that asks customers to leave a review ([Google Business Profile Help](https://support.google.com/business/answer/7035772?hl=en)). Keep the Google Places workflow as the automatic-resolution option when the product must verify the selected business and generate Google's canonical review URL. Do not substitute a non-Google geocoder and pretend its ID is a Google Place ID.

| Option                                                                                                                      | Identifier and review target                                                                                                                                                                    | API lookup needed                       | Fit for this application                                         |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Owner-supplied Google review link ([official instructions](https://support.google.com/business/answer/7035772?hl=en))       | No Place ID required; supplies the final Google review URL                                                                                                                                      | No                                      | Best no-API path                                                 |
| Google Maps URL plus manual Place ID ([Maps URLs](https://developers.google.com/maps/documentation/urls/get-started))       | Can supply a Google Place ID, but not the documented `writeAReviewUri` without a Places response ([Maps links](https://developers.google.com/maps/documentation/places/web-service/maps-links)) | No, if all values are supplied manually | Conditional; weaker target unless a review link is also supplied |
| Nominatim ([Search API](https://nominatim.org/release-docs/latest/api/Search/))                                             | OSM `place_id`; no Google review target                                                                                                                                                         | Yes                                     | Not a drop-in replacement                                        |
| HERE ([Geocoding and Search](https://docs.here.com/geocoding-and-search/docs/introduction-to-here-geocoding-search-api-v7)) | HERE `id`; no Google review target                                                                                                                                                              | Yes                                     | Separate HERE feature only                                       |
| Mapbox ([Search Box](https://docs.mapbox.com/api/search/search-box/))                                                       | Mapbox `mapbox_id`; no Google review target                                                                                                                                                     | Yes                                     | Poor fit; storage restrictions also apply                        |
| Foursquare ([Places API](https://foursquare.com/products/places-api/))                                                      | Foursquare place ID; no Google review target                                                                                                                                                    | Yes                                     | Separate Foursquare feature only                                 |
| Geoapify ([Places API](https://apidocs.geoapify.com/docs/places/))                                                          | Geoapify/OSM place ID; no Google review target                                                                                                                                                  | Yes                                     | Separate provider feature only                                   |

## Current Contract

The current implementation has these requirements:

- `PlacesAdapter.search()` returns candidates whose `placeId` must pass Google Place ID validation.
- `PlacesAdapter.getPlaceDetails()` returns a candidate plus `canonicalReviewUrl`.
- `QrService.resolveTarget()` validates the Google Maps URL, optionally searches Google, fetches Place Details, and validates that the review URL belongs to the selected Google Place.
- QR records persist `rawGoogleMapsUrl`, `googlePlaceId`, and `canonicalReviewUrl`.
- The public route returns a redirect only when the stored canonical review URL is valid and the QR is active.
- The admin form requires a Google Maps URL and a selected Google place before creating QR records.

These behaviors are implemented in [`places.ts`](../../src/orpc-server/resource/qr/places.ts), [`service.ts`](../../src/orpc-server/resource/qr/service.ts), [`url.ts`](../../src/orpc-server/resource/qr/url.ts), [`qr.ts`](../../src/orpc-contract/resource/qr.ts), [`qr-batch-create-form.tsx`](../../src/components/admin/qr-batch-create-form.tsx), and [`r/[slug].ts`](../../src/pages/r/[slug].ts).

## Options

### 1. Owner-supplied Google review link

Google Business Profile Help documents how a business can create and share a direct review link with customers ([official instructions](https://support.google.com/business/answer/7035772?hl=en)). This link is already the final redirect target, so the server does not need to resolve a place or manufacture a review URL.

**Fit:** best fit for a no-Places-API path.

- Does not produce a Google Place ID, so the data model would need to make the ID optional or treat the supplied review URL as the primary target.
- Avoids provider lookup and Places API billing during setup.
- Requires an administrator or business owner to paste the link for the correct profile.
- The UI should show the supplied link and require confirmation; URL validation can check allowed Google hosts, but host validation alone cannot prove that the profile belongs to the intended business.
- Existing QR redirects can remain simple because they already redirect using stored data and do not call a place provider at scan time.

### 2. Google Maps URL plus a manually supplied Place ID

Google Maps URLs are documented as free and do not require a Maps API key ([Google Maps URL architecture](https://developers.google.com/maps/architecture/maps-url)). The documented search URL supports a required `query` and an optional `query_place_id`; using a Place ID is the recommended way to disambiguate a place ([Maps URLs guide](https://developers.google.com/maps/documentation/urls/get-started)).

This can avoid an API lookup if an administrator already has the Maps URL and the correct Place ID. It does **not** by itself provide the Places API `googleMapsLinks.writeAReviewUri`. Google documents that field as a response from Text Search, Nearby Search, or Place Details when requested in the field mask ([Link to Google Maps](https://developers.google.com/maps/documentation/places/web-service/maps-links)).

**Fit:** possible only if the product accepts a weaker target or keeps Google Places for canonical review-link generation.

- Good for linking users to a Google Maps place/search URL without an API call.
- A manually entered Place ID is still user-provided data and needs format and consistency validation.
- Do not construct an undocumented write-review URL from the Place ID.
- If the product requirement is specifically "write a review," prefer the owner-supplied review link or the Google Places response.

### 3. OpenStreetMap Nominatim

Nominatim's Search API returns OpenStreetMap search results, including an internal `place_id`, OSM type/ID, coordinates, and display data ([Search API](https://nominatim.org/release-docs/latest/api/Search/)). That identifier is not a Google Place ID and cannot be used to create a Google review link.

The public OSM Foundation service has strict operational requirements: a maximum of one request per second, an identifying `User-Agent` or `Referer`, visible attribution, and compliance with the ODbL license ([Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)). The policy also says autocomplete is not supported, discourages bulk and periodic geocoding, and warns that commercial applications should consider the risk of relying on the public service.

**Fit:** not suitable as a transparent replacement. It could support an independent OSM location feature, but it cannot resolve the Google identity required by the current QR target.

### 4. HERE Geocoding and Search

HERE supports free-form place/address discovery and returns a HERE-specific `id`; the same ID can be used with HERE's Lookup endpoint ([HERE API introduction](https://docs.here.com/geocoding-and-search/docs/introduction-to-here-geocoding-search-api-v7), [HERE Lookup](https://docs.here.com/geocoding-and-search/docs/endpoint-lookup-brief)). HERE provides its own platform pricing and free-start information ([HERE pricing](https://www.here.com/get-started/pricing)).

**Fit:** technically viable as a separate place-search adapter, but not as the current adapter's replacement.

- Results use HERE identifiers and metadata, not Google Place IDs.
- HERE results do not supply Google's canonical write-review URL.
- A separate Google mapping or user-supplied Google target would still be required.
- Introducing it would add a provider credential, billing account, failure modes, and a new identifier namespace without solving the final-link requirement.

### 5. Mapbox Search

Mapbox Search Box returns a `mapbox_id`, and its Details endpoint accepts that ID ([Search Box API](https://docs.mapbox.com/api/search/search-box/), [Mapbox Places](https://docs.mapbox.com/api/search/places/)). These are Mapbox identifiers, not Google Place IDs, and the documented response is not a source of Google's review link.

Mapbox documents that Search Box `/suggest` and `/retrieve` usage is billed by search session, while `/category` and `/reverse` usage is billed per request ([Search Box pricing FAQ](https://www.mapbox.com/search-box), [Mapbox pricing](https://www.mapbox.com/pricing)). Mapbox also documents that Places API data is for temporary display and use unless a separate storage agreement exists ([Mapbox Places restrictions](https://docs.mapbox.com/api/search/places/)).

**Fit:** poor fit for this workflow. The provider can power a temporary search UI, but it cannot produce the Google identity or review target that the QR record needs. Its storage restrictions also make persisting Mapbox place data an explicit licensing decision.

### 6. Foursquare Places

Foursquare provides place search and detailed location context through its Places API ([Foursquare Places API](https://foursquare.com/products/places-api/)). Its pricing page describes pay-as-you-go Pro and Premium endpoints and a free allowance for selected Pro usage ([Foursquare pricing](https://foursquare.com/pricing/)). Foursquare place identifiers are provider-specific and do not become Google Place IDs or Google review URLs.

**Fit:** not suitable as a drop-in replacement. It can be useful for a Foursquare-based directory or enrichment feature, but a separate Google review target would still be needed.

### 7. Geoapify

Geoapify's Places API requires an API key and returns Geoapify/OpenStreetMap-based place results, including its own place identifiers ([Geoapify Places API](https://apidocs.geoapify.com/docs/places/)). Geoapify documents a free plan with up to 3,000 credits per day and describes Places requests as credit-based, with one credit for up to 20 returned places ([Geoapify pricing](https://www.geoapify.com/pricing/), [Geoapify API documentation](https://apidocs.geoapify.com/docs/places/)).

Those results do not provide Google Place IDs or Google's canonical review-link field. Geoapify's terms are published separately ([Geoapify Terms and Conditions](https://www.geoapify.com/terms-and-conditions/)).

**Fit:** not suitable as a transparent replacement. It may be an inexpensive independent search provider, but it cannot satisfy the current Google review destination contract.

## Google Places Cost and Link Tradeoff

Google documents that Places API billing is pay-as-you-go and SKU-based. For Text Search, Nearby Search, and Place Details, the requested field mask determines the highest applicable SKU ([Places API Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)). The current adapter requests candidate display data in Text Search and requests `googleMapsLinks.writeAReviewUri` in Place Details ([`places.ts`](../../src/orpc-server/resource/qr/places.ts)).

Google's Maps-link documentation currently labels the `googleMapsLinks` feature as preview and free to use, but that does not make the surrounding Text Search and Place Details calls universally free; those calls remain subject to the published SKU and billing rules ([Link to Google Maps](https://developers.google.com/maps/documentation/places/web-service/maps-links), [Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)). Pricing and preview status should be rechecked before relying on them as a long-term cost assumption.

## Recommended Product Shape

1. Add a no-lookup setup path where an administrator pastes the official Google Business Profile review link. Store that link as the redirect target and make `googlePlaceId` optional for this path.
2. Keep the current Google Places path for teams that want search, disambiguation, and server-generated canonical review links.
3. Optionally accept a Google Maps URL with a manually supplied Place ID for a lower-cost place-link path, but make clear that it may target Maps rather than the write-review screen unless a review link is also supplied.
4. Do not use Nominatim, HERE, Mapbox, Foursquare, or Geoapify to populate the existing Google fields. If one is added later, model its identifier as provider-specific and define a separate product flow for its destination.

## Sources Not Fully Verified

- Foursquare's exact current API terms/EULA pages could not be verified; the report therefore makes no detailed Foursquare retention or redistribution claim.
- Detailed provider-specific legal restrictions for HERE were not used beyond the documented API behavior and pricing link.
- Mapbox storage restrictions cited above come from the official API documentation; the full legal terms should still be reviewed before production storage or redistribution.
- Provider pricing and preview status can change. The linked official pricing pages are the source of truth at implementation time.
