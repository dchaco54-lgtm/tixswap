"use client";

// app/checkout/page.jsx
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CheckoutLegacyPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const ticketId = sp.get("ticketId");

  useEffect(() => {
    if (ticketId) router.replace(`/checkout/${ticketId}`);
    else router.replace("/events");
  }, [ticketId, router]);

  return null;
}
