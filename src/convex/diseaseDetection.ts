import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Query to get disease analysis history for current user
export const getDiseaseHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const userId = identity.subject;
    const analyses = await ctx.db
      .query("diseaseAnalyses")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);

    return analyses;
  },
});

// Mutation to save disease analysis result
export const saveDiseaseAnalysis = mutation({
  args: {
    diseaseName: v.string(),
    confidence: v.number(),
    severity: v.string(),
    treatment: v.string(),
    impactPercent: v.string(),
    language: v.string(),
    imageStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const analysisId = await ctx.db.insert("diseaseAnalyses", {
      userId,
      diseaseName: args.diseaseName,
      confidence: args.confidence,
      severity: args.severity,
      treatment: args.treatment,
      impactPercent: args.impactPercent,
      language: args.language,
      imageStorageId: args.imageStorageId,
    });

    return analysisId;
  },
});

const AI_ADVISORY_DISCLAIMER =
  "AI guidance only — follow the product label and consult a local agriculture expert (Kisan Call Centre 1800-180-1551) before applying any chemical treatment.";

// Simulation function for when API is unavailable
export function simulateAnalysis(imageBase64: string): any {
  // Deterministic simulation based on image data characteristics
  const hash = imageBase64.length % 4;

  const simulations = [
    {
      disease: "Healthy",
      confidence: 0.92,
    },
    {
      disease: "Leaf Blight",
      confidence: 0.87,
    },
    {
      disease: "Rust",
      confidence: 0.76,
    },
    {
      disease: "Powdery Mildew",
      confidence: 0.68,
    },
  ];

  const selected = simulations[hash];
  return mapToAnalysisResult(selected.disease, selected.confidence);
}

// Enhanced disease recommendation mapping with structured advice
export function getDetailedRecommendations(disease: string): any {
  const recommendationsMap: Record<string, any> = {
    "Leaf Blight": {
      cultural_controls: [
        "Remove infected leaves",
        "Avoid overhead irrigation",
        "Improve drainage"
      ],
      organic_options: [
        "Neem oil spray (as per label)",
        "Potassium bicarbonate solution (organic-approved)"
      ],
      chemical_options: [
        "Copper-based fungicide (Copper Oxychloride)",
        "Systemic fungicide class: Triazoles"
      ],
      safety_notes: "Wear gloves/mask. Follow label instructions strictly.",
      estimated_impact: "20-40% yield loss if untreated",
      treatment_cost: "₹800-1,500 per acre (organic: ₹500-800, chemical: ₹1,200-1,500)",
      nutrient_deficiency: "Nitrogen",
      nutrient_advice: {
        short_term: "Apply nitrogenous fertilizer (e.g., urea) as per label",
        long_term: "Get a Soil Health Card for exact dosage and soil analysis"
      }
    },
    "Rust": {
      cultural_controls: [
        "Remove crop residues",
        "Avoid dense planting"
      ],
      organic_options: [
        "Neem-based formulations",
        "Sulfur dusting where approved"
      ],
      chemical_options: [
        "Mancozeb class fungicides"
      ],
      safety_notes: "Use PPE; follow label waiting period.",
      estimated_impact: "15-30%",
      treatment_cost: "₹600-1,200 per acre (organic: ₹400-700, chemical: ₹900-1,200)",
      nutrient_deficiency: "Potassium",
      nutrient_advice: {
        short_term: "Apply potassium-rich fertilizer (e.g., muriate of potash) as per label",
        long_term: "Conduct soil test to determine exact potassium levels"
      }
    },
    "Powdery Mildew": {
      cultural_controls: [
        "Improve airflow",
        "Avoid excessive nitrogen fertilizer"
      ],
      organic_options: [
        "Sulfur spray (organic-approved)"
      ],
      chemical_options: [
        "Contact fungicides (Triazoles/DMIs)"
      ],
      safety_notes: "Apply during early morning or evening; wear protective gear.",
      estimated_impact: "10-25%",
      treatment_cost: "₹500-1,000 per acre (organic: ₹300-600, chemical: ₹700-1,000)",
      nutrient_deficiency: "Micronutrients (Zinc, Manganese)",
      nutrient_advice: {
        short_term: "Apply micronutrient spray containing zinc and manganese",
        long_term: "Regular soil testing to monitor micronutrient levels"
      }
    },
    "Healthy": {
      cultural_controls: [
        "Maintain irrigation schedule",
        "Monitor weekly for new spots"
      ],
      organic_options: [
        "No treatment needed — maintain preventive care"
      ],
      chemical_options: [
        "None"
      ],
      safety_notes: "Keep observation",
      estimated_impact: "None",
      treatment_cost: "₹0 (preventive monitoring only)",
      nutrient_deficiency: null,
      nutrient_advice: null
    },
    "Bacterial Spot": {
      cultural_controls: [
        "Remove infected plant parts",
        "Avoid overhead watering",
        "Increase plant spacing"
      ],
      organic_options: [
        "Copper-based organic bactericide",
        "Biological control agents (Bacillus subtilis)"
      ],
      chemical_options: [
        "Copper hydroxide",
        "Streptomycin (where approved)"
      ],
      safety_notes: "Use protective equipment; avoid application before rain.",
      estimated_impact: "15-35%",
      treatment_cost: "₹700-1,400 per acre (organic: ₹500-900, chemical: ₹1,000-1,400)",
      nutrient_deficiency: "Calcium",
      nutrient_advice: {
        short_term: "Apply calcium-based fertilizer or gypsum",
        long_term: "Soil pH adjustment and regular calcium monitoring"
      }
    },
    "Early Blight": {
      cultural_controls: [
        "Remove lower leaves",
        "Rotate crops annually",
        "Mulch to prevent soil splash"
      ],
      organic_options: [
        "Copper fungicide (organic-approved)",
        "Baking soda solution"
      ],
      chemical_options: [
        "Chlorothalonil",
        "Mancozeb"
      ],
      safety_notes: "Apply early in disease cycle; wear PPE.",
      estimated_impact: "20-30%",
      treatment_cost: "₹900-1,600 per acre (organic: ₹600-1,000, chemical: ₹1,200-1,600)",
      nutrient_deficiency: "Nitrogen",
      nutrient_advice: {
        short_term: "Apply balanced NPK fertilizer with emphasis on nitrogen",
        long_term: "Soil Health Card test for comprehensive nutrient management"
      }
    },
    "Late Blight": {
      cultural_controls: [
        "Destroy infected plants immediately",
        "Avoid working in wet conditions",
        "Remove volunteer plants"
      ],
      organic_options: [
        "Copper-based fungicides (organic-approved)"
      ],
      chemical_options: [
        "Metalaxyl + Mancozeb",
        "Cymoxanil combinations"
      ],
      safety_notes: "Act immediately; use full protective gear. Critical disease.",
      estimated_impact: "40-100%",
      treatment_cost: "₹1,500-3,000 per acre (organic: ₹1,000-1,800, chemical: ₹2,000-3,000)",
      nutrient_deficiency: "Phosphorus",
      nutrient_advice: {
        short_term: "Apply phosphorus-rich fertilizer (e.g., DAP) to strengthen plant immunity",
        long_term: "Regular soil testing and balanced fertilization program"
      }
    }
  };

  return recommendationsMap[disease] || recommendationsMap["Healthy"];
}

