import type { CSSProperties } from "react"
import QRCode from "qrcode"
import { googleFonts } from "takumi-js/helpers"

export const GOOGLE_REVIEW_CARD_SIZE = {
  width: 1240,
  height: 1748,
} as const

export const GOOGLE_REVIEW_CARD_FONT_FAMILY = "Geist"
export const GOOGLE_REVIEW_CARD_FONTS = googleFonts([
  { name: GOOGLE_REVIEW_CARD_FONT_FAMILY, weight: "100..900" },
])

const QR_RENDER_SIZE = 312
const COLOR_WAVE_HEIGHT = 211

export type GoogleReviewCardProps = {
  /** The URL encoded in the QR code. */
  qrUrl: string
  businessName?: string
}

const columnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
}

function GoogleWordmark() {
  return (
    // Google wordmark paths from Google's published gstatic SVG asset.
    <svg aria-label="Google" height="144" role="img" viewBox="0 0 74 24" width="444">
      <path
        d="M9.24 8.19v2.46h5.88c-.18 1.38-.64 2.39-1.34 3.1-.86.86-2.2 1.8-4.54 1.8-3.62 0-6.45-2.92-6.45-6.54s2.83-6.54 6.45-6.54c1.95 0 3.38.77 4.43 1.76L15.4 2.5C13.94 1.08 11.98 0 9.24 0 4.28 0 .11 4.04.11 9s4.17 9 9.13 9c2.68 0 4.7-.88 6.28-2.52 1.62-1.62 2.13-3.91 2.13-5.75 0-.57-.04-1.1-.13-1.54H9.24z"
        fill="#4285F4"
      />
      <path
        d="M25 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z"
        fill="#EA4335"
      />
      <path
        d="M53.58 7.49h-.09c-.57-.68-1.67-1.3-3.06-1.3C47.53 6.19 45 8.72 45 12c0 3.26 2.53 5.81 5.43 5.81 1.39 0 2.49-.62 3.06-1.32h.09v.81c0 2.22-1.19 3.41-3.1 3.41-1.56 0-2.53-1.12-2.93-2.07l-2.22.92c.64 1.54 2.33 3.43 5.15 3.43 2.99 0 5.52-1.76 5.52-6.05V6.49h-2.42v1zm-2.93 8.03c-1.76 0-3.1-1.5-3.1-3.52 0-2.05 1.34-3.52 3.1-3.52 1.74 0 3.1 1.5 3.1 3.54.01 2.03-1.36 3.5-3.1 3.5z"
        fill="#4285F4"
      />
      <path
        d="M38 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z"
        fill="#FBBC05"
      />
      <path d="M58 .24h2.51v17.57H58z" fill="#34A853" />
      <path
        d="M68.26 15.52c-1.3 0-2.22-.59-2.82-1.76l7.77-3.21-.26-.66c-.48-1.3-1.96-3.7-4.97-3.7-2.99 0-5.48 2.35-5.48 5.81 0 3.26 2.46 5.81 5.76 5.81 2.66 0 4.2-1.63 4.84-2.57l-1.98-1.32c-.66.96-1.56 1.6-2.86 1.6zm-.18-7.15c1.03 0 1.91.53 2.2 1.28l-5.25 2.17c0-2.44 1.73-3.45 3.05-3.45z"
        fill="#EA4335"
      />
    </svg>
  )
}

function StarIcon({ size = 64 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="#fbbc05" height={size} viewBox="0 0 100 100" width={size}>
      <path d="m50 3 11.4 32.8 34.7.7-27.5 20.8 10.1 33.2L50 71.3 21.3 90.5l10.1-33.2L3.9 36.5l34.7-.7L50 3Z" />
    </svg>
  )
}

