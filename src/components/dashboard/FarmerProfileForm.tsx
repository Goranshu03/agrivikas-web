import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function FarmerProfileForm() {
  const { t, language } = useLanguage();
  const existingProfile = useQuery(api.farmers.getCurrentFarmer);
  const saveProfile = useMutation(api.farmers.saveProfile);

  const [formData, setFormData] = useState({
    name: existingProfile?.name || "",
    district: existingProfile?.district || "",
    landArea: existingProfile?.landArea || 0,
    soilType: existingProfile?.soilType || "",
    waterAvailability: existingProfile?.waterAvailability || "",
    crops: existingProfile?.crops || [],
    language: existingProfile?.language || language,
  });

  const [loading, setLoading] = useState(false);

  const punjabDistricts = [
    "Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda",
    "Mohali", "Hoshiarpur", "Moga", "Pathankot", "Sangrur",
    "Firozpur", "Kapurthala", "Faridkot", "Gurdaspur", "Muktsar",
  ];

  const soilTypes = [
    { value: "Loamy", label: t("profile.loamy") },
    { value: "Sandy", label: t("profile.sandy") },
    { value: "Clay", label: t("profile.clay") },
    { value: "Alluvial", label: t("profile.alluvial") },
  ];

  const waterLevels = [
    { value: "Low", label: t("profile.low") },
    { value: "Medium", label: t("profile.medium") },
    { value: "High", label: t("profile.high") },
  ];

  const cropOptions = [
    { value: "Wheat", label: t("profile.wheat") },
    { value: "Rice", label: t("profile.rice") },
    { value: "Maize", label: t("profile.maize") },
    { value: "Cotton", label: t("profile.cotton") },
    { value: "Sugarcane", label: t("profile.sugarcane") },
    { value: "Pulses", label: t("profile.pulses") },
    { value: "Vegetables", label: t("profile.vegetables") },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.district || !formData.soilType || !formData.waterAvailability || formData.crops.length === 0) {
      toast.error(t("profile.fillAllFields"));
      return;
    }

    setLoading(true);
    try {
      const result = await saveProfile({
        name: formData.name,
        district: formData.district,
        landArea: formData.landArea,
        soilType: formData.soilType,
        waterAvailability: formData.waterAvailability,
        crops: formData.crops,
        language: formData.language,
      });

      if (result.isNew) {
        toast.success(t("profile.profileSaved"));
      } else {
        toast.success(t("profile.profileUpdated"));
      }
    } catch (error) {
      toast.error("Failed to save profile");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCrop = (crop: string) => {
    setFormData((prev) => ({
      ...prev,
      crops: prev.crops.includes(crop)
        ? prev.crops.filter((c) => c !== crop)
        : [...prev.crops, crop],
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <Card className="border-2 border-green-200">
        <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
          <CardTitle className="text-2xl">
            👨‍🌾 {t("profile.title")}
          </CardTitle>
          <p className="text-green-100 text-sm">{t("profile.subtitle")}</p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Full Name */}
            <div>
              <Label htmlFor="name">{t("profile.fullName")} *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Gurpreet Singh"
                required
              />
            </div>

            {/* District */}
            <div>
              <Label htmlFor="district">{t("profile.district")} *</Label>
              <Select value={formData.district} onValueChange={(value) => setFormData({ ...formData, district: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("profile.selectDistrict")} />
                </SelectTrigger>
                <SelectContent>
                  {punjabDistricts.map((district) => (
                    <SelectItem key={district} value={district}>
                      {district}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Land Area */}
            <div>
              <Label htmlFor="landArea">{t("profile.landArea")} *</Label>
              <Input
                id="landArea"
                type="number"
                min="0"
                step="0.1"
                value={formData.landArea}
                onChange={(e) => setFormData({ ...formData, landArea: parseFloat(e.target.value) || 0 })}
                placeholder="5"
                required
              />
            </div>

            {/* Soil Type */}
            <div>
              <Label htmlFor="soilType">{t("profile.soilType")} *</Label>
              <Select value={formData.soilType} onValueChange={(value) => setFormData({ ...formData, soilType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("profile.selectSoilType")} />
                </SelectTrigger>
                <SelectContent>
                  {soilTypes.map((soil) => (
                    <SelectItem key={soil.value} value={soil.value}>
                      {soil.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Water Availability */}
            <div>
              <Label htmlFor="waterAvailability">{t("profile.waterAvailability")} *</Label>
              <Select value={formData.waterAvailability} onValueChange={(value) => setFormData({ ...formData, waterAvailability: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t("profile.selectWaterAvailability")} />
                </SelectTrigger>
                <SelectContent>
                  {waterLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Crops */}
            <div>
              <Label>{t("profile.crops")} *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {cropOptions.map((crop) => (
                  <Button
                    key={crop.value}
                    type="button"
                    variant={formData.crops.includes(crop.value) ? "default" : "outline"}
                    className={formData.crops.includes(crop.value) ? "bg-green-600" : ""}
                    onClick={() => toggleCrop(crop.value)}
                  >
                    {crop.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("profile.saveProfile")}...
                </>
              ) : existingProfile ? (
                t("profile.updateProfile")
              ) : (
                t("profile.saveProfile")
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
