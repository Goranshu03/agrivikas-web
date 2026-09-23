import { describe, expect, it } from "vitest";
import {
  getDetailedRecommendations,
  mapToAnalysisResult,
} from "./diseaseDetection";

describe("mapToAnalysisResult", () => {
  describe("severity mapping", () => {
    it("maps high confidence (>= 0.75) to Moderate for standard diseases", () => {
      const result = mapToAnalysisResult("Leaf Blight", 0.92);
      expect(result.severity).toBe("Moderate");
    });

    it("maps confidence below 0.75 to Early for standard diseases", () => {
      const result = mapToAnalysisResult("Leaf Blight", 0.60);
      expect(result.severity).toBe("Early");
    });

    it("treats 0.75 as the Moderate threshold boundary", () => {
      expect(mapToAnalysisResult("Rust", 0.75).severity).toBe("Moderate");
      expect(mapToAnalysisResult("Rust", 0.74).severity).toBe("Early");
    });

    it("uses the 0.60 threshold for Late Blight severity", () => {
      expect(mapToAnalysisResult("Late Blight", 0.60).severity).toBe("Severe");
      expect(mapToAnalysisResult("Late Blight", 0.59).severity).toBe(
        "Moderate",
      );
    });

    it("always marks Healthy as None severity regardless of confidence", () => {
      expect(mapToAnalysisResult("Healthy", 0.99).severity).toBe("None");
    });
  });

  describe("low-confidence fallback", () => {
    it("returns the Uncertain fallback for confidence below 0.50", () => {
      const result = mapToAnalysisResult("Rust", 0.40);
      expect(result).toEqual({
        disease: "Uncertain",
        confidence: 0.4,
        severity: "Uncertain",
        treatment: "Image quality insufficient for accurate diagnosis",
        impactPercent: "Unknown",
        recommendation: "Please consult a local agronomist for proper diagnosis",
        disclaimer: expect.stringContaining("consult a local agriculture expert"),
        needsAgronomist: true,
        detailedRecommendations: null,
      });
    });

    it("does not fall back at exactly 0.50 confidence", () => {
      const result = mapToAnalysisResult("Rust", 0.50);
      expect(result.disease).toBe("Rust");
      expect(result.needsAgronomist).toBe(false);
    });
  });

  describe("unknown disease default", () => {
    it("keeps the reported disease name but falls back to Healthy info", () => {
      const result = mapToAnalysisResult("Mosaic Virus", 0.90);
      expect(result.disease).toBe("Mosaic Virus");
      expect(result.severity).toBe("None");
      expect(result.impactPercent).toBe("0");
      expect(result.treatment).toContain("Monitor weekly");
    });

    it("still applies confidence-based recommendation wording", () => {
      expect(mapToAnalysisResult("Mosaic Virus", 0.90).recommendation).toBe(
        "High confidence - proceed with treatment",
      );
    });
  });

  describe("recommendation wording", () => {
    it("uses the high-confidence wording at >= 0.85", () => {
      expect(mapToAnalysisResult("Leaf Blight", 0.85).recommendation).toBe(
        "High confidence - proceed with treatment",
      );
    });

    it("uses the medium-confidence wording below 0.85", () => {
      expect(mapToAnalysisResult("Leaf Blight", 0.84).recommendation).toBe(
        "Medium confidence - monitor closely and consider expert consultation",
      );
    });

    it("sets needsAgronomist to false for confident results", () => {
      expect(mapToAnalysisResult("Rust", 0.90).needsAgronomist).toBe(false);
    });
  });

  describe("plant name passthrough", () => {
    it("includes the plant name when provided", () => {
      const result = mapToAnalysisResult("Leaf Blight", 0.9, "Tomato");
      expect(result.plantName).toBe("Tomato");
    });

    it("keeps the plant name for healthy plants", () => {
      const result = mapToAnalysisResult("Healthy", 0.95, "Wheat");
      expect(result.plantName).toBe("Wheat");
      expect(result.severity).toBe("None");
    });

    it("omits plantName when not provided", () => {
      const result = mapToAnalysisResult("Leaf Blight", 0.9);
      expect(result.plantName).toBeUndefined();
    });
  });

  describe("detailed recommendations", () => {
    it("returns structured recommendations for a known disease", () => {
      const result = mapToAnalysisResult("Leaf Blight", 0.90);
      expect(result.detailedRecommendations).toMatchObject({
        cultural_controls: expect.arrayContaining(["Remove infected leaves"]),
        organic_options: expect.any(Array),
        chemical_options: expect.any(Array),
        safety_notes: expect.any(String),
        estimated_impact: expect.any(String),
        treatment_cost: expect.any(String),
      });
    });

    it("returns the Healthy recommendation template for unknown diseases", () => {
      const result = mapToAnalysisResult("Mosaic Virus", 0.90);
      expect(result.detailedRecommendations.nutrient_deficiency).toBeNull();
      expect(result.detailedRecommendations.chemical_options).toEqual(["None"]);
    });

    it("exposes nutrient advice with short and long term actions for Rust", () => {
      const recs = getDetailedRecommendations("Rust");
      expect(recs.nutrient_deficiency).toBe("Potassium");
      expect(recs.nutrient_advice).toMatchObject({
        short_term: expect.stringContaining("potash"),
        long_term: expect.any(String),
      });
    });
  });
});
