import { redirect } from "next/navigation";

/**
 * Ruta legacy.
 * Antes usábamos /checkout?ticket=... o /checkout?ticketId=...
 * Ahora la UX buena es /checkout/[ticketId].
 */
export default function CheckoutLegacyPage({ searchParams }) {
  const ticketId = searchParams?.ticketId || searchParams?.ticket;

  if (!ticketId) {
    redirect("/events");
  }

  redirect(`/checkout/${ticketId}`);
}
