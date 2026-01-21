// lib/ticket-parsers/puntoticket.js
// Parser MVP para PuntoTicket

const MONTHS_ES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

export function detect(text) {
  const t = (text || "").toLowerCase();
  return t.includes("punto ticket") || t.includes("puntoticket") || t.includes("punto ticket spa");
}

function parseDateEsToISO(text) {
  // Ejemplo: "Martes, 25 De Marzo 2025 / 21:00 Hrs"
  const t = (text || "").toLowerCase();
  const m = t.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(\d{4}).*?(\d{1,2}:\d{2})/i);
  if (!m) return null;
  const day = Number(m[1]);
  const monthName = m[2].normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const year = Number(m[3]);
  const time = m[4];
  const month = MONTHS_ES[monthName] || null;
  if (!month) return null;
  const [hh, mm] = time.split(":").map((x) => Number(x));
  const date = new Date(Date.UTC(year, month - 1, day, hh, mm, 0));
  return date.toISOString();
}

export function parse(text) {
  const t = text || "";
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // ticket_number: primer match de 13+ dígitos
  const ticketMatch = t.match(/\b(\d{13,})\b/);
  const ticket_number = ticketMatch ? ticketMatch[1] : null;

  // order_number: 7-10 dígitos distinto de ticket_number
  const orderMatchAll = Array.from(t.matchAll(/\b(\d{7,10})\b/g)).map((m) => m[1]);
  const order_number = (orderMatchAll.find((x) => x !== ticket_number) || null);

  // venue: línea que contenga palabras típicas
  const venue = lines.find((l) => /estadio|arena|teatro|movistar|club|centro|coliseo/i.test(l)) || null;

  // event_name: heurística: línea anterior a venue o primera línea larga con separadores
  let event_name = null;
  if (venue) {
    const idx = lines.findIndex((l) => l === venue);
    if (idx > 0) event_name = lines[idx - 1];
  }
  if (!event_name) {
    event_name = lines.find((l) => /\s-\s|clasificatorias|tour|festival|vs\./i.test(l)) || lines[0] || null;
  }

  // sector / category: buscar palabras comunes
  const sector = lines.find((l) => /sector|pacifico|and(es)|cancha|sur|norte|poniente|oriente/i.test(l)) || null;
  const category = lines.find((l) => /general|platea|vip|gold|silver|bronze/i.test(l)) || null;

  // fecha y hora
  const dateLine = lines.find((l) => /(lunes|martes|miércoles|jueves|viernes|sábado|domingo)/i.test(l)) ||
    lines.find((l) => /\d{1,2}\s+de\s+[a-záéíóú]+\s+\d{4}/i.test(l)) || null;
  const event_datetime_iso = dateLine ? parseDateEsToISO(dateLine) : null;

  // asistente (nombre + rut)
  const rutMatch = t.match(/(\d{1,2}\.?\d{3}\.\d{3}-[0-9kK])/);
  const attendee_rut = rutMatch ? rutMatch[1] : null;
  let attendee_name = null;
  if (attendee_rut) {
    // tomar la línea que contiene el rut y la anterior como nombre probable
    const idx = lines.findIndex((l) => l.includes(attendee_rut));
    if (idx > 0) attendee_name = lines[idx - 1];
  }

  // productor si aparece
  const producerLine = lines.find((l) => /productor|productora|producer/i.test(l)) || null;
  let producer_name = null;
  let producer_rut = null;
  if (producerLine) {
    producer_name = producerLine.replace(/.*?:\s*/i, "");
    const pr = producerLine.match(/(\d{1,2}\.?\d{3}\.\d{3}-[0-9kK])/);
    if (pr) producer_rut = pr[1];
  }

  return {
    provider: "puntoticket",
    ticket_number,
    order_number,
    event_name,
    event_datetime_iso,
    venue,
    sector,
    category,
    attendee_name,
    attendee_rut,
    producer_name,
    producer_rut,
  };
}

export function validate(parsed) {
  const errs = [];
  if (!parsed?.ticket_number) errs.push("Falta ticket_number");
  if (!parsed?.event_name) errs.push("Falta nombre del evento");
  if (!parsed?.event_datetime_iso) errs.push("Falta fecha/hora del evento");
  if (!parsed?.venue) errs.push("Falta recinto/venue");
  return errs;
}
