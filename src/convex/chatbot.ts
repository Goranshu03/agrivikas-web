"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { API_CONFIG } from "./config";
import { normalizeMandiRecord, type MandiPriceRecord } from "./mandiPrices";
import { enforceRateLimit, getRateLimitUserId } from "./rateLimit";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  pa: "Punjabi",
};

const WEATHER_KEYWORDS = [
  "weather",
  "temperature",
  "forecast",
  "rainfall",
  "rain",
  "humidity",
  "mausam",
  "मौसम",
  "तापमान",
  "पूर्वानुमान",
  "बारिश",
  "नमी",
  "ਮੌਸਮ",
  "ਤਾਪਮਾਨ",
  "ਅਨੁਮਾਨ",
  "ਮੀਂਹ",
  "ਨਮੀ",
];

const MANDI_KEYWORDS = [
  "price",
  "rate",
  "rates",
  "cost",
  "mandi",
  "bhav",
  "bhaav",
  "sale",
  "selling",
  "भाव",
  "भाउ",
  "मंडी",
  "मूल्य",
  "ਭਾਅ",
  "ਭਾਉ",
  "ਮੰਡੀ",
  "ਕੀਮਤ",
];

// Maps a matched crop word to the commodity name used in AGMARKNET data.
// Covers Latin, Devanagari (Hindi) and Gurmukhi (Punjabi) spellings.
const MANDI_CROP_MAP: Record<string, string> = {
    // Wheat
    wheat: "Wheat",
    gehun: "Wheat",
    "गेहूं": "Wheat",
    "ਕਣਕ": "Wheat",
    // Paddy / Rice
    paddy: "Paddy",
    dhan: "Paddy",
    "धान": "Paddy",
    "ਝੋਨਾ": "Paddy",
    rice: "Rice",
    chawal: "Rice",
    "चावल": "Rice",
    "ਚੌਲ": "Rice",
    // Maize
    maize: "Maize",
    corn: "Maize",
    makka: "Maize",
    "मक्का": "Maize",
    "ਮੱਕੀ": "Maize",
    // Cotton
    cotton: "Cotton",
    kapas: "Cotton",
    "कपास": "Cotton",
    "ਕਪਾਹ": "Cotton",
    // Sugarcane
    sugarcane: "Sugarcane",
    ganna: "Sugarcane",
    "गन्ना": "Sugarcane",
    "ਗੰਨਾ": "Sugarcane",
    // Mustard
    mustard: "Mustard",
    sarson: "Mustard",
    "सरसों": "Mustard",
    "ਰਾਈ": "Mustard",
    // Moong
    moong: "Moong",
    "मूंग": "Moong",
    "ਮੂੰਗੀ": "Moong",
    // Gram
    gram: "Gram",
    chana: "Gram",
    "चना": "Gram",
    "ਛੋਲੇ": "Gram",
    // Tomato
    tomato: "Tomato",
    "टमाटर": "Tomato",
    "ਟਮਾਟਰ": "Tomato",
    // Onion
    onion: "Onion",
    "प्याज": "Onion",
    "ਪਿਆਜ਼": "Onion",
    // Potato
    potato: "Potato",
    "आलू": "Potato",
    "ਆਲੂ": "Potato",
    // Garlic
    garlic: "Garlic",
    "लहसुन": "Garlic",
    "ਲਸਣ": "Garlic",
    // Chilli
    chilli: "Chilli",
    "मिर्च": "Chilli",
    "ਮਿਰਚ": "Chilli",
};

function mapMandiCrop(word: string): string | null {
  return MANDI_CROP_MAP[word] || null;
}

// Words that look like a location but aren't one
const WEATHER_STOPWORDS = new Set([
  "today",
  "tomorrow",
  "now",
  "this",
  "the",
  "and",
  "please",
  "tell",
  "me",
  "my",
  "what",
  "how",
  "is",
  "are",
  "will",
  "it",
  "like",
  "current",
  "district",
  "city",
  "area",
  "town",
  "there",
  "here",
]);

interface WeatherInfo {
  temperature: number;
  humidity: number;
  condition: string;
  description?: string;
  cityName?: string;
}

