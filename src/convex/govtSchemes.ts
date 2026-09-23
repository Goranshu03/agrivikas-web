import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Mock scheme data
export const mockSchemes = [
  {
    name: "PM-KISAN Samman Nidhi Yojana",
    benefit: "₹6000 annual income support directly to small & marginal farmers.",
    eligibility: "All farmers owning cultivable land up to 2 hectares.",
    applyLink: "https://pmkisan.gov.in",
    categories: ["Small", "Marginal"],
    crops: ["all"],
    districts: ["all"],
  },
  {
    name: "PMFBY Crop Insurance Scheme",
    benefit: "Covers yield loss due to drought, flood, or pest attack.",
    eligibility: "Available for all notified crops and districts.",
    applyLink: "https://pmfby.gov.in",
    categories: ["Small", "Marginal", "Large"],
    crops: ["all"],
    districts: ["all"],
  },
  {
    name: "Subsidy for Drip Irrigation (Punjab Govt.)",
    benefit: "50–70% subsidy on micro-irrigation equipment.",
    eligibility: "Farmers with water-scarce land.",
    applyLink: "https://agripb.gov.in",
    categories: ["Small", "Marginal", "Large"],
    crops: ["all"],
    districts: ["Bathinda", "Moga", "Ludhiana"],
  },
  {
    name: "Punjab Crop Diversification Scheme",
    benefit: "₹1500 per acre incentive for shifting from paddy to alternative crops.",
    eligibility: "Farmers growing paddy who switch to maize, pulses, or vegetables.",
    applyLink: "https://agripb.gov.in",
    categories: ["Small", "Marginal", "Large"],
    crops: ["Maize", "Pulses", "Vegetables"],
    districts: ["all"],
  },
  {
    name: "Soil Health Card Scheme",
    benefit: "Free soil testing and nutrient management advice.",
    eligibility: "All farmers in Punjab.",
    applyLink: "https://soilhealth.dac.gov.in",
    categories: ["Small", "Marginal", "Large"],
    crops: ["all"],
    districts: ["all"],
  },
];

// Query to get scheme search history
export const getSchemeHistory = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const searches = await ctx.db
      .query("schemeSearches")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(10);

    return searches;
  },
});

// Mutation to save scheme search
export const saveSchemeSearch = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const searchId = await ctx.db.insert("schemeSearches", {
      userId: identity.subject,
      ...args,
    });

    return searchId;
  },
});

// Helper function to filter schemes based on criteria
export const filterSchemes = (
  farmerCategory: string,
  cropType: string,
  district: string
) => {
  return mockSchemes.filter((scheme) => {
    const categoryMatch = scheme.categories.includes("all") || scheme.categories.includes(farmerCategory);
    const cropMatch = scheme.crops.includes("all") || scheme.crops.includes(cropType);
    const districtMatch = scheme.districts.includes("all") || scheme.districts.includes(district);
    
    return categoryMatch && cropMatch && districtMatch;
  });
};
