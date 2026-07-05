import twilio from "twilio";

let cachedClient: ReturnType<typeof twilio> | null = null;

/**
 * Lazily builds the Twilio client from server-only env vars. Only ever
 * imported from "use server" action modules, so the account SID/auth token
 * never reach the client bundle.
 */
export function getTwilioClient() {
  if (cachedClient) return cachedClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials are not configured.");
  }

  cachedClient = twilio(accountSid, authToken);
  return cachedClient;
}

export function getTwilioFromNumber(): string {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured.");
  }
  return from;
}
