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

  // order_number: buscar "N° de orden" o patrón de 7-10 dígitos diferente de ticket
  let order_number = null;
  const orderLineMatch = t.match(/N°\s*de\s*orden[:\s]*(\d{7,10})/i);
  if (orderLineMatch) {
    order_number = orderLineMatch[1];
  } else {
    const orderMatchAll = Array.from(t.matchAll(/\b(\d{7,10})\b/g)).map((m) => m[1]);
    order_number = (orderMatchAll.find((x) => x !== ticket_number) || null);
  }

  // venue: buscar "Estadio Nacional" u otros venues conocidos
  let venue = null;
  const venueMatch = t.match(/(Estadio\s*Nacional|Arena\s*Movistar|Teatro\s*Caupolicán|Movistar\s*Arena|Club\s*Hípico)/i);
  if (venueMatch) {
    venue = venueMatch[1].replace(/\s+/g, ' ').trim();
  }

  // event_name: buscar patrones comunes
  // 1. Buscar líneas con "CLASIFICATORIAS", "MUNDIAL", "VS", etc.
  let event_name = null;
  const eventMatch = t.match(/(LA\s*ROJA[^\.]+MUNDIAL\s*\d{4}|[A-Z\s]+VS\.?\s*[A-Z\s]+[-\s]*Clasificatorias\s*\d{4}|Chile\s*Vs\.?\s*[A-Z][a-z]+\s*[-\s]*Clasificatorias\s*\d{4})/i);
  if (eventMatch) {
    event_name = eventMatch[1].replace(/\s+/g, ' ').trim();
  } else {
    // Fallback: línea antes de venue o línea con separadores
    const idx = lines.findIndex((l) => l.match(/estadio|arena|teatro/i));
    if (idx > 0) event_name = lines[idx - 1];
    if (!event_name) {
      event_name = lines.find((l) => /\s-\s|clasificatorias|tour|festival|vs\.?/i.test(l)) || lines[0] || null;
    }
  }

  // sector: buscar "CODO", "PACIFICO", "ANDES", "CANCHA", etc.
  let sector = null;
  const sectorMatch = t.match(/(CODO\s*PACIFICO\s*SUR|CODO\s*ANDES|CANCHA\s*[A-Z]+|SECTOR\s*[A-Z0-9]+|PACIFICO\s*[A-Z]+|ANDES\s*[A-Z]+)/i);
  if (sectorMatch) {
    sector = sectorMatch[1].replace(/\s+/g, ' ').trim();
  }

  const category = lines.find((l) => /^(GENERAL|PLATEA|VIP|GOLD|SILVER|BRONZE)$/i.test(l)) || null;

  // fecha y hora: buscar patrón explícito
  const dateMatch = t.match(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo),?\s*\d{1,2}\s+De\s+([A-Záéíóú]+)\s+(\d{4})\s*\/?\s*(\d{1,2}:\d{2})\s*Hrs?/i);
  let event_datetime_iso = null;
  if (dateMatch) {
    event_datetime_iso = parseDateEsToISO(dateMatch[0]);
  }

  // asistente: buscar nombre antes del RUT
  const rutMatch = t.match(/(\d{1,2}\.?\d{3}\.\d{3}-[0-9kK])/);
  const attendee_rut = rutMatch ? rutMatch[1] : null;
  let attendee_name = null;
  if (attendee_rut) {
    // Buscar "Nombre:" seguido del nombre
    const nameMatch = t.match(/Nombre:\s*([A-ZÁÉÍÓÚÑ\s]+)\s*RUT:/i);
    if (nameMatch) {
      attendee_name = nameMatch[1].trim();
    } else {
      // Fallback: línea anterior al RUT
      const idx = lines.findIndex((l) => l.includes(attendee_rut));
      if (idx > 0) {
        const prevLine = lines[idx - 1];
        // Ignorar si es precio o número
        if (!/^\$\d|^\d{5,}/.test(prevLine)) {
          attendee_name = prevLine;
        }
      }
    }
  }

  // productor: buscar "Produce:" o "Productora:"
  let producer_name = null;
  let producer_rut = null;
  const producerMatch = t.match(/Produc(?:e|tora):\s*([A-Záéíóúñ\s]+?)(?:\s*RUT|$)/i);
  if (producerMatch) {
    producer_name = producerMatch[1].trim();
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
  // Hacer event_datetime_iso opcional por ahora para debuggear
  // if (!parsed?.event_datetime_iso) errs.push("Falta fecha/hora del evento");
  if (!parsed?.venue) errs.push("Falta recinto/venue");
  return errs;
}
