/**
 * Centralized API Configuration
 * All external API endpoints and shared utilities
 */

export const API_CONFIG = {
  OPENROUTER: {
    BASE_URL: "https://openrouter.ai/api/v1/chat/completions",
    MODEL: "inclusionai/ling-3.0-flash", // Fast, free-tier friendly text model for chat & voice assistant
    VISION_MODEL: "google/gemini-2.5-flash", // Vision-capable model for disease detection from images
    VISION_MODEL_ALT: "openai/gpt-4o-mini", // Fallback vision option
    HEADERS: {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://agrivikas.app",
      "X-Title": "AgriVikas Smart Assistant",
    },
  },
  OPENWEATHER: {
    BASE_URL: "https://api.openweathermap.org/data/2.5/weather",
    UNITS: "metric",
    COUNTRY_CODE: "IN",
  },
  // Official government source for live mandi (market) prices of crops:
  // data.gov.in hosts the AGMARKNET "Current Daily Price of Various
  // Commodities from Various Markets (Mandi)" dataset. A free API key is
  // obtained at https://data.gov.in (Menu → "Developer" → API key).
  MANDI: {
    BASE_URL: "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
    DEFAULT_STATE: "Punjab",
    LIMIT: 100,
  },
} as const;

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Calls OpenRouter with a full message list and returns the text content.
 * Returns null on any failure (non-2xx response, network error, or empty
 * content) so callers can fall back gracefully.
 */
export async function getOpenRouterCompletion(
  apiKey: string,
  messages: OpenRouterMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  try {
    const response = await fetch(API_CONFIG.OPENROUTER.BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...API_CONFIG.OPENROUTER.HEADERS,
      },
      body: JSON.stringify({
        model: options.model ?? API_CONFIG.OPENROUTER.MODEL,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    return typeof content === "string" && content.trim() ? content : null;
  } catch (error) {
    console.error("OpenRouter API error:", error);
    return null;
  }
}

/**
 * Extracts the first JSON object from a model response, tolerating
 * markdown fences and surrounding prose. Returns null when no valid
 * JSON object can be found.
 */
export function extractJson<T>(botResponse: string): T | null {
  const cleaned = botResponse.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first {...} block in case of surrounding prose.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

/**
 * Helper function to fetch weather data from OpenWeatherMap
 */
export async function fetchWeatherData(
  apiKey: string,
  location: string,
  includeCountry: boolean = true
) {
  const query = includeCountry ? `${location},${API_CONFIG.OPENWEATHER.COUNTRY_CODE}` : location;
  const url = `${API_CONFIG.OPENWEATHER.BASE_URL}?q=${query}&appid=${apiKey.trim()}&units=${API_CONFIG.OPENWEATHER.UNITS}`;
  
  console.log("🌐 Fetching weather for:", location);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("❌ Weather API Error:", errorData);
    throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch weather data`);
  }
  
  const data = await response.json();
  
  return {
    temperature: Math.round(data.main.temp),
    humidity: data.main.humidity,
    condition: data.weather[0].main,
    description: data.weather[0].description,
    rainProbability: data.clouds?.all || 0,
    cityName: data.name,
  };
}
