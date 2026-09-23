import { describe, expect, it, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { sendOtpEmail, toOtpErrorMessage } from "./sendOtpEmail";

const ENDPOINT = "https://auth.freebuff.app/send_otp";
const API_KEY = "test-secret-key";

const baseParams = {
  to: "farmer@example.com",
  otp: "123456",
  appName: "AgriVikas",
  endpoint: ENDPOINT,
  apiKey: API_KEY,
};

function fakeClient(
  impl: (...args: unknown[]) => Promise<unknown>,
): AxiosInstance {
  return { post: vi.fn(impl) } as unknown as AxiosInstance;
}

describe("sendOtpEmail", () => {
  it("posts the OTP payload, headers, and timeout to the endpoint", async () => {
    const post = vi.fn(async () => ({ status: 200 }));
    const client = { post } as unknown as AxiosInstance;

    await sendOtpEmail({ ...baseParams, timeoutMs: 5_000, client });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      ENDPOINT,
      { to: "farmer@example.com", otp: "123456", appName: "AgriVikas" },
      expect.objectContaining({
        headers: { "x-api-key": API_KEY },
        timeout: 5_000,
      }),
    );
  });

  it("applies a 10s default timeout", async () => {
    const post = vi.fn(async () => ({ status: 200 }));
    const client = { post } as unknown as AxiosInstance;

    await sendOtpEmail({ ...baseParams, client });

    expect(post).toHaveBeenCalledWith(
      ENDPOINT,
      expect.anything(),
      expect.objectContaining({ timeout: 10_000 }),
    );
  });

  it("throws a clean error when the relay returns a non-2xx response", async () => {
    const axiosLikeError = {
      isAxiosError: true,
      message: "Request failed with status code 500",
      config: { headers: { "x-api-key": API_KEY }, url: ENDPOINT },
      response: { status: 500, data: { message: "quota exceeded" } },
    };
    const client = fakeClient(async () => {
      throw axiosLikeError;
    });

    await expect(sendOtpEmail({ ...baseParams, client })).rejects.toThrow(
      "Failed to send OTP email (HTTP 500): quota exceeded",
    );
  });

  it("never leaks the API key or request config into error messages", async () => {
    // Simulates the dangerous axios error shape: response error carrying the
    // full request config (including headers) and a circular-ish structure.
    const circular: Record<string, unknown> = { url: ENDPOINT };
    circular.self = circular;
    const axiosLikeError = {
      isAxiosError: true,
      message: "Request failed with status code 401",
      config: { headers: { "x-api-key": API_KEY }, ...circular },
      request: circular,
      response: { status: 401, data: { error: "unauthorized" } },
    };
    const client = fakeClient(async () => {
      throw axiosLikeError;
    });

    await expect(sendOtpEmail({ ...baseParams, client })).rejects.toThrow(
      "Failed to send OTP email (HTTP 401): unauthorized",
    );
  });

  it("surfaces network/timeout errors without dumping the axios object", async () => {
    const axiosLikeError = {
      isAxiosError: true,
      message: "timeout of 10000ms exceeded",
      config: { headers: { "x-api-key": API_KEY } },
    };
    const client = fakeClient(async () => {
      throw axiosLikeError;
    });

    await expect(sendOtpEmail({ ...baseParams, client })).rejects.toThrow(
      "Failed to send OTP email: timeout of 10000ms exceeded",
    );
  });
});

describe("toOtpErrorMessage", () => {
  it("handles plain errors", () => {
    expect(toOtpErrorMessage(new Error("boom"))).toBe(
      "Failed to send OTP email: boom",
    );
  });

  it("handles non-Error values", () => {
    expect(toOtpErrorMessage("something broke")).toBe(
      "Failed to send OTP email: something broke",
    );
  });

  it("prefers a string response body over the axios message", () => {
    const error = {
      isAxiosError: true,
      message: "Request failed with status code 429",
      response: { status: 429, data: "too many requests" },
    };
    expect(toOtpErrorMessage(error)).toBe(
      "Failed to send OTP email (HTTP 429): too many requests",
    );
  });
});
