import { writeFile } from "node:fs/promises"

import React from "react"
import { render } from "takumi-js"

import {
  GOOGLE_REVIEW_CARD_FONTS,
  GOOGLE_REVIEW_CARD_SIZE,
  GoogleReviewCard,
} from "../src/templates/google-review-card"

const png = await render(
  <GoogleReviewCard
    businessName="our business"
    qrUrl="https://www.google.com/maps/search/?api=1&query=Google&query_place_id=ChIJw2FfuS6HeC4R7Kah0w7ATVI"
  />,
  {
    ...GOOGLE_REVIEW_CARD_SIZE,
    fonts: GOOGLE_REVIEW_CARD_FONTS,
  },
)

await writeFile("public/template/google-review-card-a6-preview.png", png)
