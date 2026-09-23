import { Email } from "@convex-dev/auth/providers/Email";
import { alphabet, generateRandomString } from "oslo/crypto";
import { sendOtpEmail } from "../../lib/sendOtpEmail";

// Endpoint and key for the Freebuff email relay.
// FREEBUFF_EMAIL_API_KEY must be configured via the project Keys/API keys UI
// (it is injected as process.env at deploy time).
const OTP_ENDPOINT =
  process.env.FREEBUFF_EMAIL_OTP_URL ?? "https://auth.freebuff.app/send_otp";
const OTP_API_KEY = process.env.FREEBUFF_EMAIL_API_KEY;


export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  generateVerificationToken() {
    return generateRandomString(6, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, token }) {
    if (!OTP_API_KEY) {
      throw new Error(
        "FREEBUFF_EMAIL_API_KEY is not configured. Set it in the project Keys/API keys UI.",
      );
    }
    await sendOtpEmail({
      to: email,
      otp: token,
      appName: process.env.APP_NAME || "AgriVikas",
      endpoint: OTP_ENDPOINT,
      apiKey: OTP_API_KEY,
    });
  },
});
