"use client";

export function trackEvent(eventName, payload = {}) {
  if (typeof window === "undefined") return;

  const eventPayload = {
    event: eventName,
    ...payload,
  };

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push(eventPayload);
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, payload);
    }

    window.dispatchEvent(
      new CustomEvent("tixswap:track", {
        detail: eventPayload,
      })
    );
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics] trackEvent error:", error);
    }
  }
}
