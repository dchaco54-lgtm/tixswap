/**
 * Utilidades de formateo para cliente (no son server actions)
 */

/**
 * Formatear RUT para display: XX.XXX.XXX-K
 */
export function formatRutForDisplay(rut) {
  if (!rut) return null;
  const cleaned = rut.replace(/[^\dKk]/g, '').toUpperCase();
  if (cleaned.length < 8) return rut;
  const body = cleaned.slice(0, -1);
  const dv = cleaned[cleaned.length - 1];
  return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5)}-${dv}`;
}

/**
 * Enmascarar email: user***@domain
 */
export function formatEmailForDisplay(email) {
  if (!email) return null;
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  if (user.length <= 2) return email;
  return `${user.slice(0, 2)}***@${domain}`;
}
