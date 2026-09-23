import { useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Volume2, ExternalLink, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function GovtSchemes() {
  const { language, t } = useLanguage();
  const [farmerCategory, setFarmerCategory] = useState("");
  const [cropType, setCropType] = useState("");
  const [district, setDistrict] = useState("");
  const [irrigationMethod, setIrrigationMethod] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

  const getPersonalizedSchemes = useAction(api.govtSchemesAction.getPersonalizedSchemes);
  const saveSchemeSearch = useMutation(api.govtSchemes.saveSchemeSearch);
  const schemeHistory = useQuery(api.govtSchemes.getSchemeHistory);

  const farmerCategories = [
    { value: "Small", label: language === "en" ? "Small Farmer" : language === "hi" ? "छोटा किसान" : "ਛੋਟਾ ਕਿਸਾਨ" },
    { value: "Marginal", label: language === "en" ? "Marginal Farmer" : language === "hi" ? "सीमांत किसान" : "ਸੀਮਾਂਤ ਕਿਸਾਨ" },
    { value: "Large", label: language === "en" ? "Large Farmer" : language === "hi" ? "बड़ा किसान" : "ਵੱਡਾ ਕਿਸਾਨ" },
  ];

  const cropTypes = [
    "Wheat", "Paddy", "Maize", "Pulses", "Vegetables", "Cotton", "Sugarcane"
  ];

  const districts = [
    "Ludhiana", "Moga", "Bathinda", "Patiala", "Jalandhar", "Amritsar"
  ];

  const irrigationMethods = [
    { value: "Drip", label: language === "en" ? "Drip Irrigation" : language === "hi" ? "ड्रिप सिंचाई" : "ਡ੍ਰਿਪ ਸਿੰਚਾਈ" },
    { value: "Flood", label: language === "en" ? "Flood Irrigation" : language === "hi" ? "बाढ़ सिंचाई" : "ਹੜ੍ਹ ਸਿੰਚਾਈ" },
    { value: "Sprinkler", label: language === "en" ? "Sprinkler" : language === "hi" ? "स्प्रिंकलर" : "ਸਪ੍ਰਿੰਕਲਰ" },
  ];

  const handleFindSchemes = async () => {
    if (!farmerCategory || !cropType || !district) {
      toast.error(t("schemes.fillRequired"));
      return;
    }

    setIsSearching(true);
    try {
      const result = await getPersonalizedSchemes({
        farmerCategory,
        cropType,
        district,
        irrigationMethod,
        language,
      });

      setSchemes(result.schemes);

      // Save to database
      await saveSchemeSearch({
        farmerCategory,
        cropType,
        district,
        irrigationMethod,
        recommendedSchemes: result.schemes,
        language,
      });

      toast.success(t("schemes.foundSuccess"));
    } catch (error) {
      console.error("Error finding schemes:", error);
      toast.error(t("schemes.findFailed"));
    } finally {
      setIsSearching(false);
    }
  };

  const speakScheme = (scheme: any) => {
    if (!(("speechSynthesis" in window))) return;

    const text = `${scheme.name}. ${scheme.benefit}. ${scheme.eligibility}. ${scheme.reasoning || ""}`;
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

  const loadHistorySearch = (search: any) => {
    setSchemes(search.recommendedSchemes);
    setSelectedHistoryItem(search._id);
    toast.success(t("schemes.loadedHistory"));
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
          <Building2 className="h-8 w-8" />
          {t("schemes.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{t("schemes.subtitle")}</p>
      </motion.div>

      {/* Input Form */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-700">{t("schemes.findSchemes")}</CardTitle>
          <CardDescription>
            {t("schemes.enterDetails")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="farmerCategory">{t("schemes.farmerCategory")}</Label>
              <Select value={farmerCategory} onValueChange={setFarmerCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t("schemes.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {farmerCategories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="cropType">{t("schemes.cropType")}</Label>
              <Select value={cropType} onValueChange={setCropType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("schemes.selectCrop")} />
                </SelectTrigger>
                <SelectContent>
                  {cropTypes.map((crop) => (
                    <SelectItem key={crop} value={crop}>
                      {crop}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="district">{t("schemes.district")}</Label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue placeholder={t("schemes.selectDistrict")} />
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

            <div>
              <Label htmlFor="irrigationMethod">{t("schemes.irrigationMethod")} ({t("schemes.optional")})</Label>
              <Select value={irrigationMethod} onValueChange={setIrrigationMethod}>
                <SelectTrigger>
                  <SelectValue placeholder={t("schemes.selectMethod")} />
                </SelectTrigger>
                <SelectContent>
                  {irrigationMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleFindSchemes}
            disabled={isSearching}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {isSearching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("schemes.searching")}
              </>
            ) : (
              t("schemes.findSchemes")
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {schemes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700 flex items-center gap-2">
                🏛️ {t("schemes.recommendedSchemes")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {schemes.map((scheme, index) => (
                  <AccordionItem key={index} value={`scheme-${index}`}>
                    <AccordionTrigger className="text-left">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-2xl">{index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}</span>
                        <div>
                          <h3 className="font-bold text-lg text-green-800">{scheme.name}</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">💰 {scheme.benefit}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pl-11">
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm font-semibold text-green-700">✅ {t("schemes.eligibility")}:</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{scheme.eligibility}</p>
                        </div>
                        
                        {scheme.reasoning && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-semibold text-blue-700">🧠 {t("schemes.whyScheme")}:</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{scheme.reasoning}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => window.open(scheme.applyLink, "_blank")}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t("schemes.applyNow")}
                          </Button>
                          <Button
                            onClick={() => {
                              if (window.speechSynthesis.speaking) {
                                stopSpeaking();
                              } else {
                                speakScheme(scheme);
                              }
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <Volume2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Search History */}
      {schemeHistory && schemeHistory.length > 0 && (
        <Card className="border-2 border-gray-200 dark:border-emerald-900">
          <CardHeader>
            <CardTitle className="text-gray-700 dark:text-gray-300">{t("schemes.history")}</CardTitle>
            <CardDescription>
              {t("schemes.clickToView")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {schemeHistory.slice(0, 5).map((search: any) => (
                <button
                  key={search._id}
                  onClick={() => loadHistorySearch(search)}
                  className={`w-full p-3 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                    selectedHistoryItem === search._id
                      ? "bg-green-50 border-green-300"
                      : "bg-gray-50 border-gray-200 hover:border-green-200 dark:bg-emerald-950/60 dark:border-emerald-900 dark:hover:border-green-700"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800 dark:text-gray-100">{search.cropType} • {search.district}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{search.farmerCategory} {t("schemes.farmer")}</p>
                      <p className="text-xs text-green-600 mt-1">
                        {search.recommendedSchemes.length} {t("schemes.schemesFound")}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">
                        {new Date(search._creationTime).toLocaleDateString()}
                      </span>
                      {selectedHistoryItem === search._id && (
                        <span className="text-xs text-green-600 font-medium mt-1 block">
                          {t("schemes.viewing")}
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
