import { describe, expect, it } from "vitest";
import { detectWeatherIntent, extractLocation } from "./chatbot";

describe("detectWeatherIntent", () => {
  it("detects English weather questions", () => {
    expect(detectWeatherIntent("tell me chandigarh weather")).toBe(true);
    expect(detectWeatherIntent("What is the temperature today?")).toBe(true);
    expect(detectWeatherIntent("will it rain this week")).toBe(true);
  });

  it("detects Hindi and Punjabi weather questions", () => {
    expect(detectWeatherIntent("आज मौसम कैसा है")).toBe(true);
    expect(detectWeatherIntent("ਅੱਜ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ")).toBe(true);
  });

  it("does not flag non-weather messages", () => {
    expect(detectWeatherIntent("hello")).toBe(false);
    expect(detectWeatherIntent("which crop should I plant")).toBe(false);
    expect(detectWeatherIntent("irrigation advice")).toBe(false);
  });
});

describe("extractLocation", () => {
  it("extracts the location after the weather word", () => {
    expect(extractLocation("what is the weather in chandigarh")).toBe("Chandigarh");
    expect(extractLocation("weather in ludhiana")).toBe("Ludhiana");
  });

  it("extracts the location before the weather word", () => {
    expect(extractLocation("tell me chandigarh weather")).toBe("Chandigarh");
    expect(extractLocation("amritsar ka mausam kaisa hai")).toBe("Amritsar");
  });

  it("returns null when no location is mentioned", () => {
    expect(extractLocation("what is the weather like today")).toBeNull();
    expect(extractLocation("weather in my district")).toBeNull();
    expect(extractLocation("hello")).toBeNull();
  });
});