// Map disease name and confidence to full analysis result
export function mapToAnalysisResult(
  disease: string,
  confidence: number,
  plantName?: string
): any {
  // Disease-specific treatment and impact mapping
  const diseaseMap: Record<
    string,
    { treatment: string; impact: string; severity: string }
  > = {
    "Leaf Blight": {
      treatment:
        "Spray Copper oxychloride; remove infected leaves; improve drainage",
      impact: "20-40",
      severity: confidence >= 0.75 ? "Moderate" : "Early",
    },
    Rust: {
      treatment:
        "Apply Mancozeb fungicide; reduce humidity; remove infected residues",
      impact: "15-30",
      severity: confidence >= 0.75 ? "Moderate" : "Early",
    },
    "Powdery Mildew": {
      treatment: "Apply Sulfur spray; improve airflow around plants",
      impact: "10-25",
      severity: confidence >= 0.75 ? "Moderate" : "Early",
    },
    Healthy: {
      treatment:
        "Monitor weekly; maintain recommended irrigation and fertilizer schedule",
      impact: "0",
      severity: "None",
    },
    "Bacterial Spot": {
      treatment: "Apply Copper-based bactericide; avoid overhead irrigation",
      impact: "15-35",
      severity: confidence >= 0.75 ? "Moderate" : "Early",
    },
    "Early Blight": {
      treatment: "Apply Chlorothalonil; remove lower leaves; rotate crops",
      impact: "20-30",
      severity: confidence >= 0.75 ? "Moderate" : "Early",
    },
    "Late Blight": {
      treatment:
        "Apply Metalaxyl + Mancozeb; destroy infected plants immediately",
      impact: "40-100",
      severity: confidence >= 0.60 ? "Severe" : "Moderate",
    },
  };

  const diseaseInfo =
    diseaseMap[disease] ||
    diseaseMap["Healthy"] ||
    {
      treatment: "Consult local agronomist for proper diagnosis",
      impact: "Unknown",
      severity: "Uncertain",
    };

  // Override severity if confidence is too low
  if (confidence < 0.50) {
    return {
      disease: "Uncertain",
      confidence: confidence,
      severity: "Uncertain",
      treatment: "Image quality insufficient for accurate diagnosis",
      impactPercent: "Unknown",
      recommendation: "Please consult a local agronomist for proper diagnosis",
      disclaimer: AI_ADVISORY_DISCLAIMER,
      needsAgronomist: true,
      detailedRecommendations: null,
    };
  }

  // Get detailed recommendations
  const detailedRecommendations = getDetailedRecommendations(disease);

  return {
    disease: disease,
    confidence: confidence,
    ...(plantName ? { plantName } : {}),
    severity: diseaseInfo.severity,
    treatment: diseaseInfo.treatment,
    impactPercent: diseaseInfo.impact,
    recommendation:
      confidence >= 0.85
        ? "High confidence - proceed with treatment"
        : "Medium confidence - monitor closely and consider expert consultation",
    disclaimer: AI_ADVISORY_DISCLAIMER,
    needsAgronomist: confidence < 0.50,
    detailedRecommendations: detailedRecommendations,
  };
}