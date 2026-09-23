"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

interface WeatherResult {
  temperature: number;
  condition: string;
  icon: string;
  humidity: number;
  rainfall: number;
}

export const fetchWeatherData = action({
  args: {
    district: v.string(),
  },
  handler: async (ctx, args): Promise<WeatherResult | null> => {
    // Serve from cache when fresh (15 min) — weather changes slowly, and this
    // saves OpenWeatherMap quota while making the dashboard feel instant.
    try {
      const cached = await ctx.runQuery(
        internal.cacheStorage.readWeatherCacheRow,
        { district: args.district }
      );
      if (cached) {
        return {
          temperature: cached.temperature,
          condition: cached.condition,
          icon: cached.icon,
          humidity: cached.humidity,
          rainfall: cached.rainfall,
        };
      }
    } catch (error) {
      console.error("Weather cache read failed:", error);
    }

    const apiKey = process.env.OPENWEATHER_API_KEY?.trim();

    if (!apiKey || apiKey === "demo" || apiKey === "") {
      console.warn("⚠️ OpenWeatherMap API key not configured");
      return null;
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
        args.district
      )},IN&units=metric&appid=${apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Weather API error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      const iconMap: Record<string, string> = {
        "Clear": "☀️",
        "Clouds": "☁️",
        "Rain": "🌧️",
        "Drizzle": "🌦️",
        "Thunderstorm": "⛈️",
        "Snow": "❄️",
        "Mist": "🌫️",
        "Fog": "🌫️",
        "Haze": "🌥️",
      };

      const weatherCondition = data.weather[0].main;
      const icon = iconMap[weatherCondition] || "🌤️";

      const result: WeatherResult = {
        temperature: Math.round(data.main.temp),
        condition: weatherCondition,
        icon: icon,
        humidity: data.main.humidity,
        rainfall: data.rain?.["1h"] || 0,
      };

      try {
        await ctx.runMutation(internal.cacheStorage.writeWeatherCacheRow, {
          district: args.district,
          ...result,
        });
      } catch (error) {
        console.error("Weather cache write failed:", error);
      }

      return result;
    } catch (error) {
      console.error("Error fetching weather:", error);
      return null;
    }
  },
});
