import { redirect } from "next/navigation";

export default function ListingIdRedirect({ params }) {
  redirect(`/dashboard/publications/${params.id}`);
}
