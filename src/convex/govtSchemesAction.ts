"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { extractJson, getOpenRouterCompletion } from "./config";
import { filterSchemes } from "./govtSchemes";
import { enforceRateLimit, getRateLimitUserId } from "./rateLimit";

interface Scheme {
  name: string;
  benefit: string;
  eligibility: string;
  applyLink: string;
  reasoning?: string;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

/**
 * Ensures every scheme has a usable official-style link so the "Apply Now"
 * button always works, even if the model omits or mangles the URL.
 */
function normalizeApplyLink(value: unknown, name: string): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.google.com/search?q=${encodeURIComponent(`${name} official scheme apply`)}`;
}

/**
 * Validates and normalizes the AI's JSON response into the exact shape the
 * frontend and saveSchemeSearch mutation expect. Deduplicates by name and
 * caps the result count.
 */
function normalizeSchemes(data: unknown): Scheme[] {
  if (typeof data !== "object" || data === null) return [];
  const record = data as Record<string, unknown>;
  const rawSchemes = Array.isArray(record.schemes) ? record.schemes : [];

  const seen = new Set<string>();
  const schemes: Scheme[] = [];

  for (const item of rawSchemes) {
    if (typeof item !== "object" || item === null) continue;
    const scheme = item as Record<string, unknown>;
    const name = asString(scheme.name, "");
    if (!name || seen.has(name)) continue;

    seen.add(name);
    schemes.push({
      name,
      benefit: asString(scheme.benefit, "Check eligibility on the official portal."),
      eligibility: asString(scheme.eligibility, "Eligibility varies — verify on the official portal."),
      applyLink: normalizeApplyLink(scheme.applyLink, name),
      reasoning:
        typeof scheme.reasoning === "string" && scheme.reasoning.trim()
          ? scheme.reasoning
          : undefined,
    });

    if (schemes.length >= 6) break;
  }

  return schemes;
}

export const getPersonalizedSchemes = action({
  args: {
    farmerCategory: v.string(),
    cropType: v.string(),
    district: v.string(),
    irrigationMethod: v.optional(v.string()),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    // Per-user rate limit to protect the AI budget (6 requests/min)
    const rateLimitUserId = await getRateLimitUserId(ctx);
    const rateLimitError = await enforceRateLimit(ctx, rateLimitUserId, "schemes");
    if (rateLimitError) throw new Error(rateLimitError);

    try {
      // Primary path: live scheme recommendations from Ling via OpenRouter
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;

      if (openRouterApiKey && openRouterApiKey !== "demo" && openRouterApiKey.trim() !== "") {
        try {
          const systemPrompt = `You are an expert on Indian government agriculture schemes, especially those available to farmers in Punjab, India.

Based on the farmer profile, recommend 4-6 genuine, currently active schemes. Prefer real schemes such as PM-KISAN Samman Nidhi, PM Fasal Bima Yojana (PMFBY), Kisan Credit Card, Soil Health Card, PM-KUSUM, PM-KMY (Kisan Maan Dhan), Subsidized Micro-Irrigation (Drip/Sprinkler), and Punjab Crop Diversification incentives.

Respond ONLY with a JSON object in this exact structure — no markdown, no extra text:
{
  "schemes": [
    {
      "name": "Scheme Name",
      "benefit": "One sentence describing the benefit",
      "eligibility": "One sentence describing who qualifies",
      "applyLink": "Official https URL of the scheme portal",
      "reasoning": "Why this scheme suits THIS farmer"
    }
  ]
}

Rules:
1. Use only real government schemes with their official portals (e.g. pmkisan.gov.in, pmfby.gov.in)
2. Tailor each scheme to the farmer's category, crop, district, and irrigation method
3. Keep benefit, eligibility, and reasoning to one sentence each
4. In the reasoning, remind the farmer to verify eligibility and apply only through the official portal`;
          const userPrompt = `Farmer Profile:
- Category: ${args.farmerCategory}
- Crop Type: ${args.cropType}
- District: ${args.district}
- Irrigation Method: ${args.irrigationMethod || "Not specified"}`;

          const completion = await getOpenRouterCompletion(
            openRouterApiKey,
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            { temperature: 0.4, maxTokens: 1000 }
          );

          if (completion) {
            const schemes = normalizeSchemes(extractJson<unknown>(completion));
            if (schemes.length > 0) {
              console.log("✅ Live scheme recommendations generated via OpenRouter");
              return { schemes };
            }
            console.log("⚠️ AI response failed validation, using fallback");
          } else {
            console.log("⚠️ No AI response, using fallback");
          }
        } catch (error) {
          console.error("❌ OpenRouter API error:", error);
        }
      }

      // Fallback: filter the known scheme list without AI reasoning
      console.log("⚠️ Falling back to filtered mock schemes (API key not configured or AI unavailable)");
      const filteredSchemes = filterSchemes(
        args.farmerCategory,
        args.cropType,
        args.district
      );

      const schemes: Scheme[] = filteredSchemes.map((scheme) => ({
        name: scheme.name,
        benefit: scheme.benefit,
        eligibility: scheme.eligibility,
        applyLink: scheme.applyLink,
        reasoning: "This scheme matches your farming profile and location.",
      }));

      return { schemes };
    } catch (error) {
      console.error("Error in getPersonalizedSchemes:", error);
      throw new Error("Failed to fetch government schemes");
    }
  },
});
