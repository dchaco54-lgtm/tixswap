import { redirect } from "next/navigation";

export default function SoportePage({ searchParams }) {
  const params = new URLSearchParams(searchParams || {});
  const qs = params.toString();
  redirect(qs ? `/dashboard/tickets?${qs}` : "/dashboard/tickets");
}
