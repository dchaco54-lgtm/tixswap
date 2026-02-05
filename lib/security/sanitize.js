const CONTROL_CHARS_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeUserText(input = "", opts = {}) {
  const maxLen = Number.isFinite(opts.maxLen) ? Number(opts.maxLen) : 3000;

  let value = String(input || "");
  value = value.replace(/\r\n?/g, "\n");
  value = value.replace(CONTROL_CHARS_REGEX, "");
  value = value.replace(/[<>]/g, "");
  value = value.trim();

  if (value.length > maxLen) {
    value = value.slice(0, maxLen);
  }

  return value;
}
