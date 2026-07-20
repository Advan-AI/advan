import { ImageResponse } from "next/og"

export const alt = "Advan AI — Trust Infrastructure for AI Customer Support"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

const CHIPS = ["Source-cited answers", "Confidence scoring", "Human-in-loop gates", "Full audit trail"]

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          backgroundColor: "#f5f6f1",
          backgroundImage:
            "radial-gradient(760px 420px at 12% 18%, rgba(25,120,105,0.14), transparent 62%), radial-gradient(820px 520px at 88% 12%, rgba(107,92,214,0.16), transparent 58%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: "#171a17",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 56 56" fill="currentColor">
              <path d="M 28,6 Q 28,28 6,28 Q 28,28 28,50 Q 28,28 50,28 Q 28,28 28,6 Z" />
            </svg>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#171a17", letterSpacing: -1 }}>
            Advan
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#146457",
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 9999,
                backgroundColor: "#197869",
              }}
            />
            Trust Engine live in every response
          </div>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: -2,
              color: "#171a17",
              maxWidth: 980,
            }}
          >
            The Trust Infrastructure Layer for AI Customer Support
          </div>
        </div>

        {/* Trust chips */}
        <div style={{ display: "flex", gap: 14 }}>
          {CHIPS.map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 22px",
                borderRadius: 9999,
                border: "1px solid rgba(23,26,23,0.12)",
                backgroundColor: "rgba(255,255,255,0.75)",
                fontSize: 21,
                fontWeight: 600,
                color: "#29332f",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  )
}
