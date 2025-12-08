// app/lib/events.js
// Lista central de eventos TixSwap
// OJO: este archivo NO cambia tu diseño, solo el orden de los datos.

const RAW_EVENTS = [
  // ENERO 2026
  {
    id: "my-chem-2026-01-29",
    title: "My Chemical Romance",
    category: "Rock",
    date: "29 de enero de 2026, 21:00",
    dateISO: "2026-01-29T21:00:00",
    location: "Estadio Bicentenario de La Florida — Santiago, Chile",
  },

  // FEBRERO 2026
  {
    id: "chayanne-2026-02-07-conce",
    title: "Chayanne",
    category: "Pop latino",
    date: "7 de febrero de 2026, 21:00",
    dateISO: "2026-02-07T21:00:00",
    location: "Estadio Ester Roa — Concepción, Chile",
  },
  {
    id: "doja-2026-02-10",
    title: "Doja Cat",
    category: "Pop / Hip Hop",
    date: "10 de febrero de 2026, 21:00",
    dateISO: "2026-02-10T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "galneryus-2026-02-13",
    title: "GALNERYUS",
    category: "Metal",
    date: "13 de febrero de 2026, 21:00",
    dateISO: "2026-02-13T21:00:00",
    location: "Teatro Cariola — Santiago, Chile",
  },
  {
    id: "chayanne-2026-02-11-stgo",
    title: "Chayanne",
    category: "Pop latino",
    date: "11 de febrero de 2026, 21:00",
    dateISO: "2026-02-11T21:00:00",
    location: "Estadio Nacional de Chile — Santiago, Chile",
  },
  {
    id: "chayanne-2026-02-14-vina",
    title: "Chayanne",
    category: "Pop latino",
    date: "14 de febrero de 2026, 21:00",
    dateISO: "2026-02-14T21:00:00",
    location: "Viña del Mar — Valparaíso, Chile",
  },
  {
    id: "jason-mraz-2026-02-25",
    title: "Jason Mraz",
    category: "Pop",
    date: "25 de febrero de 2026, 21:00",
    dateISO: "2026-02-25T21:00:00",
    location: "Teatro Caupolicán — Santiago, Chile",
  },
  {
    id: "alejandro-sanz-2026-02-28",
    title: "Alejandro Sanz",
    category: "Pop",
    date: "28 de febrero de 2026, 21:00",
    dateISO: "2026-02-28T21:00:00",
    location: "Estadio Bicentenario de La Florida — Santiago, Chile",
  },

  // MARZO 2026
  {
    id: "acdc-2026-03-11",
    title: "AC/DC",
    category: "Rock",
    date: "11 de marzo de 2026, 19:00",
    dateISO: "2026-03-11T19:00:00",
    location: "Parque Estadio Nacional — Santiago, Chile",
  },
  {
    id: "kali-uchis-2026-03-11",
    title: "Kali Uchis",
    category: "R&B / Pop",
    date: "11 de marzo de 2026, 20:00",
    dateISO: "2026-03-11T20:00:00",
    location: "Parque Deportivo Estadio Nacional — Santiago, Chile",
  },
  {
    id: "lolla-2026-03-13",
    title: "Lollapalooza Chile 2026",
    category: "Festival",
    date: "13–15 de marzo de 2026",
    dateISO: "2026-03-13T12:00:00",
    location: "Parque O'Higgins — Santiago, Chile",
  },
  {
    id: "acdc-2026-03-15",
    title: "AC/DC",
    category: "Rock",
    date: "15 de marzo de 2026, 19:00",
    dateISO: "2026-03-15T19:00:00",
    location: "Parque Estadio Nacional — Santiago, Chile",
  },
  {
    id: "pennywise-2026-03-20",
    title: "Pennywise",
    category: "Punk",
    date: "20 de marzo de 2026, 21:00",
    dateISO: "2026-03-20T21:00:00",
    location: "Teatro Caupolicán — Santiago, Chile",
  },
  {
    id: "soda-2026-03-26",
    title: "Soda Stereo",
    category: "Rock",
    date: "26 de marzo de 2026, 21:00",
    dateISO: "2026-03-26T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "soda-2026-03-27",
    title: "Soda Stereo",
    category: "Rock",
    date: "27 de marzo de 2026, 21:00",
    dateISO: "2026-03-27T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "soda-2026-03-28",
    title: "Soda Stereo",
    category: "Rock",
    date: "28 de marzo de 2026, 21:00",
    dateISO: "2026-03-28T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },

  // ABRIL 2026
  {
    id: "ysy-a-2026-04-01",
    title: "Ysy A",
    category: "Trap",
    date: "1 de abril de 2026, 21:00",
    dateISO: "2026-04-01T21:00:00",
    location: "Espacio Riesco — Santiago, Chile",
  },
  {
    id: "respira-2026-04-03",
    title: "Respira Festival",
    category: "Festival",
    date: "3 de abril de 2026, 21:00",
    dateISO: "2026-04-03T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "redbull-2026-04-11",
    title: "Red Bull Batalla - Final Internacional 2026",
    category: "Freestyle",
    date: "11 de abril de 2026, 21:00",
    dateISO: "2026-04-11T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "laura-pausini-2026-04-15",
    title: "Laura Pausini",
    category: "Pop",
    date: "15 de abril de 2026, 19:00",
    dateISO: "2026-04-15T19:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "laura-pausini-2026-04-16",
    title: "Laura Pausini",
    category: "Pop",
    date: "16 de abril de 2026, 19:00",
    dateISO: "2026-04-16T19:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "mac-demarco-2026-04-18",
    title: "Mac DeMarco",
    category: "Indie",
    date: "18 de abril de 2026, 19:00",
    dateISO: "2026-04-18T19:00:00",
    location: "Teatro Caupolicán — Santiago, Chile",
  },
  {
    id: "mac-demarco-2026-04-19",
    title: "Mac DeMarco",
    category: "Indie",
    date: "19 de abril de 2026, 21:00",
    dateISO: "2026-04-19T21:00:00",
    location: "Teatro Caupolicán — Santiago, Chile",
  },
  {
    id: "feuerschwanz-2026-04-21",
    title: "Feuerschwanz",
    category: "Metal",
    date: "21 de abril de 2026, 21:00",
    dateISO: "2026-04-21T21:00:00",
    location: "Teatro Cariola — Santiago, Chile",
  },
  {
    id: "ill-nino-2026-04-26",
    title: "Ill Niño",
    category: "Metal",
    date: "26 de abril de 2026, 21:00",
    dateISO: "2026-04-26T21:00:00",
    location: "Teatro Cariola — Santiago, Chile",
  },
  {
    id: "black-label-2026-04-30",
    title: "Black Label Society",
    category: "Metal",
    date: "30 de abril de 2026, 21:00",
    dateISO: "2026-04-30T21:00:00",
    location: "Teatro Coliseo — Santiago, Chile",
  },

  // MAYO 2026
  {
    id: "pod-2026-05-04",
    title: "P.O.D.",
    category: "Rock / Nu Metal",
    date: "4 de mayo de 2026, 21:00",
    dateISO: "2026-05-04T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
  {
    id: "pimpinela-2026-05-17",
    title: "Pimpinela",
    category: "Baladas",
    date: "17 de mayo de 2026, 21:00",
    dateISO: "2026-05-17T21:00:00",
    location: "Movistar Arena — Santiago, Chile",
  },
];

// Exportamos ya ordenados por fecha
export const EVENTS = [...RAW_EVENTS].sort(
  (a, b) => new Date(a.dateISO) - new Date(b.dateISO)
);
