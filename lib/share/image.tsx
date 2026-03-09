import {
  buildEventLocationLine,
  buildTicketSeatLabel,
  ensureAbsoluteUrl,
  formatCLP,
  formatEventDateLabel,
  formatEventTimeLabel,
  getTicketPrice,
} from "@/lib/share";

type ShareVariant = "story" | "post" | "og";
type ShareKind = "event" | "ticket" | "default";

type ShareImageProps = {
  kind: ShareKind;
  variant: ShareVariant;
  eventName: string;
  eventDate?: string | null;
  venue?: string | null;
  city?: string | null;
  ticket?: Record<string, unknown> | null;
  backgroundSrc?: string | null;
  debugLabel?: string | null;
};

type VariantConfig = {
  width: number;
  height: number;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
  titleSize: number;
  metaSize: number;
  priceSize: number;
  footerSize: number;
  logoSize: number;
  logoSubSize: number;
  maxTitleChars: number;
  maxContentWidth: number;
};

const FALLBACK_BG =
  "linear-gradient(180deg, #0f172a 0%, #111827 32%, #1d4ed8 100%)";

const VARIANT_CONFIG: Record<ShareVariant, VariantConfig> = {
  story: {
    width: 1080,
    height: 1920,
    paddingX: 72,
    paddingTop: 78,
    paddingBottom: 76,
    titleSize: 94,
    metaSize: 34,
    priceSize: 110,
    footerSize: 26,
    logoSize: 46,
    logoSubSize: 22,
    maxTitleChars: 54,
    maxContentWidth: 820,
  },
  post: {
    width: 1080,
    height: 1080,
    paddingX: 72,
    paddingTop: 72,
    paddingBottom: 68,
    titleSize: 78,
    metaSize: 30,
    priceSize: 94,
    footerSize: 24,
    logoSize: 40,
    logoSubSize: 20,
    maxTitleChars: 46,
    maxContentWidth: 760,
  },
  og: {
    width: 1200,
    height: 630,
    paddingX: 58,
    paddingTop: 52,
    paddingBottom: 52,
    titleSize: 58,
    metaSize: 24,
    priceSize: 66,
    footerSize: 20,
    logoSize: 30,
    logoSubSize: 16,
    maxTitleChars: 54,
    maxContentWidth: 760,
  },
};

export function getShareImageSize(variant: ShareVariant) {
  const config = VARIANT_CONFIG[variant];
  return { width: config.width, height: config.height };
}

export function getNoStoreImageHeaders() {
  return {
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  };
}

function truncateText(value: string, maxChars: number) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function resolveTitleSize(baseSize: number, title: string) {
  const length = String(title || "").trim().length;
  if (length > 60) return Math.round(baseSize * 0.8);
  if (length > 42) return Math.round(baseSize * 0.9);
  return baseSize;
}

function detectImageMime(url: string) {
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function loadRemoteImageDataUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;

  try {
    const absoluteUrl = ensureAbsoluteUrl(imageUrl);
    const response = await fetch(absoluteUrl, {
      cache: "no-store",
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error("[share/image] poster fetch failed:", absoluteUrl, response.status);
      return null;
    }

    const contentType =
      response.headers.get("content-type") || detectImageMime(absoluteUrl);
    const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${contentType};base64,${bytes}`;
  } catch (error) {
    console.error("[share/image] poster fetch error:", error);
    return null;
  }
}

function PosterBackdrop({
  backgroundSrc,
  variant,
}: {
  backgroundSrc?: string | null;
  variant: ShareVariant;
}) {
  const overlayBottom = variant === "og" ? 0.8 : 0.86;

  return (
    <>
      {backgroundSrc ? (
        <img
          src={backgroundSrc}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: FALLBACK_BG,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.22) 24%, rgba(0,0,0,0.68) 74%, rgba(0,0,0,0.86) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, rgba(37,99,235,0.10) 0%, rgba(59,130,246,0.08) 34%, rgba(29,78,216,${overlayBottom}) 100%)`,
        }}
      />
    </>
  );
}

