import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Query to get crop advisory history
export const getCropAdvisoryHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const advisories = await ctx.db
      .query("cropAdvisories")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(10);

    return advisories;
  },
});

// Mutation to save crop advisory
export const saveCropAdvisory = mutation({
  args: {
    landArea: v.number(),
    soilType: v.string(),
    currentCrop: v.string(),
    district: v.string(),
    waterAvailability: v.string(),
    recommendedCrops: v.array(v.object({
      name: v.string(),
      waterSavings: v.string(),
      soilBenefit: v.string(),
      profitPotential: v.string(),
    })),
    advice: v.array(v.string()),
    cropComparison: v.array(v.object({
      crop: v.string(),
      waterUse: v.string(),
      profit: v.string(),
      soilImpact: v.string(),
    })),
    weatherData: v.optional(v.object({
      temperature: v.number(),
      humidity: v.number(),
      condition: v.string(),
    })),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const advisoryId = await ctx.db.insert("cropAdvisories", {
      userId: identity.subject,
      ...args,
    });

    return advisoryId;
  },
});

// Helper function for simulated advisory
export const getSimulatedAdvisory = (
  soilType: string,
  currentCrop: string,
  waterAvailability: string,
  temperature: number
) => {
  const recommendations: any = {
    recommendedCrops: [],
    advice: [],
    cropComparison: [],
  };

  // Rule-based logic for crop recommendations
  if (soilType === "Loamy" && currentCrop.toLowerCase().includes("wheat") && waterAvailability === "Low") {
    recommendations.recommendedCrops = [
      { name: "Maize", waterSavings: "40%", soilBenefit: "Improves soil fertility", profitPotential: "High" },
      { name: "Pulses (Moong/Urad)", waterSavings: "45%", soilBenefit: "Fixes nitrogen naturally", profitPotential: "Moderate" },
      { name: "Vegetables (Tomato/Okra)", waterSavings: "30%", soilBenefit: "Quick returns", profitPotential: "High" },
    ];
    recommendations.advice = [
      "Avoid paddy this season due to low water availability",
      "Consider intercropping maize with moong for soil fertility",
      "Maintain irrigation every 5-7 days based on rainfall",
      "Use drip irrigation to maximize water efficiency",
    ];
  } else if (soilType === "Clayey" && currentCrop.toLowerCase().includes("paddy") && temperature > 34) {
    recommendations.recommendedCrops = [
      { name: "Soybean", waterSavings: "35%", soilBenefit: "Nitrogen fixation", profitPotential: "High" },
      { name: "Vegetables (Brinjal/Chilli)", waterSavings: "40%", soilBenefit: "Good for clayey soil", profitPotential: "High" },
      { name: "Cotton", waterSavings: "25%", soilBenefit: "Deep root system", profitPotential: "Moderate" },
    ];
    recommendations.advice = [
      "High temperature makes paddy cultivation risky",
      "Soybean is ideal for current weather conditions",
      "Reduce groundwater stress by avoiding water-intensive crops",
      "Consider mulching to retain soil moisture",
    ];
  } else if (soilType === "Sandy" && currentCrop.toLowerCase().includes("maize")) {
    recommendations.recommendedCrops = [
      { name: "Wheat", waterSavings: "20%", soilBenefit: "Better yield in sandy soil", profitPotential: "High" },
      { name: "Barley", waterSavings: "30%", soilBenefit: "Low fertilizer requirement", profitPotential: "Moderate" },
      { name: "Bajra (Pearl Millet)", waterSavings: "50%", soilBenefit: "Drought resistant", profitPotential: "Moderate" },
    ];
    recommendations.advice = [
      "Sandy soil drains quickly - choose drought-resistant crops",
      "Add organic matter to improve water retention",
      "Wheat and barley perform well in sandy conditions",
      "Consider crop rotation to maintain soil health",
    ];
  } else if (waterAvailability === "Low") {
    recommendations.recommendedCrops = [
      { name: "Bajra (Pearl Millet)", waterSavings: "50%", soilBenefit: "Drought resistant", profitPotential: "Moderate" },
      { name: "Pulses (Moong/Arhar)", waterSavings: "45%", soilBenefit: "Nitrogen fixation", profitPotential: "Moderate" },
      { name: "Maize", waterSavings: "40%", soilBenefit: "Moderate water needs", profitPotential: "High" },
    ];
    recommendations.advice = [
      "Focus on drought-resistant crops due to low water availability",
      "Implement rainwater harvesting techniques",
      "Use mulching to conserve soil moisture",
      "Avoid water-intensive crops like paddy and sugarcane",
    ];
  } else if (waterAvailability === "High") {
    recommendations.recommendedCrops = [
      { name: "Rice (Paddy)", waterSavings: "0%", soilBenefit: "Suitable for high water", profitPotential: "High" },
      { name: "Sugarcane", waterSavings: "0%", soilBenefit: "Long-term crop", profitPotential: "Very High" },
      { name: "Vegetables (Leafy greens)", waterSavings: "10%", soilBenefit: "Quick harvest", profitPotential: "High" },
    ];
    recommendations.advice = [
      "High water availability allows for water-intensive crops",
      "Consider paddy or sugarcane for maximum returns",
      "Ensure proper drainage to prevent waterlogging",
      "Rotate with nitrogen-fixing crops for soil health",
    ];
  } else {
    // Default recommendations
    recommendations.recommendedCrops = [
      { name: "Maize", waterSavings: "30%", soilBenefit: "Versatile crop", profitPotential: "High" },
      { name: "Pulses", waterSavings: "40%", soilBenefit: "Soil enrichment", profitPotential: "Moderate" },
      { name: "Vegetables", waterSavings: "25%", soilBenefit: "Quick returns", profitPotential: "High" },
    ];
    recommendations.advice = [
      "Diversify crops to reduce risk and improve soil health",
      "Practice crop rotation for sustainable farming",
      "Monitor weather forecasts regularly",
      "Consider intercropping for better land utilization",
    ];
  }

  // Crop comparison table
  recommendations.cropComparison = [
    { crop: "Paddy", waterUse: "High", profit: "Moderate", soilImpact: "Reduces fertility" },
    { crop: "Maize", waterUse: "Low", profit: "High", soilImpact: "Improves fertility" },
    { crop: "Wheat", waterUse: "Moderate", profit: "High", soilImpact: "Neutral" },
    { crop: "Pulses", waterUse: "Low", profit: "Moderate", soilImpact: "Enriches soil" },
    { crop: "Vegetables", waterUse: "Moderate", profit: "High", soilImpact: "Neutral" },
  ];

  return recommendations;
};
