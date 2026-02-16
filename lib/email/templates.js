import { escapeHtml } from "./resend";

function safeName(value) {
  const name = String(value || "").trim();
  return name || null;
}

function greeting(name) {
  const n = safeName(name);
  return n ? `Hola ${escapeHtml(n)}` : "Hola";
}

function formatClp(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return `$${num.toLocaleString("es-CL")}`;
}

function buildSeatInfo({ sector, sectionLabel, rowLabel, seatLabel }) {
  const parts = [];
  if (sector) parts.push(`Sector: ${escapeHtml(sector)}`);
  if (sectionLabel) parts.push(`Seccion: ${escapeHtml(sectionLabel)}`);
  if (rowLabel) parts.push(`Fila: ${escapeHtml(rowLabel)}`);
  if (seatLabel) parts.push(`Asiento: ${escapeHtml(seatLabel)}`);
  if (!parts.length) return null;
  return parts.join(" / ");
}

export function templateTicketPublished({
  sellerName,
  ticketId,
  eventName,
  price,
  link,
  sector,
  sectionLabel,
  rowLabel,
  seatLabel,
}) {
  const lines = [];
  if (eventName) lines.push(`<p><b>Evento:</b> ${escapeHtml(eventName)}</p>`);
  if (ticketId) lines.push(`<p><b>Ticket:</b> ${escapeHtml(ticketId)}</p>`);

  if (price !== null && price !== undefined) {
    const formatted = formatClp(price) || String(price);
    lines.push(`<p><b>Precio:</b> ${escapeHtml(formatted)}</p>`);
  }

  const seatInfo = buildSeatInfo({ sector, sectionLabel, rowLabel, seatLabel });
  if (seatInfo) lines.push(`<p><b>Ubicacion:</b> ${seatInfo}</p>`);

  const safeLink = link ? escapeHtml(link) : null;

  return {
    subject: "TixSwap - Tu entrada quedo publicada",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Tu entrada quedo publicada</h2>
        <p>${greeting(sellerName)}</p>
        ${lines.join("")}
        ${safeLink ? `<p><a href="${safeLink}">Ver publicacion</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateSellRequestReceived({
  sellerName,
  requestedEventName,
  requestId,
  link,
}) {
  const safeEvent = requestedEventName ? escapeHtml(requestedEventName) : null;
  const safeLink = link ? escapeHtml(link) : null;

  return {
    subject: "TixSwap - Recibimos tu solicitud",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Recibimos tu solicitud</h2>
        <p>${greeting(sellerName)}</p>
        ${safeEvent ? `<p><b>Evento solicitado:</b> ${safeEvent}</p>` : ""}
        ${requestId ? `<p><b>ID solicitud:</b> ${escapeHtml(requestId)}</p>` : ""}
        <p>Esto puede tardar 24–48 horas. Te avisaremos por correo. Cuando el evento esté creado, publicaremos tu entrada automáticamente.</p>
        ${safeLink ? `<p><a href="${safeLink}">Ir a TixSwap</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

function supportSlaCopy(category) {
  const c = String(category || "").toLowerCase().trim();
  if (c === "disputa_compra" || c === "disputa_venta") {
    return "Esto puede demorar más por revisión, pero buscamos darte un primer contacto lo antes posible.";
  }
  return "Respuesta estimada: 24–48 horas.";
}

export function templateSupportTicketCreated({
  requesterName,
  ticketNumber,
  ticketId,
  category,
  subject,
  link,
}) {
  const safeSubject = subject ? escapeHtml(subject) : null;
  const safeLink = link ? escapeHtml(link) : null;
  const sla = supportSlaCopy(category);
  const idText = ticketNumber ? `TS-${ticketNumber}` : ticketId ? escapeHtml(ticketId) : null;

  return {
    subject: "TixSwap - Recibimos tu ticket",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Recibimos tu ticket</h2>
        <p>${greeting(requesterName)}</p>
        ${idText ? `<p><b>Ticket:</b> ${escapeHtml(idText)}</p>` : ""}
        ${safeSubject ? `<p><b>Asunto:</b> ${safeSubject}</p>` : ""}
        <p>${escapeHtml(sla)}</p>
        ${safeLink ? `<p><a href="${safeLink}">Ver ticket en TixSwap</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateSupportNewMessageToUser({
  ticketNumber,
  subject,
  message,
  link,
}) {
  const safeSubject = subject ? escapeHtml(subject) : null;
  const safeLink = link ? escapeHtml(link) : null;
  const snippet = message ? escapeHtml(message).slice(0, 600).replace(/\n/g, "<br/>") : "";

  return {
    subject: `TixSwap - Respondimos tu ticket TS-${ticketNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Respondimos tu ticket TS-${escapeHtml(ticketNumber)}</h2>
        ${safeSubject ? `<p><b>Asunto:</b> ${safeSubject}</p>` : ""}
        ${snippet ? `<p>${snippet}</p>` : "<p>Tienes una nueva respuesta de soporte.</p>"}
        ${safeLink ? `<p><a href="${safeLink}">Ver ticket en TixSwap</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateSupportNewMessageToInbox({
  ticketNumber,
  subject,
  message,
  requesterEmail,
  requesterName,
  category,
  link,
}) {
  const safeSubject = subject ? escapeHtml(subject) : null;
  const safeLink = link ? escapeHtml(link) : null;
  const snippet = message ? escapeHtml(message).slice(0, 1000).replace(/\n/g, "<br/>") : "";
  const who = requesterName ? escapeHtml(requesterName) : requesterEmail ? escapeHtml(requesterEmail) : "Usuario";

  return {
    subject: `TixSwap - Nuevo mensaje TS-${ticketNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Nuevo mensaje TS-${escapeHtml(ticketNumber)}</h2>
        <p><b>Usuario:</b> ${who}</p>
        ${safeSubject ? `<p><b>Asunto:</b> ${safeSubject}</p>` : ""}
        ${category ? `<p><b>Categoría:</b> ${escapeHtml(category)}</p>` : ""}
        ${snippet ? `<p>${snippet}</p>` : ""}
        ${safeLink ? `<p><a href="${safeLink}">Ir al panel</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateSupportNewTicketToInbox({
  ticketNumber,
  subject,
  message,
  requesterEmail,
  requesterName,
  category,
  link,
}) {
  const safeSubject = subject ? escapeHtml(subject) : null;
  const safeLink = link ? escapeHtml(link) : null;
  const snippet = message ? escapeHtml(message).slice(0, 1000).replace(/\n/g, "<br/>") : "";
  const who = requesterName ? escapeHtml(requesterName) : requesterEmail ? escapeHtml(requesterEmail) : "Usuario";

  return {
    subject: `TixSwap - Nuevo ticket TS-${ticketNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Nuevo ticket TS-${escapeHtml(ticketNumber)}</h2>
        <p><b>Usuario:</b> ${who}</p>
        ${safeSubject ? `<p><b>Asunto:</b> ${safeSubject}</p>` : ""}
        ${category ? `<p><b>Categoría:</b> ${escapeHtml(category)}</p>` : ""}
        ${snippet ? `<p>${snippet}</p>` : ""}
        ${safeLink ? `<p><a href="${safeLink}">Ir al panel</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateOrderPaidBuyer({
  buyerName,
  eventName,
  totalClp,
  orderId,
  link,
}) {
  const safeEvent = eventName ? escapeHtml(eventName) : null;
  const safeLink = link ? escapeHtml(link) : null;
  const formattedTotal = formatClp(totalClp);

  return {
    subject: "TixSwap - Compra confirmada",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Compra confirmada</h2>
        <p>${greeting(buyerName)}</p>
        ${safeEvent ? `<p><b>Evento:</b> ${safeEvent}</p>` : ""}
        ${orderId ? `<p><b>Orden:</b> ${escapeHtml(orderId)}</p>` : ""}
        ${formattedTotal ? `<p><b>Total:</b> ${escapeHtml(formattedTotal)}</p>` : ""}
        ${safeLink ? `<p><a href="${safeLink}">Ver compra</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateOrderPaidSeller({
  sellerName,
  eventName,
  amountClp,
  orderId,
  ticketId,
  link,
}) {
  const safeEvent = eventName ? escapeHtml(eventName) : null;
  const safeLink = link ? escapeHtml(link) : null;
  const formattedAmount = formatClp(amountClp);

  return {
    subject: "TixSwap - Vendiste tu entrada",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Vendiste tu entrada</h2>
        <p>${greeting(sellerName)}</p>
        ${safeEvent ? `<p><b>Evento:</b> ${safeEvent}</p>` : ""}
        ${ticketId ? `<p><b>Ticket:</b> ${escapeHtml(ticketId)}</p>` : ""}
        ${orderId ? `<p><b>Orden:</b> ${escapeHtml(orderId)}</p>` : ""}
        ${formattedAmount ? `<p><b>Precio:</b> ${escapeHtml(formattedAmount)}</p>` : ""}
        ${safeLink ? `<p><a href="${safeLink}">Ver publicacion</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}

export function templateOrderChatMessage({
  recipientName,
  senderName,
  orderId,
  messageSnippet,
  link,
}) {
  const safeLink = link ? escapeHtml(link) : null;
  const snippet = messageSnippet
    ? escapeHtml(messageSnippet).replace(/\n/g, "<br/>")
    : "";

  return {
    subject: "TixSwap - Nuevo mensaje en tu orden",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px">Nuevo mensaje en tu orden</h2>
        <p>${greeting(recipientName)}</p>
        ${senderName ? `<p><b>De:</b> ${escapeHtml(senderName)}</p>` : ""}
        ${orderId ? `<p><b>Orden:</b> ${escapeHtml(orderId)}</p>` : ""}
        ${snippet ? `<p>${snippet}</p>` : ""}
        ${safeLink ? `<p><a href="${safeLink}">Ver chat</a></p>` : ""}
        <p style="color:#666;font-size:12px;margin-top:16px">Este correo es automatico.</p>
      </div>
    `,
  };
}
