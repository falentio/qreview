import { render } from "takumi-js"

import {
  GOOGLE_REVIEW_CARD_FONTS,
  GOOGLE_REVIEW_CARD_SIZE,
  GoogleReviewCard,
} from "@/templates/google-review-card"

export function renderGoogleReviewTemplate(qrUrl: string) {
  return render(<GoogleReviewCard qrUrl={qrUrl} />, {
    ...GOOGLE_REVIEW_CARD_SIZE,
    fonts: GOOGLE_REVIEW_CARD_FONTS,
  })
}
