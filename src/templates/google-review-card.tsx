import type { CSSProperties } from "react"

export const GOOGLE_REVIEW_CARD_SIZE = {
  width: 1240,
  height: 1748,
} as const

export type GoogleReviewCardProps = {
  /** A data URL or an image key registered in Takumi's render options. */
  qrCode: string
  businessName?: string
}

const columnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
}

function GoogleWordmark() {
  return (
    <div
      aria-label="Google"
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "center",
        fontFamily: "Geist",
        fontSize: "148px",
        fontWeight: 600,
        letterSpacing: "-10px",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: "#4285f4" }}>G</span>
      <span style={{ color: "#ea4335" }}>o</span>
      <span style={{ color: "#fbbc05" }}>o</span>
      <span style={{ color: "#4285f4" }}>g</span>
      <span style={{ color: "#34a853" }}>l</span>
      <span style={{ color: "#ea4335" }}>e</span>
    </div>
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
  return (
    <svg aria-hidden="true" fill="none" height="172" viewBox="0 0 240 200" width="206">
      <path d="M74 72c-22 14-22 42 0 56" stroke="#8ab4f8" strokeLinecap="round" strokeWidth="9" />
      <path d="M51 54C11 78 11 122 51 146" stroke="#8ab4f8" strokeLinecap="round" strokeWidth="9" />
      <rect height="166" rx="15" stroke={color} strokeWidth="9" width="78" x="102" y="17" />
      <path d="M127 35h28" stroke={color} strokeLinecap="round" strokeWidth="8" />
      <circle cx="141" cy="160" fill={color} r="5" />
      <path
        d="M140 84v42m0-20c0-10 15-10 15 0v12l20-18c7-6 16 4 10 11l-26 30c-8 9-19 9-27 1l-11-12"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="9"
      />
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
        height: "124px",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      <svg
        aria-hidden="true"
        height="124"
        preserveAspectRatio="none"
        style={{
          bottom: isTop ? undefined : 0,
          position: "absolute",
          top: isTop ? 0 : undefined,
          width: "100%",
        }}
        viewBox="0 0 1240 124"
        width="1240"
      >
        {isTop ? (
          <>
            <path d="M0 0h540c-90 49-168 24-270 51C178 75 89 83 0 117V0Z" fill="#4285f4" />
            <path d="M1240 0H918c92 18 163 51 322 37V0Z" fill="#ea4335" />
            <path d="M1240 37v87c-101-24-193-48-322-87 121 28 221 17 322 0Z" fill="#fbbc05" />
          </>
        ) : (
          <>
            <path d="M0 124V73c98 19 177 40 273 26 100-14 190-36 305 25H0Z" fill="#34a853" />
            <path d="M273 124c122-45 237-22 374-15 105 6 194 1 290 15H273Z" fill="#4285f4" />
            <path d="M759 124c93-31 189-35 303-18 63 10 119 14 178 6v12H759Z" fill="#fbbc05" />
            <path d="M1050 112c74 7 131 3 190-6v18h-190Z" fill="#ea4335" />
          </>
        )}
      </svg>
    </div>
  )
}

function ActionPanel({ qrCode }: { qrCode: string }) {
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
            flex: 0.85,
            height: "100%",
            justifyContent: "center",
            padding: "30px",
          }}
        >
          <NfcTapIcon color="#ffffff" />
          <div
            style={{
              color: "#ffffff",
              fontFamily: "Geist",
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
              fontFamily: "Geist",
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
            flex: 1.15,
            height: "100%",
            justifyContent: "center",
            padding: "30px",
          }}
        >
          <div
            style={{
              alignItems: "center",
              backgroundColor: "#ffffff",
              border: "3px solid #162235",
              borderRadius: "17px",
              boxSizing: "border-box",
              display: "flex",
              height: "370px",
              justifyContent: "center",
              padding: "26px",
              width: "370px",
            }}
          >
            <img
              alt="QR code for leaving a Google review"
              src={qrCode}
              style={{ display: "block", height: "100%", objectFit: "contain", width: "100%" }}
            />
          </div>
          <div
            style={{
              color: "#162235",
              fontFamily: "Geist",
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
              fontFamily: "Geist",
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

export function GoogleReviewCard({ businessName = "our business", qrCode }: GoogleReviewCardProps) {
  return (
    <div
      style={{
        backgroundColor: "#f8fbff",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Geist",
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
              fontFamily: "Geist",
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
          <ActionPanel qrCode={qrCode} />
        </div>

        <div style={{ ...columnStyle, marginTop: "auto", width: "100%" }}>
          <div
            style={{
              color: "#101828",
              fontFamily: "Geist",
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
