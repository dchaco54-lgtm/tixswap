import { ImageResponse } from "next/og";
import {
  buildEventLocationLine,
  ensureAbsoluteUrl,
  formatCLP,
  formatEventDateLabel,
  formatEventTimeLabel,
  getTicketPrice,
} from "@/lib/share";

type ShareVariant = "story" | "post" | "og";
type ShareKind = "event" | "ticket";

type ShareImageProps = {
  variant: ShareVariant;
  kind: ShareKind;
  title?: string | null;
  eventDate?: string | null;
  venue?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  price?: number | null;
  seatLabel?: string | null;
};

const VARIANTS = {
  story: {
    width: 1080,
    height: 1920,
    padding: 64,
    title: { base: 92, mid: 82, long: 74 },
    meta: 36,
    seat: 26,
    footer: 24,
    logo: 28,
    subtitle: 18,
    priceLabel: 22,
    priceValue: 102,
    maxTitle: 72,
    maxLocation: 64,
    maxSeat: 56,
    maxWidth: 860,
  },
  post: {
    width: 1080,
    height: 1080,
    padding: 60,
    title: { base: 76, mid: 66, long: 58 },
    meta: 30,
    seat: 22,
    footer: 22,
    logo: 26,
    subtitle: 16,
    priceLabel: 20,
    priceValue: 82,
    maxTitle: 56,
    maxLocation: 54,
    maxSeat: 46,
    maxWidth: 780,
  },
  og: {
    width: 1200,
    height: 630,
    padding: 52,
    title: { base: 60, mid: 54, long: 46 },
    meta: 24,
    seat: 18,
    footer: 18,
    logo: 22,
    subtitle: 14,
    priceLabel: 16,
    priceValue: 58,
    maxTitle: 52,
    maxLocation: 52,
    maxSeat: 42,
    maxWidth: 760,
  },
} as const;

const IMAGE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
};