function HeartIcon({ color = "#1a73e8", size = 38 }: { color?: string; size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 24 24" width={size}>
      <path
        d="M20.8 8.7c0 5.2-8.8 10.2-8.8 10.2S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.3Z"
        fill={color}
        stroke={color}
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function NfcTapIcon({ color = "#162235" }: { color?: string }) {
  // Material Design Icons `mdi:nfc-tap`, distributed under Apache 2.0.
  return (
    <svg aria-hidden="true" height={172} viewBox="0 0 24 24" width={172}>
      <path
        d="M12 10a2 2 0 0 1 2 2a2 2 0 0 1-2 2a2 2 0 0 1-2-2a2 2 0 0 1 2-2M4 4h7a2 2 0 0 1 2 2v3h-2V6H4v5h2V9l3 3l-3 3v-2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m16 16h-7a2 2 0 0 1-2-2v-3h2v3h7v-5h-2v2l-3-3l3-3v2h2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2"
        fill={color}
      />
    </svg>
  )
}

function QrCode({ qrUrl }: { qrUrl: string }) {
  const { modules } = QRCode.create(qrUrl, { errorCorrectionLevel: "H" })
  const quietZone = 4
  let path = ""

  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (modules.data[row * modules.size + column]) {
        path += `M${column} ${row}h1v1h-1z`
      }
    }
  }

  return (
    <svg
      aria-label="QR code for leaving a Google review"
      height={QR_RENDER_SIZE}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`${-quietZone} ${-quietZone} ${modules.size + quietZone * 2} ${modules.size + quietZone * 2}`}
      width={QR_RENDER_SIZE}
    >
      <rect
        fill="#ffffff"
        height={modules.size + quietZone * 2}
        width={modules.size + quietZone * 2}
        x={-quietZone}
        y={-quietZone}
      />
      <path d={path} fill="#162235" />
    </svg>
  )
}

function ReviewDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "22px",
        marginTop: "30px",
        width: "74%",
      }}
    >
      <div style={{ backgroundColor: "#b9c2d0", height: "2px", flex: 1 }} />
      <HeartIcon />
      <div style={{ backgroundColor: "#b9c2d0", height: "2px", flex: 1 }} />
    </div>
  )
}

function ColorWave({ position }: { position: "top" | "bottom" }) {
  const isTop = position === "top"

  return (
    <div
      style={{
        backgroundColor: "#f8fbff",
        flexShrink: 0,
        height: `${COLOR_WAVE_HEIGHT}px`,
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <svg
        aria-hidden="true"
        height={COLOR_WAVE_HEIGHT}
        preserveAspectRatio="none"
        style={{
          bottom: isTop ? undefined : 0,
          position: "absolute",
          top: isTop ? 0 : undefined,
          width: "100%",
        }}
        viewBox="0 0 1240 211"
        width="1240"
      >
        {isTop ? (
          <>
            <path d="M0 0h540c-90 83-168 41-270 87C178 128 89 141 0 199V0Z" fill="#4285f4" />
            <path d="M1240 0H918c92 31 163 87 322 63V0Z" fill="#ea4335" />
            <path d="M1240 63v148c-101-41-193-82-322-148 121 48 221 29 322 0Z" fill="#fbbc05" />
          </>
        ) : (
          <>
            <path d="M0 211V124c98 32 177 68 273 44 100-24 190-61 305 43H0Z" fill="#34a853" />
            <path d="M273 211c122-77 237-37 374-26 105 10 194 2 290 26H273Z" fill="#4285f4" />
            <path d="M759 211c93-53 189-60 303-31 63 17 119 24 178 10v21H759Z" fill="#fbbc05" />
            <path d="M1050 190c74 12 131 5 190-10v31h-190Z" fill="#ea4335" />
          </>
        )}
      </svg>
    </div>
  )
}

function ActionPanel({ qrUrl }: { qrUrl: string }) {
  return (
    <div
      style={{
        backgroundColor: "#d7e0ee",
        borderRadius: "44px",
        boxSizing: "border-box",
        height: "520px",
        padding: "5px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: "#ffffff",
          borderRadius: "39px",
          boxSizing: "border-box",
          display: "flex",
          height: "100%",
          overflow: "hidden",
          width: "100%",
        }}
      >
        <div
          style={{
            ...columnStyle,
            backgroundColor: "#162235",
            boxSizing: "border-box",
            flex: 1,
            height: "100%",
            justifyContent: "center",
            padding: "30px",
          }}
        >
          <NfcTapIcon color="#ffffff" />
          <div
            style={{
              color: "#ffffff",
              fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
              fontSize: "38px",
              fontWeight: 600,
              lineHeight: 1,
              marginTop: "4px",
            }}
          >
            Tap to review
          </div>
          <div
            style={{
              color: "#b8c6dc",
              fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
              fontSize: "32px",
              lineHeight: 1.2,
              marginTop: "12px",
            }}
          >
            Hold your phone here
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            backgroundColor: "#ffffff",
            border: "3px solid #d7e0ee",
            borderRadius: "50%",
            boxSizing: "border-box",
            color: "#162235",
            display: "flex",
            flexShrink: 0,
            fontSize: "18px",
            fontWeight: 700,
            height: "44px",
            justifyContent: "center",
            marginLeft: "-22px",
            marginRight: "-22px",
            width: "44px",
            zIndex: 1,
          }}
        >
          OR
        </div>

        <div
          style={{
            ...columnStyle,
            backgroundColor: "#ffffff",
            boxSizing: "border-box",
            flex: 1,
            height: "100%",
            justifyContent: "center",
            padding: "30px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: "17px",
              boxSizing: "border-box",
              display: "flex",
              height: "370px",
              justifyContent: "center",
              padding: "26px",
              width: "370px",
            }}
          >
            <QrCode qrUrl={qrUrl} />
          </div>
          <div
            style={{
              color: "#162235",
              fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
              fontSize: "36px",
              fontWeight: 600,
              lineHeight: 1,
              marginTop: "12px",
            }}
          >
            Scan to review
          </div>
          <div
            style={{
              color: "#4f5f75",
              fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
              fontSize: "32px",
              lineHeight: 1.2,
              marginTop: "12px",
            }}
          >
            Use your camera
          </div>
        </div>
      </div>
    </div>
  )
}