interface ChatArgs {
  message: string;
  language: string;
  weatherData?: unknown;
  location?: string;
  imageBase64?: string;
}

/**
 * True when the message is asking about weather (multilingual keywords).
 */
export function detectWeatherIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return WEATHER_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

/**
 * Extracts a location name from a weather question, handling forms like
 * "weather in chandigarh", "chandigarh weather", or "chandigarh ka mausam".
 * Returns null when no usable location is found.
 */
export function extractLocation(message: string): string | null {
  const lower = message.toLowerCase().trim();

  // Location before the weather word: "chandigarh weather" / "chandigarh ka mausam"
  const beforeMatch = lower.match(
    /([a-z]+)\s+(?:ka|ki|kaa|का|की|ਦਾ|ਦੀ)?\s*(?:weather|temperature|forecast|mausam|मौसम|ਮੌਸਮ)/
  );
  // Location after the weather word: "weather in chandigarh"
  const afterMatch = lower.match(
    /(?:weather|temperature|forecast|humidity|mausam|मौसम|ਮੌਸਮ|तापमान|ਤਾਪਮਾਨ|नमी|ਨਮੀ)\s*(?:in|of|at|for|का|की|ਦਾ|ਦੀ)?\s+([a-z]+)/
  );

  // Prefer the before-pattern (handles "amritsar ka mausam" correctly) and
  // fall through to the after-pattern when the before match is a stopword.
  const candidates = [beforeMatch?.[1], afterMatch?.[1]];
  for (const candidate of candidates) {
    const cleaned = (candidate || "").replace(/[^a-z]/g, "");
    if (cleaned.length >= 3 && !WEATHER_STOPWORDS.has(cleaned)) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }
  return null;
}

/**
 * True when the message is asking about mandi/market prices (multilingual).
 */
export function detectMandiIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return MANDI_KEYWORDS.some((keyword) => lower.includes(keyword.toLowerCase()));
}

/**
 * Extracts the crop/commodity from a mandi price question, e.g.
 * "wheat ka bhav", "what is the price of onion today". Returns the
 * AGMARKNET commodity name or null when no known crop is mentioned.
 */
export function extractMandiCrop(message: string): string | null {
  const lower = message.toLowerCase();

  // Latin crop names must match on word boundaries so that e.g. "rice" is
  // not found inside "price". Scan the words of the message directly.
  const latinWords = lower.match(/[a-z]+/g) || [];
  for (const word of latinWords) {
    const mapped = mapMandiCrop(word);
    if (mapped) return mapped;
  }

  // Devanagari / Gurmukhi crop spellings are matched as substrings.
  for (const [spelling, mapped] of Object.entries(MANDI_CROP_MAP)) {
    if (!/^[a-z]+$/.test(spelling) && lower.includes(spelling)) {
      return mapped;
    }
  }
  return null;
}

/**
 * Fetches live mandi prices for a commodity from the official data.gov.in
 * AGMARKNET dataset. Returns the top records or an empty array on failure.
 */
async function fetchLiveMandiPrices(
  commodity: string
): Promise<MandiPriceRecord[]> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY?.trim();
  if (!apiKey || apiKey === "demo" || apiKey === "") {
    console.warn("⚠️ data.gov.in API key not configured");
    return [];
  }

  try {
    const params = new URLSearchParams({
      "api-key": apiKey,
      format: "json",
      limit: "10",
      "filters[commodity]": commodity,
    });
    const response = await fetch(
      `${API_CONFIG.MANDI.BASE_URL}?${params.toString()}`,
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) {
      console.error(`Mandi API error for ${commodity}: HTTP ${response.status}`);
      return [];
    }
    const data = (await response.json()) as { records?: unknown[] };
    if (!Array.isArray(data.records)) return [];
    return data.records
      .map(normalizeMandiRecord)
      .filter((r): r is MandiPriceRecord => r !== null)
      .slice(0, 5);
  } catch (error) {
    console.error("Mandi fetch error:", error);
    return [];
  }
}

/**
 * Fetches live weather for a location from OpenWeatherMap. Returns null when
 * the API key is missing or the request fails.
 */