function withHeaders(response: ImageResponse) {
  for (const [key, value] of Object.entries(IMAGE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function truncate(value: string, max: number) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1).trimEnd()}…`;
}

function resolveTitleSize(variant: ShareVariant, title: string) {
  const length = String(title || "").length;
  const config = VARIANTS[variant].title;
  if (length > 62) return config.long;
  if (length > 46) return config.mid;
  return config.base;
}

function renderStoryLayout({
  kind,
  title,
  eventDate,
  venue,
  city,
  imageUrl,
  price,
  seatLabel,
}: ShareImageProps) {
  const safeTitle = truncate(title || (kind === "ticket" ? "Entrada" : "Evento"), 40);
  const titleSize = Math.max(Math.min(resolveTitleSize("story", safeTitle) - 24, 56), 44);
  const dateText = [formatEventDateLabel(eventDate), formatEventTimeLabel(eventDate)]
    .filter(Boolean)
    .join(" · ");
  const locationText = truncate(buildEventLocationLine(venue, city), 56);
  const priceText = kind === "ticket" ? formatCLP(getTicketPrice({ price })) : "";
  const seatText = kind === "ticket" ? truncate(seatLabel || "", 48) : "";
  const absoluteImage = imageUrl ? ensureAbsoluteUrl(imageUrl) : null;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background: "linear-gradient(180deg, #1E40AF 0%, #2563EB 54%, #0F172A 100%)",
        color: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 92,
          left: -24,
          display: "flex",
          fontSize: 210,
          fontWeight: 800,
          letterSpacing: -8,
          color: "rgba(255,255,255,0.09)",
        }}
      >
        ENTRADAS
      </div>

      <div
        style={{
          position: "absolute",
          top: 1030,
          right: -36,
          display: "flex",
          fontSize: 208,
          fontWeight: 800,
          letterSpacing: -8,
          color: "rgba(255,255,255,0.08)",
        }}
      >
        ENTRADAS
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          padding: 64,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: -0.8,
              color: "rgba(255,255,255,0.96)",
            }}
          >
            TixSwap
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              fontSize: 18,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            Reventa segura
          </div>
        </div>

        <div
          style={{
            marginTop: 110,
            width: "100%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 792,
              height: 980,
              position: "relative",
              display: "flex",
              overflow: "hidden",
              borderRadius: 26,
              boxShadow: "0 28px 72px rgba(2, 6, 23, 0.36)",
              background: "rgba(9, 16, 36, 0.48)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {absoluteImage ? (
              <img
                src={absoluteImage}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  background:
                    "linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.92) 100%)",
                  padding: 48,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 22,
                    letterSpacing: 2.6,
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.66)",
                  }}
                >
                  Evento
                </div>
                <div
                  style={{
                    display: "flex",
                    marginTop: 18,
                    fontSize: 68,
                    lineHeight: 1.02,
                    fontWeight: 800,
                    letterSpacing: -2.2,
                  }}
                >
                  {safeTitle}
                </div>
                {locationText ? (
                  <div
                    style={{
                      display: "flex",
                      marginTop: 18,
                      fontSize: 30,
                      color: "rgba(255,255,255,0.82)",
                    }}
                  >
                    {locationText}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          {kind === "ticket" && priceText ? (
            <div style={{ display: "flex", flexDirection: "column", marginBottom: 18 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  textTransform: "uppercase",
                  letterSpacing: 1.6,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                Precio publicado
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 10,
                  fontSize: 82,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: -2.4,
                }}
              >
                {priceText}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.04,
              letterSpacing: -1.4,
              color: "rgba(255,255,255,0.97)",
              maxWidth: 860,
            }}
          >
            {safeTitle}
          </div>

          {dateText ? (
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 32,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {dateText}
            </div>
          ) : null}

          {locationText ? (
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: 30,
                color: "rgba(255,255,255,0.84)",
              }}
            >
              {locationText}
            </div>
          ) : null}

          {kind === "ticket" && seatText ? (
            <div
              style={{
                display: "flex",
                marginTop: 12,
                fontSize: 24,
                color: "rgba(255,255,255,0.74)",
              }}
            >
              {seatText}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 30,
              color: "rgba(255,255,255,0.96)",
            }}
          >
            www.tixswap.cl
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 12,
              fontSize: 22,
              color: "rgba(255,255,255,0.72)",
            }}
          >
            Compra protegida · Disputas con evidencia
          </div>
        </div>
      </div>
    </div>
  );
}

function ShareImageLayout({
  variant,
  kind,
  title,
  eventDate,
  venue,
  city,
  imageUrl,
  price,
  seatLabel,
}: ShareImageProps) {
  if (variant === "story") {
    return renderStoryLayout({
      variant,
      kind,
      title,
      eventDate,
      venue,
      city,
      imageUrl,
      price,
      seatLabel,
    });
  }

  const config = VARIANTS[variant];
  const safeTitle = truncate(title || (kind === "ticket" ? "Entrada" : "Evento"), config.maxTitle);
  const titleSize = resolveTitleSize(variant, safeTitle);
  const dateText = [formatEventDateLabel(eventDate), formatEventTimeLabel(eventDate)]
    .filter(Boolean)
    .join(" · ");
  const locationText = truncate(buildEventLocationLine(venue, city), config.maxLocation);
  const priceText = kind === "ticket" ? formatCLP(getTicketPrice({ price })) : "";
  const seatText = kind === "ticket" ? truncate(seatLabel || "", config.maxSeat) : "";
  const absoluteImage = imageUrl ? ensureAbsoluteUrl(imageUrl) : null;
  const footerPrimary = "Compra protegida · Disputas con evidencia";
  const footerSecondary = "";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        background: "linear-gradient(180deg, #0b1b3a 0%, #2563eb 100%)",
        color: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background: "linear-gradient(180deg, #081226 0%, #2563eb 100%)",
        }}
      />

      {absoluteImage ? (
        <img
          src={absoluteImage}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            variant === "og"
              ? "linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.26) 28%, rgba(0,0,0,0.76) 100%)"
              : "linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.22) 26%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.84) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          background:
            variant === "og"
              ? "linear-gradient(180deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.06) 42%, rgba(11,27,58,0.58) 100%)"
              : "linear-gradient(180deg, rgba(37,99,235,0.10) 0%, rgba(37,99,235,0.06) 40%, rgba(11,27,58,0.68) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          padding: config.padding,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: config.logo,
              fontWeight: 800,
              letterSpacing: -0.7,
            }}
          >
            TixSwap
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 8,
              fontSize: config.subtitle,
              color: "rgba(255,255,255,0.86)",
            }}
          >
            Reventa segura
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: config.maxWidth,
            alignSelf: variant === "post" ? "center" : "flex-start",
          }}
        >
          {kind === "ticket" && priceText ? (
            <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: config.priceLabel,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "rgba(255,255,255,0.76)",
                }}
              >
                Precio
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontSize: config.priceValue,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: -2.2,
                }}
              >
                {priceText}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.03,
              letterSpacing: -2.1,
            }}
          >
            {safeTitle}
          </div>

          {dateText ? (
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: config.meta,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {dateText}
            </div>
          ) : null}

          {locationText ? (
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: config.meta,
                color: "rgba(255,255,255,0.84)",
              }}
            >
              {locationText}
            </div>
          ) : null}

          {kind === "ticket" && seatText ? (
            <div
              style={{
                display: "flex",
                marginTop: 16,
                fontSize: config.seat,
                color: "rgba(255,255,255,0.78)",
              }}
            >
              {seatText}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              marginTop: variant === "og" ? 24 : 34,
              fontSize: config.footer,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            {footerPrimary}
          </div>

          {footerSecondary ? (
            <div
              style={{
                display: "flex",
                marginTop: 8,
                fontSize: config.footer,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {footerSecondary}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function createShareImageResponse(props: ShareImageProps) {
  const config = VARIANTS[props.variant];
  return withHeaders(
    new ImageResponse(<ShareImageLayout {...props} />, {
      width: config.width,
      height: config.height,
    })
  );
}

export function createShareFallbackResponse(
  variant: ShareVariant,
  kind: ShareKind,
  title?: string | null
) {
  const config = VARIANTS[variant];
  return withHeaders(
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            padding: config.padding,
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #0b1b3a 0%, #2563eb 100%)",
            color: "white",
          }}
        >
          <div style={{ display: "flex", fontSize: config.logo, opacity: 0.92 }}>
            TixSwap · Reventa segura
          </div>
          <div
            style={{
              display: "flex",
              marginTop: "auto",
              fontSize: Math.max(config.title.base - 8, 42),
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            {truncate(title || (kind === "ticket" ? "Entrada" : "Evento"), 34)}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontSize: Math.max(config.meta - 2, 22),
              opacity: 0.9,
            }}
          >
            Revisa el link en TixSwap
          </div>
        </div>
      ),
      {
        width: config.width,
        height: config.height,
      }
    )
  );
}
