import {
  buildEventLocationLine,
  buildTicketSeatLabel,
  formatCLP,
  formatEventDateLabel,
  formatEventTimeLabel,
  getTicketPrice,
} from "@/lib/share";

type ShareVariant = "story" | "post";
type ShareKind = "event" | "ticket" | "default";

type ShareImageProps = {
  kind: ShareKind;
  variant: ShareVariant;
  eventName: string;
  eventDate?: string | null;
  venue?: string | null;
  city?: string | null;
  ticket?: Record<string, unknown> | null;
};

const BRAND_DARK = "#0f172a";
const BRAND_SOFT = "#dbeafe";

export function getShareImageSize(variant: ShareVariant) {
  if (variant === "story") {
    return { width: 1080, height: 1920 };
  }

  return { width: 1080, height: 1080 };
}

function pillStyle(background: string, color: string) {
  return {
    display: "flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "14px 24px",
    background,
    color,
    fontSize: 28,
    fontWeight: 600,
  } as const;
}

export function ShareImage({
  kind,
  variant,
  eventName,
  eventDate,
  venue,
  city,
  ticket,
}: ShareImageProps) {
  const dateLabel = formatEventDateLabel(eventDate);
  const timeLabel = formatEventTimeLabel(eventDate);
  const locationLabel = buildEventLocationLine(venue, city);
  const seatLabel = buildTicketSeatLabel(ticket || {});
  const priceLabel = formatCLP(getTicketPrice(ticket || {}));
  const isTicket = kind === "ticket";
  const isStory = variant === "story";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, #eff6ff 0%, #dbeafe 18%, #2563eb 62%, #1d4ed8 100%)",
        color: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -180,
          borderRadius: "50%",
          background: "rgba(147, 197, 253, 0.22)",
          transform: "translate(42%, -18%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "rgba(15, 23, 42, 0.18)",
          bottom: -220,
          left: -140,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: isStory ? "92px 72px 84px" : "72px 68px 64px",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  fontSize: 52,
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: -1.5,
                }}
              >
                TixSwap
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: "rgba(255,255,255,0.84)",
                }}
              >
                Reventa segura
              </div>
            </div>

            <div style={pillStyle("rgba(255,255,255,0.18)", "white")}>
              {isTicket ? "Entrada" : kind === "event" ? "Evento" : "TixSwap"}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
              borderRadius: 42,
              padding: isStory ? "48px 44px" : "42px 40px",
              background: "rgba(15, 23, 42, 0.20)",
              boxShadow: "0 30px 80px rgba(15, 23, 42, 0.18)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div
              style={{
                fontSize: isStory ? 84 : 74,
                lineHeight: 1.04,
                fontWeight: 800,
                letterSpacing: -2.2,
              }}
            >
              {eventName}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                color: "rgba(255,255,255,0.92)",
                fontSize: isStory ? 34 : 30,
              }}
            >
              {dateLabel ? <div>{dateLabel}</div> : null}
              {timeLabel ? <div>{timeLabel}</div> : null}
              {locationLabel ? <div>{locationLabel}</div> : null}
            </div>

            {isTicket ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  marginTop: 10,
                  paddingTop: 26,
                  borderTop: "1px solid rgba(255,255,255,0.20)",
                }}
              >
                <div
                  style={{
                    fontSize: 30,
                    color: "rgba(255,255,255,0.72)",
                    textTransform: "uppercase",
                    letterSpacing: 1.6,
                  }}
                >
                  Precio publicado
                </div>
                <div
                  style={{
                    fontSize: isStory ? 82 : 74,
                    lineHeight: 1,
                    fontWeight: 800,
                    color: "#f8fafc",
                  }}
                >
                  {priceLabel || "Consultar"}
                </div>
                {seatLabel ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      borderRadius: 30,
                      padding: "18px 22px",
                      background: "rgba(255,255,255,0.12)",
                      color: BRAND_SOFT,
                      fontSize: isStory ? 30 : 28,
                      fontWeight: 600,
                    }}
                  >
                    {seatLabel}
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  marginTop: 8,
                }}
              >
                <div style={pillStyle("rgba(15, 23, 42, 0.24)", "#f8fafc")}>
                  Compra protegida
                </div>
                <div style={pillStyle("rgba(255,255,255,0.14)", "#dbeafe")}>
                  Compartir en redes
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              height: 14,
              width: "100%",
              borderRadius: 999,
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.68) 52%, rgba(255,255,255,0.10) 100%)",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 18,
              color: "rgba(255,255,255,0.88)",
              fontSize: 28,
            }}
          >
            <div>Compra protegida · Disputas con evidencia</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 68,
                height: 68,
                borderRadius: 999,
                background: "rgba(255,255,255,0.18)",
                color: BRAND_DARK,
                fontSize: 34,
                fontWeight: 800,
              }}
            >
              TS
            </div>
          </div>
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.64)",
            }}
          >
            {isTicket ? "Publicación sin datos personales del vendedor" : "Publica y comparte directo desde TixSwap"}
          </div>
        </div>
      </div>
    </div>
  );
}