async function fetchLiveWeather(
  location: string
): Promise<WeatherInfo | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey || apiKey === "demo" || apiKey === "") {
    console.warn("⚠️ OpenWeatherMap API key not configured");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      location
    )},IN&units=metric&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data?.main || !data?.weather?.[0]) return null;

    return {
      temperature: Math.round(data.main.temp),
      humidity: data.main.humidity,
      condition: data.weather[0].main,
      description: data.weather[0].description,
      cityName: data.name,
    };
  } catch (error) {
    console.error("Weather fetch error:", error);
    return null;
  }
}

function normalizeWeather(data: unknown): WeatherInfo | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.temperature !== "number") return undefined;
  return {
    temperature: record.temperature,
    humidity: typeof record.humidity === "number" ? record.humidity : 0,
    condition: typeof record.condition === "string" ? record.condition : "Unknown",
  };
}

function toImageUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:") || imageBase64.startsWith("http")) {
    return imageBase64;
  }
  return `data:image/jpeg;base64,${imageBase64}`;
}

function buildMessages(
  language: string,
  message: string,
  weatherContext?: WeatherInfo,
  location?: string,
  mandiPrices?: MandiPriceRecord[]
): { systemPrompt: string; userPrompt: string } {
  const langName = LANGUAGE_NAMES[language] || "English";

  const weatherLine = weatherContext
    ? `Current weather in ${location || "your area"}: ${weatherContext.temperature}°C, ${
        weatherContext.condition
      }${weatherContext.description ? ` (${weatherContext.description})` : ""}, Humidity: ${
        weatherContext.humidity
      }%`
    : "";

  const mandiLine =
    mandiPrices && mandiPrices.length > 0
      ? `Today's mandi prices (₹/Quintal, source: data.gov.in AGMARKNET):\n${mandiPrices
          .map(
            (p) =>
              `- ${p.commodity} (${p.market}, ${p.district}): Modal ₹${p.modalPrice} (Min ₹${p.minPrice} / Max ₹${p.maxPrice}), Arrival ${p.arrivalDate}`
          )
          .join("\n")}`
      : "";

  const systemPrompt = `You are AgriVikas Smart Assistant, a helpful AI companion for Indian farmers.
You MUST respond ONLY in ${langName}. This is mandatory — do NOT use any other language.
${language === "hi" ? "आपको केवल हिंदी में जवाब देना है। अंग्रेजी का उपयोग बिल्कुल न करें।" : ""}
${language === "pa" ? "ਤੁਹਾਨੂੰ ਸਿਰਫ਼ ਪੰਜਾਬੀ ਵਿੱਚ ਜਵਾਬ ਦੇਣਾ ਹੈ। ਅੰਗਰੇਜ਼ੀ ਦੀ ਵਰਤੋਂ ਬਿਲਕੁਲ ਨਾ ਕਰੋ।" : ""}

You provide advice on weather, irrigation, crop health, government schemes, mandi prices, and general farming guidance for Indian farmers.
${location ? `Context: The farmer is in ${location}.` : ""}
${weatherLine ? `${weatherLine}` : ""}
${mandiLine ? `${mandiLine}` : ""}

Rules:
1. Respond ONLY in ${langName} — never switch to English
2. Be concise and practical (2-4 sentences max)
3. When the user asks about weather, quote the actual temperature, condition, and humidity from the context
4. When the user asks about mandi prices, quote the actual prices from the context and name the market
5. Use farming terminology appropriate for small farmers
6. Include relevant emojis (🌾🌧️💧🌡️🌿💰)
7. For government schemes, mention PM-KISAN, PMFBY, or Soil Health Card if relevant
8. Be encouraging and supportive
9. Provide specific, actionable advice
10. When suggesting pesticides, fungicides, or chemical fertilizers, always add a short note to follow the product label and consult a local agriculture expert (e.g. Kisan Call Centre 1800-180-1551) before applying chemicals`;

  return { systemPrompt, userPrompt: message };
}

/**
 * Answers questions that include an uploaded image using the vision model,
 * since Ling 3.0 Flash is text-only.
 */
