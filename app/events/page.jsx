// app/events/page.jsx
import { supabase } from "@/lib/supabaseClient";
import EventsClient from "./EventsClient";

export const revalidate = 30;

async function getEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, starts_at, venue, city, category, image_url")
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("Error cargando eventos:", error);
    return [];
  }

  return data ?? [];
}

export default async function EventsPage() {
  const events = await getEvents();
  return <EventsClient events={events} />;
}
