// app/lib/listings.js
// Mock de publicaciones (entradas) por evento.
// Más adelante esto se reemplaza por Supabase, pero ya te deja armado el flujo.

import { EVENTS } from "./events";

// Intentamos encontrar el id del evento de Chayanne en tu lista de EVENTS.
// Si no existe, usamos un fallback fijo (puedes cambiarlo luego).
const chayanneEventId =
  EVENTS.find((e) => e.title === "Chayanne")?.id || "chayanne-2026-02-07-conce";

export const SECTORS = ["Galería", "Tribuna", "Preferencial"];

export const LISTINGS = [
  {
    id: "chayanne-galeria-1",
    eventId: chayanneEventId,
    sector: "Galería",
    title: "Entrada Galería",
    price: 45000,
    currency: "CLP",
    seller: {
      id: "user-1",
      name: "Carlos Soto",
      rating: 4.9,
      ratingCount: 38,
    },
    deliveryType: "Digital (PDF)",
    description:
      "Entrada en galería. Vista general del escenario, se envía inmediatamente después de la compra por PDF.",
    createdAt: "2025-11-20T15:00:00Z",
    recommendations: [
      {
        id: "r-1",
        author: "María",
        rating: 5,
        comment:
          "Todo perfecto, me llegó al tiro y el QR funcionó sin problemas.",
        createdAt: "2025-11-22T18:30:00Z",
      },
      {
        id: "r-2",
        author: "Jorge",
        rating: 5,
        comment: "Vendedor confiable, es la segunda vez que le compro.",
        createdAt: "2025-11-25T12:10:00Z",
      },
    ],
  },
  {
    id: "chayanne-tribuna-1",
    eventId: chayanneEventId,
    sector: "Tribuna",
    title: "Entrada Tribuna Lateral",
    price: 75000,
    currency: "CLP",
    seller: {
      id: "user-2",
      name: "Ana Fernández",
      rating: 4.7,
      ratingCount: 21,
    },
    deliveryType: "Digital (Wallet / PDF)",
    description:
      "Tribuna lateral, buena vista al escenario. Entrada digital lista para transferir por la app oficial.",
    createdAt: "2025-11-21T10:15:00Z",
    recommendations: [
      {
        id: "r-3",
        author: "Diego",
        rating: 5,
        comment: "Me explicó todo súper claro, cero drama para entrar.",
        createdAt: "2025-11-26T10:00:00Z",
      },
    ],
  },
  {
    id: "chayanne-preferencial-1",
    eventId: chayanneEventId,
    sector: "Preferencial",
    title: "Entrada Preferencial",
    price: 120000,
    currency: "CLP",
    seller: {
      id: "user-3",
      name: "Paula Ríos",
      rating: 5.0,
      ratingCount: 12,
    },
    deliveryType: "Física (retiro en persona)",
    description:
      "Entrada preferencial, muy cerca del escenario. Entrega presencial en Providencia o Ñuñoa.",
    createdAt: "2025-11-23T09:00:00Z",
    recommendations: [
      {
        id: "r-4",
        author: "Constanza",
        rating: 5,
        comment:
          "Muy amable, coordinamos rápido y la entrada estaba impecable.",
        createdAt: "2025-11-28T14:20:00Z",
      },
    ],
  },
];

// Helpers
export function getListingsByEvent(eventId) {
  return LISTINGS.filter((listing) => listing.eventId === eventId);
}

export function getListingById(id) {
  return LISTINGS.find((listing) => listing.id === id) || null;
}