async function handleImageQuery(apiKey: string, args: ChatArgs): Promise<string> {
  const langName = LANGUAGE_NAMES[args.language] || "English";

  const prompt = `You are AgriVikas Smart Assistant, a helpful AI companion for Indian farmers.
The farmer has uploaded an image along with this question: "${args.message}"
Respond ONLY in ${langName}. ${args.language === "hi" ? "आपको केवल हिंदी में जवाब देना है।" : ""} ${args.language === "pa" ? "ਤੁਹਾਨੂੰ ਸਿਰਫ਼ ਪੰਜਾਬੀ ਵਿੱਚ ਜਵਾਬ ਦੇਣਾ ਹੈ।" : ""}

Look carefully at the image:
- If it shows a plant or crop leaf, identify the plant and any visible disease or damage, then give practical advice
- If it shows something else (a person, field, product, etc.), describe what you see and answer the question
- Be concise (2-4 sentences) and practical
- Include relevant emojis (🌾🌿💧)
- Never claim to see something that is not actually in the image
- When suggesting any chemical treatment, add a short note to follow the product label and consult a local agriculture expert before applying`;

  try {
    const response = await fetch(API_CONFIG.OPENROUTER.BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...API_CONFIG.OPENROUTER.HEADERS,
      },
      body: JSON.stringify({
        model: API_CONFIG.OPENROUTER.VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: toImageUrl(args.imageBase64 || "") } },
            ],
          },
        ],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter vision API error:", errorText);
      return "⚠️ Could not analyze the image right now. Please try again.";
    }

    const data = await response.json();
    const botResponse = data.choices?.[0]?.message?.content;
    return botResponse || "⚠️ Received empty response while analyzing the image. Please try again.";
  } catch (error) {
    console.error("OpenRouter vision API error:", error);
    return "⚠️ Failed to analyze the image. Please try again.";
  }
}

export const getChatResponse = action({
  args: {
    message: v.string(),
    language: v.string(),
    weatherData: v.optional(v.any()),
    location: v.optional(v.string()),
    imageBase64: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey || apiKey === "demo" || apiKey.trim() === "") {
      return "⚠️ OpenRouter API key is not configured. Please add OPENROUTER_API_KEY in the Backend Environment Variables section of the API Keys tab.";
    }

    // Per-user rate limit to protect the AI budget (20 msgs/min)
    const rateLimitUserId = await getRateLimitUserId(ctx);
    const rateLimitError = await enforceRateLimit(ctx, rateLimitUserId, "chat");
    if (rateLimitError) return rateLimitError;

    // Image attached → use the vision model
    if (args.imageBase64 && args.imageBase64.trim() !== "") {
      return handleImageQuery(apiKey, args);
    }

    // Weather question → fetch live data for the mentioned location
    let weatherContext = normalizeWeather(args.weatherData);
    let location = args.location || "";

    if (detectWeatherIntent(args.message)) {
      const detected = extractLocation(args.message);
      const target = detected || location || "Punjab";
      const live = await fetchLiveWeather(target);
      if (live) {
        weatherContext = live;
        location = live.cityName || target;
      }
    }

    // Mandi price question → fetch live prices for the mentioned crop
    let mandiPrices: MandiPriceRecord[] = [];
    if (detectMandiIntent(args.message)) {
      const crop = extractMandiCrop(args.message);
      if (crop) {
        mandiPrices = await fetchLiveMandiPrices(crop);
      }
    }

    try {
      const { systemPrompt, userPrompt } = buildMessages(
        args.language,
        args.message,
        weatherContext,
        location,
        mandiPrices
      );

      const response = await fetch(API_CONFIG.OPENROUTER.BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...API_CONFIG.OPENROUTER.HEADERS,
        },
        body: JSON.stringify({
          model: API_CONFIG.OPENROUTER.MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 700,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", errorText);
        return `⚠️ OpenRouter API Error (${response.status}): Please check your OPENROUTER_API_KEY in Backend Environment Variables.`;
      }

      const data = await response.json();
      const botResponse = data.choices?.[0]?.message?.content;

      if (!botResponse) {
        return "⚠️ Received empty response from OpenRouter API. Please try again.";
      }

      return botResponse;
    } catch (error) {
      console.error("OpenRouter API error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return `⚠️ Failed to connect to OpenRouter API: ${errorMessage}.`;
    }
  },
});
