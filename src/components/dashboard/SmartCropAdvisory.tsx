import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Volume2, Sprout, Droplets, TrendingUp, Store } from "lucide-react";
import { toast } from "sonner";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SmartCropAdvisory() {
  const { language, t } = useLanguage();
  const [landArea, setLandArea] = useState("");
  const [soilType, setSoilType] = useState("");
  const [currentCrop, setCurrentCrop] = useState("");
  const [district, setDistrict] = useState("");
  const [waterAvailability, setWaterAvailability] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advisoryResult, setAdvisoryResult] = useState<any>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  const getCropRecommendations = useAction(api.cropAdvisoryAction.getCropRecommendations);
  const getMandiPrices = useAction(api.mandiPrices.getMandiPrices);
  const saveCropAdvisory = useMutation(api.cropAdvisory.saveCropAdvisory);
  const advisoryHistory = useQuery(api.cropAdvisory.getCropAdvisoryHistory);
  const [mandiPrices, setMandiPrices] = useState<any[]>([]);
  const [mandiLoading, setMandiLoading] = useState(false);
  const [mandiError, setMandiError] = useState<string | null>(null);

  const soilTypes = [
    { value: "Sandy", label: language === "en" ? "Sandy" : language === "hi" ? "रेतीली" : "ਰੇਤਲੀ" },
    { value: "Loamy", label: language === "en" ? "Loamy" : language === "hi" ? "दोमट" : "ਦੋਮਟ" },
    { value: "Clayey", label: language === "en" ? "Clayey" : language === "hi" ? "चिकनी" : "ਚਿਕਨੀ" },
  ];

  const districts = [
    "Ludhiana", "Moga", "Bathinda", "Patiala", "Jalandhar", "Amritsar"
  ];

  const waterLevels = [
    { value: "Low", label: language === "en" ? "Low" : language === "hi" ? "कम" : "ਘੱਟ" },
    { value: "Medium", label: language === "en" ? "Medium" : language === "hi" ? "मध्यम" : "ਮੱਧਮ" },
    { value: "High", label: language === "en" ? "High" : language === "hi" ? "उच्च" : "ਉੱਚ" },
  ];

  const handleGetAdvisory = async () => {
    if (!landArea || !soilType || !currentCrop || !district || !waterAvailability) {
      toast.error(language === "en" ? "Please fill all fields" : language === "hi" ? "कृपया सभी फ़ील्ड भरें" : "ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੇ ਖੇਤਰ ਭਰੋ");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await getCropRecommendations({
        landArea: parseFloat(landArea),
        soilType,
        currentCrop,
        district,
        waterAvailability,
        language,
      });

      setAdvisoryResult(result);

      // Fetch live mandi prices for the recommended crops
      const recommendedNames = result.recommendedCrops?.map((c: any) => c.name) || [];
      if (recommendedNames.length > 0) {
        setMandiLoading(true);
        setMandiError(null);
        try {
          const mandiResult = await getMandiPrices({ crops: recommendedNames, state: "Punjab", district });
          setMandiPrices(mandiResult.records || []);
          if (mandiResult.error) setMandiError(mandiResult.error);
        } catch (err) {
          console.error("Mandi fetch error:", err);
          setMandiPrices([]);
          setMandiError(language === "en" ? "Could not load mandi prices" : language === "hi" ? "मंडी भाव लोड नहीं हो सके" : "ਮੰਡੀ ਭਾਅ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੇ");
        } finally {
          setMandiLoading(false);
        }
      }

      // Save to database
      await saveCropAdvisory({
        landArea: parseFloat(landArea),
        soilType,
        currentCrop,
        district,
        waterAvailability,
        recommendedCrops: result.recommendedCrops,
        advice: result.advice,
        cropComparison: result.cropComparison,
        weatherData: result.weatherData,
        language,
      });

      toast.success(t("disease.analysisComplete"));
    } catch (error) {
      console.error("Error getting advisory:", error);
      toast.error(language === "en" ? "Failed to get advisory" : language === "hi" ? "सलाह प्राप्त करने में विफल" : "ਸਲਾਹ ਪ੍ਰਾਪਤ ਕਰਨ ਵਿੱਚ ਅਸਫਲ");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const speakAdvice = () => {
    if (!advisoryResult || !("speechSynthesis" in window)) return;

    const text = `
      ${t("advisory.recommendedCrops")}: ${advisoryResult.recommendedCrops.map((c: any) => c.name).join(", ")}.
      ${t("advisory.advice")}: ${advisoryResult.advice.join(". ")}
    `;

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
    utterance.lang = langMap[language] || "en-IN";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
    toast.success(
      language === "en" 
        ? "🔊 Speaking... Click speaker again to stop" 
        : language === "hi" 
        ? "🔊 बोल रहे हैं... रोकने के लिए फिर से स्पीकर पर क्लिक करें" 
        : "🔊 ਬੋਲ ਰਹੇ ਹਾਂ... ਰੋਕਣ ਲਈ ਦੁਬਾਰਾ ਸਪੀਕਰ 'ਤੇ ਕਲਿੱਕ ਕਰੋ"
    );
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      toast.info(
        language === "en" 
          ? "🔇 Speech stopped" 
          : language === "hi" 
          ? "🔇 भाषण बंद कर दिया गया" 
          : "🔇 ਬੋਲਣਾ ਬੰਦ ਕੀਤਾ ਗਿਆ"
      );
    }
  };

  const loadHistoryAdvisory = (advisory: any) => {
    setAdvisoryResult({
      recommendedCrops: advisory.recommendedCrops,
      advice: advisory.advice,
      cropComparison: advisory.cropComparison,
      weatherData: advisory.weatherData,
    });
    setSelectedHistoryItem(advisory._id);
    toast.success(language === "en" ? "Advisory loaded from history" : language === "hi" ? "इतिहास से सलाह लोड की गई" : "ਇਤਿਹਾਸ ਤੋਂ ਸਲਾਹ ਲੋਡ ਕੀਤੀ ਗਈ");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-green-800 flex items-center justify-center gap-2">
          <Sprout className="h-8 w-8" />
          {t("advisory.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{t("advisory.subtitle")}</p>
      </motion.div>

      {/* Input Form */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-700">{t("advisory.getAdvisory")}</CardTitle>
          <CardDescription>{language === "en" ? "Enter your farm details for personalized recommendations" : language === "hi" ? "व्यक्तिगत सिफारिशों के लिए अपने खेत का विवरण दर्ज करें" : "ਵਿਅਕਤੀਗਤ ਸਿਫਾਰਸ਼ਾਂ ਲਈ ਆਪਣੇ ਖੇਤ ਦਾ ਵੇਰਵਾ ਦਰਜ ਕਰੋ"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="landArea">{t("advisory.landArea")}</Label>
              <Input
                id="landArea"
                type="number"
                placeholder="5"
                value={landArea}
                onChange={(e) => setLandArea(e.target.value)}
                min="0.1"
                step="0.1"
              />
            </div>

            <div>
              <Label htmlFor="soilType">{t("advisory.soilType")}</Label>
              <Select value={soilType} onValueChange={setSoilType}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "Select soil type" : language === "hi" ? "मिट्टी का प्रकार चुनें" : "ਮਿੱਟੀ ਦੀ ਕਿਸਮ ਚੁਣੋ"} />
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

            <div>
              <Label htmlFor="currentCrop">{t("advisory.currentCrop")}</Label>
              <Input
                id="currentCrop"
                placeholder={language === "en" ? "e.g., Wheat, Paddy" : language === "hi" ? "जैसे, गेहूं, धान" : "ਜਿਵੇਂ, ਕਣਕ, ਝੋਨਾ"}
                value={currentCrop}
                onChange={(e) => setCurrentCrop(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="district">{t("advisory.district")}</Label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "Select district" : language === "hi" ? "जिला चुनें" : "ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ"} />
                </SelectTrigger>
                <SelectContent>
                  {districts.map((dist) => (
                    <SelectItem key={dist} value={dist}>
                      {dist}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="waterAvailability">{t("advisory.waterAvailability")}</Label>
              <Select value={waterAvailability} onValueChange={setWaterAvailability}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "en" ? "Select water availability" : language === "hi" ? "पानी की उपलब्धता चुनें" : "ਪਾਣੀ ਦੀ ਉਪਲਬਧਤਾ ਚੁਣੋ"} />
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
          </div>

          <Button
            onClick={handleGetAdvisory}
            disabled={isAnalyzing}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {language === "en" ? "Analyzing..." : language === "hi" ? "विश्लेषण कर रहे हैं..." : "ਵਿਸ਼ਲੇਸ਼ਣ ਕਰ ਰਹੇ ਹਾਂ..."}
              </>
            ) : (
              t("advisory.getAdvisory")
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {advisoryResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Live Mandi Prices for Recommended Crops */}
          {(mandiPrices.length > 0 || mandiLoading || mandiError) && (
            <Card className="border-2 border-emerald-200">
              <CardHeader>
                <CardTitle className="text-emerald-700 flex items-center gap-2">
                  <Store className="h-6 w-6" />
                  {language === "en" ? "Today's Mandi Prices" : language === "hi" ? "आज के मंडी भाव" : "ਅੱਜ ਦੇ ਮੰਡੀ ਭਾਅ"}
                </CardTitle>
                <CardDescription>
                  {language === "en"
                    ? "Live wholesale prices of your recommended crops (source: data.gov.in AGMARKNET)"
                    : language === "hi"
                      ? "आपकी अनुशंसित फसलों के लाइव थोक भाव (स्रोत: data.gov.in AGMARKNET)"
                      : "ਤੁਹਾਡੀਆਂ ਸਿਫਾਰਸ਼ ਕੀਤੀਆਂ ਫਸਲਾਂ ਦੇ ਲਾਈਵ ਥੋਕ ਭਾਅ (ਸਰੋਤ: data.gov.in AGMARKNET)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {mandiLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {language === "en" ? "Loading live prices..." : language === "hi" ? "लाइव भाव लोड हो रहे हैं..." : "ਲਾਈਵ ਭਾਅ ਲੋਡ ਹੋ ਰਹੇ ਹਨ..."}
                  </div>
                ) : mandiPrices.length === 0 ? (
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
                    <span>⚠️</span>
                    <span>{mandiError || (language === "en" ? "No prices available yet" : language === "hi" ? "अभी कोई भाव उपलब्ध नहीं" : "ਹੁਣ ਕੋਈ ਭਾਅ ਉਪਲਬਧ ਨਹੀਂ")}</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-emerald-600 text-white">
                          <th className="text-left p-2.5 font-medium">{language === "en" ? "Crop" : language === "hi" ? "फसल" : "ਫਸਲ"}</th>
                          <th className="text-left p-2.5 font-medium">{language === "en" ? "Market" : language === "hi" ? "मंडी" : "ਮੰਡੀ"}</th>
                          <th className="text-right p-2.5 font-medium">{language === "en" ? "Modal Price" : language === "hi" ? "मुख्य भाव" : "ਮੁੱਖ ਭਾਅ"}</th>
                          <th className="text-right p-2.5 font-medium hidden sm:table-cell">{language === "en" ? "Range" : language === "hi" ? "सीमा" : "ਸੀਮਾ"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mandiPrices.slice(0, 8).map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 dark:border-emerald-900">
                            <td className="p-2.5 font-semibold text-gray-800 dark:text-gray-100">🌾 {row.commodity}</td>
                            <td className="p-2.5 text-gray-600 dark:text-gray-400">{row.market}</td>
                            <td className="p-2.5 text-right">
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                ₹{Number(row.modalPrice).toLocaleString("en-IN")}
                              </span>
                            </td>
                            <td className="p-2.5 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                              ₹{Number(row.minPrice).toLocaleString("en-IN")} – ₹{Number(row.maxPrice).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-gray-400 mt-2">
                      {language === "en" ? "Per quintal (100 kg) • Updated today" : language === "hi" ? "प्रति क्विंटल (100 किग्रा) • आज अपडेट" : "ਪ੍ਰਤੀ ਕੁਇੰਟਲ (100 ਕਿਲੋ) • ਅੱਜ ਅੱਪਡੇਟ"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recommended Crops */}
          <Card className="border-2 border-green-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-700 flex items-center gap-2">
                  <Sprout className="h-6 w-6" />
                  {t("advisory.recommendedCrops")}
                </CardTitle>
                <Button 
                  onClick={() => {
                    if (window.speechSynthesis.speaking) {
                      stopSpeaking();
                    } else {
                      speakAdvice();
                    }
                  }} 
                  variant="outline" 
                  size="sm"
                >
                  <Volume2 className="h-4 w-4 mr-2" />
                  {window.speechSynthesis.speaking ? (language === "en" ? "Stop" : language === "hi" ? "रोकें" : "ਰੋਕੋ") : t("advisory.speakAdvice")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {advisoryResult.recommendedCrops.map((crop: any, index: number) => (
                <div key={index} className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{index === 0 ? "🌾" : index === 1 ? "🌿" : "🌱"}</span>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-green-800">{index + 1}. {crop.name}</h3>
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-blue-600" />
                          <span className="text-gray-700">{language === "en" ? "Water Savings" : language === "hi" ? "पानी की बचत" : "ਪਾਣੀ ਦੀ ਬਚਤ"}: <strong className="text-blue-600">{crop.waterSavings}</strong></span>
                        </p>
                        <p className="flex items-center gap-2">
                          <Sprout className="h-4 w-4 text-green-600" />
                          <span className="text-gray-700">{language === "en" ? "Soil Benefit" : language === "hi" ? "मिट्टी लाभ" : "ਮਿੱਟੀ ਲਾਭ"}: <strong className="text-green-600">{crop.soilBenefit}</strong></span>
                        </p>
                        <p className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-amber-600" />
                          <span className="text-gray-700">{language === "en" ? "Profit Potential" : language === "hi" ? "लाभ क्षमता" : "ਲਾਭ ਸੰਭਾਵਨਾ"}: <strong className="text-amber-600">{crop.profitPotential}</strong></span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Farming Advice */}
          <Card className="border-2 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-700 flex items-center gap-2">
                💡 {t("advisory.advice")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {advisoryResult.advice.map((tip: string, index: number) => (
                  <li key={index} className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                    <span className="text-xl">{tip.includes("Avoid") || tip.includes("बचें") || tip.includes("ਬਚੋ") ? "⚠️" : "✅"}</span>
                    <span className="text-gray-700">{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Crop Comparison Table */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700">{t("advisory.cropComparison")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-blue-200">
                      <th className="text-left p-3 font-semibold">{language === "en" ? "Crop" : language === "hi" ? "फसल" : "ਫਸਲ"}</th>
                      <th className="text-left p-3 font-semibold">{t("advisory.waterUse")}</th>
                      <th className="text-left p-3 font-semibold">{t("advisory.profit")}</th>
                      <th className="text-left p-3 font-semibold">{t("advisory.soilImpact")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advisoryResult.cropComparison.map((crop: any, index: number) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="p-3 font-medium">{crop.crop}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-sm ${
                            crop.waterUse === "High" ? "bg-red-100 text-red-700" :
                            crop.waterUse === "Moderate" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {crop.waterUse}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-sm ${
                            crop.profit === "High" || crop.profit === "Very High" ? "bg-green-100 text-green-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {crop.profit}
                          </span>
                        </td>
                        <td className="p-3 text-sm">{crop.soilImpact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Advisory History */}
      {advisoryHistory && advisoryHistory.length > 0 && (
        <Card className="border-2 border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-700">{t("advisory.history")}</CardTitle>
            <CardDescription>
              {language === "en" ? "Click any advisory to view full details" : language === "hi" ? "पूर्ण विवरण देखने के लिए किसी भी सलाह पर क्लिक करें" : "ਪੂਰੇ ਵੇਰਵੇ ਲਈ ਕਿਸੇ ਵੀ ਸਲਾਹ 'ਤੇ ਕਲਿੱਕ ਕਰੋ"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {advisoryHistory.slice(0, 5).map((advisory: any) => (
                <button
                  key={advisory._id}
                  onClick={() => loadHistoryAdvisory(advisory)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                    selectedHistoryItem === advisory._id
                      ? "bg-green-50 border-green-300"
                      : "bg-gray-50 border-gray-200 hover:border-green-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{advisory.currentCrop} • {advisory.district}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{advisory.soilType} • {advisory.waterAvailability} {language === "en" ? "water" : language === "hi" ? "पानी" : "ਪਾਣੀ"}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {advisory.recommendedCrops.length} {language === "en" ? "crops recommended" : language === "hi" ? "फसलें सुझाई गईं" : "ਫਸਲਾਂ ਸਿਫਾਰਸ਼ ਕੀਤੀਆਂ"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">
                        {new Date(advisory._creationTime).toLocaleDateString()}
                      </span>
                      {selectedHistoryItem === advisory._id && (
                        <span className="text-xs text-green-600 font-medium mt-1 block">
                          {language === "en" ? "✓ Viewing" : language === "hi" ? "✓ देख रहे हैं" : "✓ ਦੇਖ ਰਹੇ ਹੋ"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}