"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { extractJson, fetchWeatherData, getOpenRouterCompletion } from "./config";
import { enforceRateLimit, getRateLimitUserId } from "./rateLimit";

interface CropRecommendation {
  name: string;
  waterSavings: string;
  soilBenefit: string;
  profitPotential: string;
}

interface CropComparisonRow {
  crop: string;
  waterUse: string;
  profit: string;
  soilImpact: string;
}

interface WeatherInfo {
  temperature: number;
  humidity: number;
  condition: string;
}

interface AdvisoryPayload {
  recommendedCrops: CropRecommendation[];
  advice: string[];
  cropComparison: CropComparisonRow[];
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/**
 * Validates and normalizes the AI's JSON response into the exact shape the
 * frontend and saveCropAdvisory mutation expect. Returns null when the
 * payload is unusable so the caller can fall back.
 */
function normalizeAdvisory(data: unknown): AdvisoryPayload | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;

  const rawCrops = Array.isArray(record.recommendedCrops) ? record.recommendedCrops : [];
  const recommendedCrops: CropRecommendation[] = rawCrops
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      name: asString(c.name, "Unnamed crop"),
      waterSavings: asString(c.waterSavings, "—"),
      soilBenefit: asString(c.soilBenefit, "—"),
      profitPotential: asString(c.profitPotential, "—"),
    }))
    .slice(0, 5);

  const rawAdvice = Array.isArray(record.advice) ? record.advice : [];
  const advice: string[] = rawAdvice
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    .slice(0, 6);

  const rawComparison = Array.isArray(record.cropComparison) ? record.cropComparison : [];
  const cropComparison: CropComparisonRow[] = rawComparison
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      crop: asString(c.crop, "—"),
      waterUse: asString(c.waterUse, "—"),
      profit: asString(c.profit, "—"),
      soilImpact: asString(c.soilImpact, "—"),
    }))
    .slice(0, 6);

  if (recommendedCrops.length === 0) return null;
  return { recommendedCrops, advice, cropComparison };
}

export const getCropRecommendations = action({
  args: {
    landArea: v.number(),
    soilType: v.string(),
    currentCrop: v.string(),
    district: v.string(),
    waterAvailability: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    // Per-user rate limit to protect the AI budget (6 requests/min)
    const rateLimitUserId = await getRateLimitUserId(ctx);
    const rateLimitError = await enforceRateLimit(ctx, rateLimitUserId, "advisory");
    if (rateLimitError) throw new Error(rateLimitError);

    try {
      // Fetch weather data for the district using centralized helper
      const weatherApiKey = process.env.OPENWEATHER_API_KEY;
      let weatherData: WeatherInfo = {
        temperature: 28,
        humidity: 65,
        condition: "Partly Cloudy",
      };

      console.log("🔑 Backend Weather API Key Status:", weatherApiKey ? "✅ Set" : "❌ Not Set");
      console.log("📍 Fetching weather for district:", args.district);

      if (weatherApiKey) {
        try {
          const weather = await fetchWeatherData(weatherApiKey, args.district, true);
          weatherData = {
            temperature: weather.temperature,
            humidity: weather.humidity,
            condition: weather.condition,
          };
          console.log("✅ Backend Weather Data:", weatherData, "for", weather.cityName);
        } catch (error) {
          console.error("🚨 Backend Weather API Exception:", error);
          console.log("🔄 Using simulated weather data");
        }
      } else {
        console.log("⚠️ Backend API key not configured. Using simulated data.");
        console.log("💡 Add OPENWEATHER_API_KEY in Backend API Keys tab");
      }

      // Primary path: live crop recommendations from Ling via OpenRouter
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;

      if (openRouterApiKey && openRouterApiKey !== "demo" && openRouterApiKey.trim() !== "") {
        try {
          const systemPrompt = `You are an agricultural expert for Punjab, India. Analyze the farmer profile and recommend crops, advice, and a comparison table.

Respond ONLY with a JSON object in this exact structure — no markdown, no extra text:
{
  "recommendedCrops": [
    {"name": "Maize", "waterSavings": "40%", "soilBenefit": "Improves fertility", "profitPotential": "High"}
  ],
  "advice": [
    "Specific actionable farming tip"
  ],
  "cropComparison": [
    {"crop": "Paddy", "waterUse": "High", "profit": "Moderate", "soilImpact": "Reduces fertility"}
  ]
}

Rules:
1. Recommend 3-4 crops suitable for the given soil, water availability, and weather
2. Provide 4-5 practical advice points focused on water conservation and soil health
3. Include 5 crops in the comparison table (Water use must be one of High/Moderate/Low)
4. Keep all values short, specific, and in English
5. If fertilizer or pesticide use appears in advice, add a brief note to follow the product label and consult a local agriculture expert`;

          const userPrompt = `Farmer Profile:
- Land Area: ${args.landArea} acres
- Soil Type: ${args.soilType}
- Current Crop: ${args.currentCrop}
- District: ${args.district}
- Water Availability: ${args.waterAvailability}
- Current Weather: ${weatherData.temperature}°C, ${weatherData.humidity}% humidity, ${weatherData.condition}`;

          const completion = await getOpenRouterCompletion(
            openRouterApiKey,
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            { temperature: 0.4, maxTokens: 900 }
          );

          if (completion) {
            const normalized = normalizeAdvisory(extractJson<unknown>(completion));
            if (normalized) {
              console.log("✅ Live crop advisory generated via OpenRouter");
              return { ...normalized, weatherData };
            }
            console.log("⚠️ AI response failed validation, using fallback");
          } else {
            console.log("⚠️ No AI response, using fallback");
          }
        } catch (error) {
          console.error("❌ OpenRouter API error:", error);
        }
      }

      // Fallback to simulated recommendations when API is unavailable
      const { getSimulatedAdvisory } = await import("./cropAdvisory");
      const recommendations = getSimulatedAdvisory(
        args.soilType,
        args.currentCrop,
        args.waterAvailability,
        weatherData.temperature
      );

      return {
        ...recommendations,
        weatherData,
      };
    } catch (error) {
      console.error("Error in getCropRecommendations:", error);
      throw new Error("Failed to generate crop recommendations");
    }
  },
});
