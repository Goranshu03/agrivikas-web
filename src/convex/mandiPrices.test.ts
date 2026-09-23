import { describe, expect, it } from "vitest";
import { normalizeMandiRecord } from "./mandiPrices";
import { detectMandiIntent, extractMandiCrop } from "./chatbot";

describe("normalizeMandiRecord", () => {
  it("normalizes a valid AGMARKNET record into the stable shape", () => {
    const record = normalizeMandiRecord({
      state: "Punjab",
      district: "Amritsar",
      market: "Amritsar",
      commodity: "Wheat",
      variety: "Dara",
      arrival_date: "08/08/2026",
      min_price: "2300",
      max_price: "2450",
      modal_price: "2375",
    });

    expect(record).toEqual({
      commodity: "Wheat",
      variety: "Dara",
      market: "Amritsar",
      district: "Amritsar",
      state: "Punjab",
      minPrice: "2300",
      maxPrice: "2450",
      modalPrice: "2375",
      arrivalDate: "08/08/2026",
      unit: "₹/Quintal",
    });
  });

  it("accepts camelCase fields from alternative providers", () => {
    const record = normalizeMandiRecord({
      state: "Punjab",
      district: "Ludhiana",
      market: "Ludhiana",
      commodity: "Maize",
      variety: "Local",
      arrivalDate: "2026-08-08",
      minPrice: "1500",
      maxPrice: "1600",
      modalPrice: "1550",
    });

    expect(record?.modalPrice).toBe("1550");
    expect(record?.minPrice).toBe("1500");
    expect(record?.arrivalDate).toBe("2026-08-08");
  });

  it("accepts numeric price fields returned by the live AGMARKNET API", () => {
    const record = normalizeMandiRecord({
      state: "Karnataka",
      district: "Bagalkot",
      market: "Hungund APMC",
      commodity: "Wheat",
      variety: "Local",
      grade: "FAQ",
      arrival_date: "11/09/2026",
      min_price: 3200,
      max_price: 3200,
      modal_price: 3200,
    });

    expect(record).not.toBeNull();
    expect(record?.modalPrice).toBe("3200");
    expect(record?.minPrice).toBe("3200");
    expect(record?.maxPrice).toBe("3200");
    expect(record?.commodity).toBe("Wheat");
  });

  it("treats non-finite numbers as missing values", () => {
    expect(
      normalizeMandiRecord({ commodity: "Wheat", modal_price: Number.NaN }),
    ).toBeNull();
  });

  it("accepts PascalCase fields from the variety-wise dataset schema", () => {
    const record = normalizeMandiRecord({
      State: "Punjab",
      District: "Ludhiana",
      Market: "Ludhiana",
      Commodity: "Wheat",
      Variety: "Dara",
      Arrival_Date: "10/09/2026",
      Min_Price: 2300,
      Max_Price: 2450,
      Modal_Price: 2375,
    });

    expect(record).not.toBeNull();
    expect(record?.modalPrice).toBe("2375");
    expect(record?.commodity).toBe("Wheat");
    expect(record?.state).toBe("Punjab");
    expect(record?.arrivalDate).toBe("10/09/2026");
  });

  it("returns null for non-objects", () => {
    expect(normalizeMandiRecord(null)).toBeNull();
    expect(normalizeMandiRecord("wheat")).toBeNull();
    expect(normalizeMandiRecord(42)).toBeNull();
  });

  it("returns null when commodity or modal price is missing", () => {
    expect(normalizeMandiRecord({ commodity: "Wheat" })).toBeNull();
    expect(normalizeMandiRecord({ modal_price: "2375" })).toBeNull();
    expect(normalizeMandiRecord({ commodity: "", modal_price: "2375" })).toBeNull();
  });

  it("fills missing optional fields with em dashes", () => {
    const record = normalizeMandiRecord({
      commodity: "Onion",
      modal_price: "1200",
    });

    expect(record?.variety).toBe("—");
    expect(record?.market).toBe("—");
    expect(record?.minPrice).toBe("—");
    expect(record?.maxPrice).toBe("—");
    expect(record?.arrivalDate).toBe("—");
  });
});

describe("detectMandiIntent", () => {
  it("detects English mandi price questions", () => {
    expect(detectMandiIntent("what is the price of wheat")).toBe(true);
    expect(detectMandiIntent("wheat ka bhav kya hai")).toBe(true);
    expect(detectMandiIntent("tomato rate in ludhiana mandi")).toBe(true);
  });

  it("detects Hindi and Punjabi mandi questions", () => {
    expect(detectMandiIntent("गेहूं का भाव क्या है")).toBe(true);
    expect(detectMandiIntent("ਕਣਕ ਦਾ ਭਾਅ ਕਿੰਨਾ ਹੈ")).toBe(true);
    expect(detectMandiIntent("ਪਿਆਜ਼ ਦੀ ਮੰਡੀ ਕੀਮਤ")).toBe(true);
  });

  it("does not flag non-price messages", () => {
    expect(detectMandiIntent("hello there")).toBe(false);
    expect(detectMandiIntent("what is the weather today")).toBe(false);
    expect(detectMandiIntent("tell me about crop advisory")).toBe(false);
  });
});

describe("extractMandiCrop", () => {
  it("extracts the crop from English questions", () => {
    expect(extractMandiCrop("what is the price of wheat")).toBe("Wheat");
    expect(extractMandiCrop("onion rate in ludhiana mandi")).toBe("Onion");
    expect(extractMandiCrop("tell me paddy bhav")).toBe("Paddy");
  });

  it("extracts the crop from Hindi and Punjabi questions", () => {
    expect(extractMandiCrop("गेहूं का भाव क्या है")).toBe("Wheat");
    expect(extractMandiCrop("ਕਣਕ ਦਾ ਭਾਅ ਕਿੰਨਾ ਹੈ")).toBe("Wheat");
    expect(extractMandiCrop("ਟਮਾਟਰ ਦੀ ਕੀਮਤ")).toBe("Tomato");
  });

  it("returns null when no known crop is mentioned", () => {
    expect(extractMandiCrop("what is the price today")).toBeNull();
    expect(extractMandiCrop("hello")).toBeNull();
  });
});
