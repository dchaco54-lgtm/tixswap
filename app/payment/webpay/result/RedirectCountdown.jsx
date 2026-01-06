"use client";

import { useEffect, useState } from "react";

export default function RedirectCountdown({ seconds = 5, redirectUrl = "/" }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) {
      window.location.href = redirectUrl;
      return;
    }

    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, redirectUrl]);

  return (
    <p className="text-sm text-gray-500">
      Redirigiendo en {remaining}...
    </p>
  );
}
