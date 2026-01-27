// components/StarRating.jsx
export default function StarRating({
  value = 0,
  max = 5,
  text = "",
  size = 16,
  className = "",
}) {
  const v = Number(value);
  const safe = Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  const rounded = Math.round(safe * 2) / 2; // redondeo en 0.5

  return (
    <div className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <div className="inline-flex items-center" aria-label={`Rating ${safe} de ${max}`}>
        {Array.from({ length: max }).map((_, idx) => {
          const i = idx + 1;
          const variant =
            rounded >= i ? "full" : rounded >= i - 0.5 ? "half" : "empty";
          return <Star key={i} variant={variant} size={size} />;
        })}
      </div>

      {text ? (
        <span className="text-sm font-semibold text-slate-700">{text}</span>
      ) : null}
    </div>
  );
}

function Star({ variant, size }) {

  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className: "shrink-0",
    "aria-hidden": true,
  };

  const path = (
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  );

  if (variant === "half") {
    return (
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <svg
          {...common}
          className="absolute inset-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "#cbd5e1" }}
        >
          {path}
        </svg>

        <span className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
          <svg {...common} fill="currentColor" style={{ color: "#f59e0b" }}>
            {path}
          </svg>
        </span>
      </span>
    );
  }

  if (variant === "full") {
    return (
      <svg {...common} fill="currentColor" style={{ color: "#f59e0b" }}>
        {path}
      </svg>
    );
  }

  return (
    <svg
      {...common}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      style={{ color: "#cbd5e1" }}
    >
      {path}
    </svg>
  );
}
