import axios, { type AxiosInstance } from "axios";

/**
 * Parameters for sending an OTP email through the Freebuff email relay.
 */
export interface SendOtpEmailParams {
  /** Recipient email address. */
  to: string;
  /** One-time verification code. */
  otp: string;
  /** App name shown in the email. */
  appName: string;
  /** Email relay endpoint. */
  endpoint: string;
  /** API key for the email relay. */
  apiKey: string;
  /** Request timeout in milliseconds. Defaults to 10s. */
  timeoutMs?: number;
  /** HTTP client to use. Injected for testability; defaults to axios. */
  client?: AxiosInstance;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Sends an OTP email via the Freebuff email relay.
 *
 * Throws an Error with a safe, human-readable message on failure. The error
 * never includes the raw axios error (which contains the full request config,
 * including headers such as the API key, and can also fail to JSON-serialize
 * due to circular references).
 */
export async function sendOtpEmail({
  to,
  otp,
  appName,
  endpoint,
  apiKey,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  client = axios,
}: SendOtpEmailParams): Promise<void> {
  try {
    await client.post(
      endpoint,
      { to, otp, appName },
      {
        headers: { "x-api-key": apiKey },
        timeout: timeoutMs,
      },
    );
  } catch (error) {
    throw new Error(toOtpErrorMessage(error));
  }
}

/**
 * Converts an unknown error into a safe, readable message.
 * Never serializes the axios error object (config/request/response can contain
 * secrets and circular references).
 */
export function toOtpErrorMessage(error: unknown): string {
  let detail: string | undefined;
  let status: number | undefined;

  if (axios.isAxiosError(error)) {
    status = error.response?.status;
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) {
      detail = data.trim();
    } else if (data && typeof data === "object") {
      const maybe =
        (data as { message?: unknown }).message ??
        (data as { error?: unknown }).error;
      if (typeof maybe === "string" && maybe) detail = maybe;
    }
    if (!detail && error.message) detail = error.message;
  } else if (error instanceof Error) {
    detail = error.message;
  } else {
    detail = String(error);
  }

  const prefix = `Failed to send OTP email${
    status !== undefined ? ` (HTTP ${status})` : ""
  }`;
  return detail ? `${prefix}: ${detail}` : prefix;
}
