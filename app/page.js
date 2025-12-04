// app/page.js
export const dynamic = "force-dynamic";

import Header from "./components/Header";
import Hero from "./components/Hero";
import Categories from "./components/Categories";
import EventGrid from "./components/EventGrid";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function Home() {
  const featuredEvents = [
    {
      id: 1,
      title: "My Chemical Romance",
      category: "Rock",
      date: "29 de enero de 2026",
      location: "Estadio Bicentenario La Florida",
    },
    {
      id: 2,
      title: "Chayanne",
      category: "Pop Latino",
      date: "7 de febrero de 2026",
      location: "Concepción",
    },
    {
      id: 3,
      title: "Doja Cat",
      category: "Hip Hop",
      date: "10 de febrero de 2026",
      location: "Movistar Arena",
    },
  ];

  return (
    <main>
      {/* Header maneja toda la navegación + login/logout */}
      <Header />

      {/* Resto de la landing */}
      <Hero />
      <Categories />
      <EventGrid events={featuredEvents} />
      <CTA />
      <Footer />
    </main>
  );
}
