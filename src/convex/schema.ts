import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Farmer Profiles table - stores comprehensive farmer information
    farmerProfiles: defineTable({
      userId: v.string(),
      name: v.string(),
      district: v.string(),
      landArea: v.number(), // in acres
      soilType: v.string(),
      waterAvailability: v.string(), // Low/Medium/High
      crops: v.array(v.string()),
      language: v.string(), // en/hi/pa
    }).index("by_userId", ["userId"]),

    // Disease Detection table
    diseaseAnalyses: defineTable({
      userId: v.string(),
      diseaseName: v.string(),
      confidence: v.number(),
      severity: v.string(),
      treatment: v.string(),
      impactPercent: v.string(),
      language: v.string(),
      imageStorageId: v.optional(v.id("_storage")),
    }).index("by_userId", ["userId"]),

    // Crop Advisory table
  cropAdvisories: defineTable({
    userId: v.string(),
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
  }).index("by_userId", ["userId"]),

  schemeSearches: defineTable({
    userId: v.string(),
    farmerCategory: v.string(),
    cropType: v.string(),
    district: v.string(),
    irrigationMethod: v.optional(v.string()),
    recommendedSchemes: v.array(v.object({
      name: v.string(),
      benefit: v.string(),
      eligibility: v.string(),
      applyLink: v.string(),
      reasoning: v.optional(v.string()),
    })),
    language: v.string(),
  }).index("by_userId", ["userId"]),

  // Weather cache table for storing real-time weather data
  weatherCache: defineTable({
    district: v.string(),
    temperature: v.number(),
    condition: v.string(),
    icon: v.string(),
    humidity: v.number(),
    rainfall: v.number(),
    timestamp: v.number(),
  }).index("by_district", ["district"]),

  // Per-user AI rate limiting (sliding window counters, one row per user+action)
  aiRateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  // Cache of live mandi price results to avoid hammering data.gov.in
  mandiPriceCache: defineTable({
    cacheKey: v.string(),
    result: v.any(),
    fetchedAt: v.number(),
  }).index("by_cacheKey", ["cacheKey"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;