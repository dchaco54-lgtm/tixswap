import Hero from "./components/Hero";
import Categories from "./components/Categories";
import EventGrid from "./components/EventGrid";
import CTA from "./components/CTA";
import { events } from "./data/events";

export default function Home() {
  return (
    <div className="space-y-20">
      <Hero />

      {/* Categorías */}
      <Categories />

      {/* Eventos Destacados */}
      <section className="py-16">
        <h2 className="text-3xl font-bold mb-8">Eventos destacados de Chile</h2>
        <EventGrid events={events} />
      </section>

      <CTA />
    </div>
  );
}
