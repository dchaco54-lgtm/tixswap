export function env(name) {
  const v = process.env[name];
  return v && String(v).trim().length ? String(v).trim() : null;
}

export function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to];
  const seen = new Set();
  const out = [];

  for (const item of list) {
    const email = String(item || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }

  return out;
}

export async function sendEmail({ to, subject, html, from }) {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, skipped: true };

  const recipients = normalizeRecipients(to);
  if (!recipients.length) return { ok: false, skipped: true };

  const sender =
    from ||
    env("SUPPORT_FROM_EMAIL") ||
    env("RESEND_FROM") ||
    "TixSwap <no-reply@tixswap.cl>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: sender,
      to: recipients,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text || `Resend error ${res.status}` };
  }

  const payload = await res.json().catch(() => ({}));
  return { ok: true, id: payload?.id };
}
