"use node";

import { v } from "convex/values";
import { action, ActionCtx } from "./_generated/server";
import { simulateAnalysis, mapToAnalysisResult } from "./diseaseDetection";
import { API_CONFIG } from "./config";
import { enforceRateLimit, getRateLimitUserId } from "./rateLimit";

const AI_ADVISORY_DISCLAIMER =
  "AI guidance only — follow the product label and consult a local agriculture expert (Kisan Call Centre 1800-180-1551) before applying any chemical treatment.";

/**
 * Normalizes an image reference from the frontend into a form the vision
 * model accepts. Uploaded images arrive as data URLs (data:image/...;base64,)
 * and sample images arrive as https URLs.
 */
function toImageUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:") || imageBase64.startsWith("http")) {
    return imageBase64;
  }
  // Raw base64 without a data-URL prefix — wrap it as JPEG.
  return `data:image/jpeg;base64,${imageBase64}`;
}

interface VisionFocusRegion {
  x: number;
  y: number;
  intensity: number;
}

interface VisionResponse {
  isPlant?: boolean;
  plantName?: string;
  disease?: string;
  confidence?: number;
  description?: string;
  focusRegions?: VisionFocusRegion[];
}

/**
 * Friendly result shown when the uploaded image does not contain a plant.
 * The frontend renders a dedicated message and skips history/chatbot events.
 */
function buildNoPlantResult() {
  return {
    isPlant: false,
    plantName: "",
    disease: "Not a Plant",
    confidence: 0,
    severity: "None",
    treatment:
      "This photo does not appear to show a plant or crop. Please take a clear, well-lit photo of the plant's leaf, stem, or fruit and try again.",
    impactPercent: "0",
    recommendation: "Upload a clear photo of the plant you want to check.",
    disclaimer: AI_ADVISORY_DISCLAIMER,
    needsAgronomist: false,
    detailedRecommendations: null,
    focusRegions: [],
  };
}

/**
 * Extracts the first JSON object from a model response, tolerating
 * markdown fences and surrounding prose.
 */
function extractJson(botResponse: string): VisionResponse | null {
  const match = botResponse.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as VisionResponse;
  } catch {
    return null;
  }
}

// Helper function for disease analysis logic
async function analyzeDiseaseHelper(
  ctx: ActionCtx,
  imageBase64: string
): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  console.log("=== Disease Detection API Debug ===");
  console.log("API Key exists:", !!apiKey);
  console.log("Image data length:", imageBase64.length);

  // If API key not configured, use simulation
  if (!apiKey || apiKey === "demo" || apiKey.trim() === "") {
    console.log("⚠️ API key not configured, using simulation");
    return simulateAnalysis(imageBase64);
  }

  try {
    console.log("✅ Calling OpenRouter API with Gemini vision model...");

    // Call OpenRouter API with vision model using centralized config
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
              {
                type: "text",
                text: `You are a plant identification and crop disease detection expert.

Step 1 — CHECK the image: If the image does NOT clearly show a plant (no leaf, stem, crop, fruit, or tree is visible — e.g. it shows a person, animal, building, or landscape), respond ONLY with this JSON and stop:
{"isPlant": false, "description": "Briefly explain what the image actually shows"}

Step 2 — IDENTIFY the plant: If the image shows a plant, first identify the plant species (e.g. Tomato, Wheat, Paddy/Rice, Maize, Potato, Cotton, Brinjal, Chilli) and report it in "plantName".

Step 3 — DIAGNOSE: Examine the leaf's color, spots, and texture, then respond ONLY with this exact JSON structure:
{
  "isPlant": true,
  "plantName": "Tomato",
  "disease": "Disease Name or Healthy",
  "confidence": 0.85,
  "description": "Brief description",
  "focusRegions": [{"x": 0.3, "y": 0.4, "intensity": 0.8}]
}

Valid disease names: Leaf Blight, Rust, Powdery Mildew, Healthy, Bacterial Spot, Early Blight, Late Blight

IMPORTANT: Look carefully at the actual image before deciding. Never invent a plant or a disease you cannot see in the image. If the image is not a clear plant photo, always say isPlant false.`,
              },
              {
                type: "image_url",
                image_url: { url: toImageUrl(imageBase64) },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    console.log("📡 OpenRouter API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenRouter API error:", errorText);
      console.log("⚠️ Falling back to simulation");
      return simulateAnalysis(imageBase64);
    }

    const data = await response.json();
    const botResponse = data.choices?.[0]?.message?.content;

    if (!botResponse) {
      console.log("⚠️ No response from API, using simulation");
      return simulateAnalysis(imageBase64);
    }

    // Parse JSON response
    const result = extractJson(botResponse);
    if (result) {
      // Image doesn't contain a plant — say so instead of guessing a disease
      if (result.isPlant === false) {
        return buildNoPlantResult();
      }

      if (typeof result.disease === "string") {
        const analysisResult = mapToAnalysisResult(
          result.disease,
          typeof result.confidence === "number" ? result.confidence : 0.5,
          typeof result.plantName === "string" ? result.plantName : undefined
        );
        // Add focus regions for Grad-CAM visualization
        return {
          ...analysisResult,
          focusRegions: result.focusRegions || [],
        };
      }
    }

    // Fallback to simulation
    console.log("⚠️ Could not parse API response, using simulation");
    return simulateAnalysis(imageBase64);
  } catch (error) {
    console.error("❌ Disease detection error:", error);
    return simulateAnalysis(imageBase64);
  }
}

