# Google Review Link Format

**Research date:** 2026-08-29
**Scope:** Google Places API review links, documented Maps URL and Place ID formats, and the observed behavior of the supplied review URL variants.

## Concise Findings

- `googleMapsLinks.writeAReviewUri` is a Places API (New) response field. Google describes it as a link to write a review for the place in Google Maps. Text Search (New), Nearby Search (New), and Place Details (New) can return Google Maps links when the relevant field is included in the request field mask. [Places API: Link to Google Maps](https://developers.google.com/maps/documentation/places/web-service/maps-links)
- Google’s Places documentation shows `writeAReviewUri` as a preformatted URL, for example a `https://www.google.com/maps/place//data=...!12e1` URL. The documented integration is to use the returned link; it does not instruct clients to construct a review URL from a Place ID. [REST `GoogleMapsLinks` reference](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#GoogleMapsLinks)
- The documented Maps URL product covers Search, Directions, map display, and Street View. For Search, `api=1` is required, `query` is required, and `query_place_id` is optional. A Place ID makes a specific-place link more reliable, but it does not document `search.google.com/local/writereview`, `placeId`, or `placeid` as Maps URL syntax. [Maps URLs: Get Started](https://developers.google.com/maps/documentation/urls/get-started)
- Place IDs are opaque textual identifiers that uniquely identify places in Google’s database and on Google Maps. Google says IDs can change and recommends refreshing stored IDs older than 12 months. [Places API: Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)

## Observed URL Behavior

The following was observed on 2026-08-29 using direct HTTPS requests and browser navigation from an unauthenticated browser session. The Place ID value was unchanged in both requests.

| URL variant                                                                       | Direct response                                                                                                                                                 | Followed browser result                                                     |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `https://search.google.com/local/writereview?placeId=ChIJw2FfuS6HeC4R7Kah0w7ATVI` | HTTP `400`; no `Location` header                                                                                                                                | Google error page: “Your client has issued a malformed or illegal request.” |
| `https://search.google.com/local/writereview?placeid=ChIJw2FfuS6HeC4R7Kah0w7ATVI` | HTTP `302` with `Location: https://accounts.google.com/ServiceLogin?continue=https://search.google.com/local/writereview?placeid%3DChIJw2FfuS6HeC4R7Kah0w7ATVI` | Google Accounts sign-in page                                                |

The lowercase spelling is therefore recognized by the current endpoint far enough to redirect an unauthenticated user to sign-in. This does not prove that the endpoint is a documented or permanent public URL, nor that a signed-in user will always receive the same result. The uppercase spelling was rejected as malformed in this observation.

## Implications For This Repo

- The Places API adapter has been removed. `src/orpc-server/resource/qr/url.ts` now derives the Place ID from a Maps feature ID and constructs the API-shaped Maps review URL locally.
- `src/orpc-server/resource/qr/service.ts` validates that the selected Place ID matches the URL and persists the locally generated canonical target.
- `src/orpc-server/resource/qr/public-cache.ts` relation-checks Maps data URLs by decoding their feature ID instead of accepting any URL with the expected shape.
- The implementation intentionally relies on undocumented Google URL and Place ID encoding behavior. The live conversion must be rechecked if Google changes its canonical Maps URLs.
- Existing persisted API-generated review URLs remain accepted, including URLs with the optional `g_mp` parameter.

## Official Sources

- [Places API: Link to Google Maps](https://developers.google.com/maps/documentation/places/web-service/maps-links)
- [Places API REST reference: `GoogleMapsLinks`](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#GoogleMapsLinks)
- [Maps URLs: Get Started](https://developers.google.com/maps/documentation/urls/get-started)
- [Places API: Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