export function GoogleReviewCard({ businessName = "our business", qrUrl }: GoogleReviewCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#f8fbff",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
        height: "100%",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <ColorWave position="top" />

      <div
        style={{
          alignItems: "center",
          boxSizing: "border-box",
          display: "flex",
          flex: 1,
          flexDirection: "column",
          padding: "54px 84px 42px",
        }}
      >
        <div style={{ ...columnStyle, width: "100%" }}>
          <GoogleWordmark />

          <div
            style={{
              color: "#101828",
              fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
              fontSize: "72px",
              fontWeight: 500,
              lineHeight: 1.08,
              marginTop: "22px",
              textAlign: "center",
            }}
          >
            <div>Review us</div>
            <div>
              on <span style={{ color: "#1a73e8", fontWeight: 600 }}>Google</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", marginTop: "28px" }}>
            <StarIcon />
            <StarIcon />
            <StarIcon />
            <StarIcon />
            <StarIcon />
          </div>

          <ReviewDivider />
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            marginTop: "54px",
            width: "100%",
          }}
        >
          <div
            style={{
              color: "#4f5f75",
              fontSize: "34px",
              fontWeight: 600,
              letterSpacing: "3px",
              lineHeight: 1,
              marginBottom: "18px",
              textAlign: "center",
            }}
          >
            TAP OR SCAN TO REVIEW
          </div>
          <ActionPanel qrUrl={qrUrl} />
        </div>

        <div style={{ ...columnStyle, marginTop: "auto", width: "100%" }}>
          <div
            style={{
              color: "#101828",
              fontFamily: GOOGLE_REVIEW_CARD_FONT_FAMILY,
              fontSize: "42px",
              fontWeight: 500,
              lineHeight: 1.15,
              textAlign: "center",
              width: "100%",
            }}
          >
            <div>Thank you, {businessName}!</div>
          </div>

          <div style={{ alignItems: "center", display: "flex", gap: "14px", marginTop: "22px" }}>
            <div style={{ color: "#647084", fontSize: "27px", lineHeight: 1.1 }}>
              Your feedback matters to us.
            </div>
          </div>
        </div>
      </div>

      <ColorWave position="bottom" />
    </div>
  )
}

export default GoogleReviewCard
