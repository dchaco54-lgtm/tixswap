import { redirect } from "next/navigation";

export default function SoporteTicketRedirect({ params }) {
  const id = params?.ticketId;
  redirect(id ? `/dashboard/tickets?ticketId=${id}` : "/dashboard/tickets");
}
