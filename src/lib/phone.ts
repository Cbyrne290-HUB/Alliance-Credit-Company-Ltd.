/**
 * Converts an Irish local number ("0871234567") to E.164 ("+353871234567")
 * for Twilio. Numbers already in E.164 form are passed through unchanged.
 * Returns null if the input doesn't look like a valid number, so callers
 * never hand Twilio a malformed "to" address.
 */
export function toE164Irish(raw: string): string | null {
  const trimmed = raw.trim().replace(/[\s()-]/g, "");

  if (trimmed === "") return null;

  if (trimmed.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(trimmed) ? trimmed : null;
  }

  if (trimmed.startsWith("0")) {
    const rest = trimmed.slice(1);
    return /^\d{7,10}$/.test(rest) ? `+353${rest}` : null;
  }

  return null;
}
