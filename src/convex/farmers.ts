import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Query to get current farmer's profile
export const getCurrentFarmer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("farmerProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    return profile;
  },
});

// Helper function to calculate irrigation recommendation
function calculateIrrigationDays(
  soilType: string,
  waterAvailability: string,
  temperature: number,
  humidity: number,
  rainfall: number
): { nextDays: number; status: "urgent" | "adequate" | "good"; advice: string } {
  let baseDays = 3;
  
  if (soilType === "Sandy") baseDays -= 1;
  if (soilType === "Clay") baseDays += 1;
  
  if (waterAvailability === "Low") baseDays -= 1;
  if (waterAvailability === "High") baseDays += 1;
  
  if (temperature > 35) baseDays -= 1;
  if (humidity > 70) baseDays += 1;
  if (rainfall > 5) baseDays += 2;
  
  baseDays = Math.max(1, Math.min(7, baseDays));
  
  let status: "urgent" | "adequate" | "good" = "adequate";
  let advice = "Normal irrigation schedule";
  
  if (baseDays <= 1) {
    status = "urgent";
    advice = "Irrigate immediately - hot and dry conditions";
  } else if (baseDays >= 5) {
    status = "good";
    advice = "Soil moisture adequate - delay irrigation";
  }
  
  return { nextDays: baseDays, status, advice };
}

// Query to get dashboard summary - accepts weather data as input
export const getDashboardSummary = query({
  args: {
    weatherOverride: v.optional(v.object({
      temperature: v.number(),
      condition: v.string(),
      icon: v.string(),
      humidity: v.number(),
      rainfall: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const profile = await ctx.db
      .query("farmerProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    const recentDiseases = await ctx.db
      .query("diseaseAnalyses")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(5);

    const recentSchemes = await ctx.db
      .query("schemeSearches")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(3);

    // Use provided weather data or default
    const weatherData = args.weatherOverride || {
      temperature: 28,
      condition: "Partly Cloudy",
      icon: "🌤️",
      humidity: 65,
      rainfall: 0,
    };

    let irrigationData = {
      nextDays: 2,
      status: "adequate" as "urgent" | "adequate" | "good",
      advice: "Normal irrigation schedule",
    };

    if (profile) {
      irrigationData = calculateIrrigationDays(
        profile.soilType,
        profile.waterAvailability,
        weatherData.temperature,
        weatherData.humidity,
        weatherData.rainfall
      );
    }

    let cropHealthStatus = "good";
    let cropHealthMessage = "No issues detected";
    
    if (recentDiseases.length > 0) {
      const unhealthyCrops = recentDiseases.filter(d => d.diseaseName !== "Healthy");
      if (unhealthyCrops.length > 0) {
        cropHealthStatus = "warning";
        const latestDisease = unhealthyCrops[0];
        cropHealthMessage = `${latestDisease.diseaseName} detected`;
      } else {
        cropHealthMessage = `All ${profile?.crops.length || 0} crops healthy`;
      }
    } else if (profile?.crops) {
      cropHealthMessage = `Monitoring ${profile.crops.length} crop(s)`;
    }

    return {
      weather: weatherData,
      irrigation: irrigationData,
      cropHealth: {
        status: cropHealthStatus,
        message: cropHealthMessage,
        cropsMonitored: profile?.crops.length || 0,
      },
      schemes: {
        count: recentSchemes.length,
        new: recentSchemes.length > 0,
      },
      profile: profile || null,
    };
  },
});

// Mutation to create or update farmer profile
export const saveProfile = mutation({
  args: {
    name: v.string(),
    district: v.string(),
    landArea: v.number(),
    soilType: v.string(),
    waterAvailability: v.string(),
    crops: v.array(v.string()),
    language: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if profile exists
    const existingProfile = await ctx.db
      .query("farmerProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        name: args.name,
        district: args.district,
        landArea: args.landArea,
        soilType: args.soilType,
        waterAvailability: args.waterAvailability,
        crops: args.crops,
        language: args.language,
      });
      return { success: true, profileId: existingProfile._id, isNew: false };
    } else {
      // Create new profile
      const profileId = await ctx.db.insert("farmerProfiles", {
        userId: identity.subject,
        name: args.name,
        district: args.district,
        landArea: args.landArea,
        soilType: args.soilType,
        waterAvailability: args.waterAvailability,
        crops: args.crops,
        language: args.language,
      });
      return { success: true, profileId, isNew: true };
    }
  },
});
