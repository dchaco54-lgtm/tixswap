// lib/ticket-parsers/index.js
import { detect as detectPuntoTicket, parse as parsePuntoTicket, validate as validatePuntoTicket } from './puntoticket';

export function detectProvider(text) {
  if (detectPuntoTicket(text)) return 'puntoticket';
  return null;
}

export function parseByProvider(provider, text) {
  if (provider === 'puntoticket') return parsePuntoTicket(text);
  return null;
}

export function detectProviderAndParse(text) {
  const provider = detectProvider(text);
  if (!provider) return { provider: null, parsed: null };
  const parsed = parseByProvider(provider, text);
  return { provider, parsed };
}

export function validateParsed(provider, parsed) {
  if (!provider || !parsed) return ['No se pudo parsear el ticket'];
  if (provider === 'puntoticket') return validatePuntoTicket(parsed);
  return [];
}
