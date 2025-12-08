// app/events/[id]/page.jsx
"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { EVENTS } from "../../lib/events";
import { getListingsByEvent } from "../../lib/listings";

function formatCurrencyCLP(value) {
  return value.toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  });
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();

  const eventId =
    typeof params?.id === "string" ? params.id : params?.id?.[0] || "";

  const event = EVENTS.find((e) => e.id === eventId);

  const [sectorFilter, setSectorFilter] = useState("all");
  const [sort, setSort] = useState("price-asc");

  const listingsForEvent = useMemo(
    () => (event ? getListingsByEvent(event.id) : []),
    [event]
  );

  const availableSectors = useMemo(() => {
    const set = new Set(listingsForEvent.map((l) => l.sector));
    return Array.from(set);
  }, [listingsForEvent]);

  const sortedListings = useMemo(() => {
    let result = [...listingsForEvent];

    if (sectorFilter !== "all") {
      result = result.filter((l) => l.sector === sectorFilter);
    }

    if (sort === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sort === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    } else if (sort === "newest") {
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return result;
  }, [listingsForEvent, sectorFilter, sort]);

  if (!event) {
    return (
      <main>
        <Header />
        <section className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-gray-600">Evento no encontrado.</p>
          <button
            className="mt-4 text-blue-600 text-sm"
            onClick={() => router.push("/")}
          >
            ← Volver al inicio
          </button>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <Header />

      <section className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <button
            className="text-sm text-blue-600 hover:underline"
            onClick={() => router.back()}
          >
            ← Volver
          </button>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {event.title}
              </h1>
              <p className="mt-2 text-gray-700">
                📅 {event.date}