// Action to analyze disease from a single image
export const analyzeDisease = action({
  args: {
    imageBase64: v.string(),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const rateLimitUserId = await getRateLimitUserId(ctx);
    const rateLimitError = await enforceRateLimit(ctx, rateLimitUserId, "vision");
    if (rateLimitError) {
      return {
        disease: "Rate limited",
        confidence: 0,
        severity: "None",
        treatment: rateLimitError,
        impactPercent: "0",
        recommendation: "Please wait a moment and try again.",
        needsAgronomist: false,
        detailedRecommendations: null,
        focusRegions: [],
      };
    }
    return analyzeDiseaseHelper(ctx, args.imageBase64);
  },
});

// New action for ensemble voting with multiple images
export const analyzeMultipleImages = action({
  args: {
    images: v.array(v.string()),
    language: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log(`=== Ensemble Analysis: ${args.images.length} images ===`);

    const rateLimitUserId = await getRateLimitUserId(ctx);
    const rateLimitError = await enforceRateLimit(ctx, rateLimitUserId, "vision");
    if (rateLimitError) {
      return {
        disease: "Rate limited",
        confidence: 0,
        severity: "None",
        treatment: rateLimitError,
        impactPercent: "0",
        recommendation: "Please wait a moment and try again.",
        needsAgronomist: false,
        detailedRecommendations: null,
        focusRegions: [],
      };
    }

    // Analyze each image
    const results: any[] = [];
    for (const imageBase64 of args.images) {
      const result = await analyzeDiseaseHelper(ctx, imageBase64);
      results.push(result);
    }

    // If none of the images show a plant, report that instead of guessing
    const plantResults = results.filter((r) => r.isPlant !== false);
    if (plantResults.length === 0) {
      return results[0];
    }

    // Ensemble voting: count disease occurrences among plant images
    const diseaseVotes: Record<string, number> = {};
    const confidenceScores: number[] = [];
    const allFocusRegions: any[] = [];

    plantResults.forEach((result: any) => {
      diseaseVotes[result.disease] = (diseaseVotes[result.disease] || 0) + 1;
      confidenceScores.push(result.confidence);
      if (result.focusRegions) {
        allFocusRegions.push(...result.focusRegions);
      }
    });

    // Get majority vote
    const majorityDisease = Object.entries(diseaseVotes).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];

    // Calculate average confidence
    const avgConfidence =
      confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length;

    // Determine confidence level
    let confidenceLevel = "Low";
    let confidenceColor = "red";
    if (avgConfidence >= 0.85) {
      confidenceLevel = "High";
      confidenceColor = "green";
    } else if (avgConfidence >= 0.5) {
      confidenceLevel = "Moderate";
      confidenceColor = "yellow";
    }

    // Get the result template from the first matching disease
    const templateResult: any = plantResults.find((r: any) => r.disease === majorityDisease) || plantResults[0];

    return {
      ...templateResult,
      disease: majorityDisease,
      confidence: avgConfidence,
      confidenceLevel,
      confidenceColor,
      focusRegions: allFocusRegions,
      needsAgronomist: avgConfidence < 0.5,
      ensembleVotes: diseaseVotes,
      individualResults: results,
    };
  },
});