function BrandHeader({
  logoSize,
  subSize,
}: {
  logoSize: number;
  subSize: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: logoSize,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: -0.9,
          color: "white",
        }}
      >
        TixSwap
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: subSize,
          color: "rgba(255,255,255,0.88)",
        }}
      >
        Reventa segura
      </div>
    </div>
  );
}

function TicketPriceBlock({
  labelSize,
  priceSize,
  priceLabel,
}: {
  labelSize: number;
  priceSize: number;
  priceLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: labelSize,
          fontWeight: 600,
          color: "rgba(255,255,255,0.78)",
          textTransform: "uppercase",
          letterSpacing: 1.2,
        }}
      >
        Precio
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: priceSize,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: -1.8,
          color: "white",
        }}
      >
        {priceLabel || "Consultar"}
      </div>
    </div>
  );
}

export function ShareImage({
  kind,
  variant,
  eventName,
  eventDate,
  venue,
  city,
  ticket,
  backgroundSrc = null,
  debugLabel = null,
}: ShareImageProps) {
  const config = VARIANT_CONFIG[variant];
  const isTicket = kind === "ticket";
  const eventTitle = truncateText(eventName || "Evento", config.maxTitleChars);
  const titleSize = resolveTitleSize(config.titleSize, eventTitle);
  const dateLabel = formatEventDateLabel(eventDate);
  const timeLabel = formatEventTimeLabel(eventDate);
  const dateTimeLabel = [dateLabel, timeLabel].filter(Boolean).join(" · ");
  const locationLabel = truncateText(buildEventLocationLine(venue, city), variant === "og" ? 54 : 64);
  const seatLabel = truncateText(buildTicketSeatLabel(ticket || {}), variant === "og" ? 48 : 58);
  const priceLabel = formatCLP(getTicketPrice(ticket || {}));
  const footerText =
    variant === "story"
      ? "Link en sticker"
      : "Compra protegida · Disputas con evidencia";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#020617",
        color: "white",
      }}
    >
      <PosterBackdrop backgroundSrc={backgroundSrc} variant={variant} />

      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: `${config.paddingTop}px ${config.paddingX}px ${config.paddingBottom}px`,
        }}
      >
        <BrandHeader logoSize={config.logoSize} subSize={config.logoSubSize} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            maxWidth: config.maxContentWidth,
            alignSelf: variant === "post" ? "center" : "flex-start",
            gap: variant === "og" ? 14 : 18,
          }}
        >
          {isTicket && priceLabel ? (
            <TicketPriceBlock
              labelSize={variant === "og" ? 18 : 24}
              priceSize={config.priceSize}
              priceLabel={priceLabel}
            />
          ) : null}

          <div
            style={{
              fontSize: titleSize,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: -2.1,
            }}
          >
            {eventTitle}
          </div>

          {dateTimeLabel ? (
            <div
              style={{
                fontSize: config.metaSize,
                lineHeight: 1.25,
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {dateTimeLabel}
            </div>
          ) : null}

          {locationLabel ? (
            <div
              style={{
                fontSize: config.metaSize,
                lineHeight: 1.25,
                color: "rgba(255,255,255,0.86)",
              }}
            >
              {locationLabel}
            </div>
          ) : null}

          {isTicket && seatLabel ? (
            <div
              style={{
                fontSize: Math.max(config.footerSize, 20),
                lineHeight: 1.25,
                color: "rgba(255,255,255,0.84)",
              }}
            >
              {seatLabel}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 10,
              marginTop: variant === "og" ? 6 : 12,
            }}
          >
            <div
              style={{
                fontSize: config.footerSize,
                color: "rgba(255,255,255,0.86)",
                fontWeight: 500,
              }}
            >
              {footerText}
            </div>
            {variant === "story" ? (
              <div
                style={{
                  fontSize: config.footerSize,
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                Compra protegida · Disputas con evidencia
              </div>
            ) : null}
          </div>
        </div>

        {debugLabel ? (
          <div
            style={{
              position: "absolute",
              right: config.paddingX,
              bottom: Math.max(28, config.paddingBottom - 6),
              fontSize: Math.max(16, config.footerSize - 4),
              color: "rgba(255,255,255,0.68)",
              letterSpacing: 1,
            }}
          >
            {debugLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
