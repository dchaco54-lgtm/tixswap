// app/page.js
"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import EventGrid from "./components/EventGrid";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import { EVENTS } from "./lib/events";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");

  // Filtra eventos según lo que escribas en el buscador del hero
  const filteredEvents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return EVENTS;

    return EVENTS.filter((event) => {
      const haystack = `${event.title} ${event.category} ${event.location}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [searchTerm]);

  return (
    <main>
      <Header />
      <Hero searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <Categories />
      <EventGrid events={filteredEvents} />
      <CTA />
      <Footer />
    </main>
  );
}
