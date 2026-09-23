import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Store, ExternalLink, TrendingUp, AlertCircle } from "lucide-react";
import type { MandiPriceRecord } from "@/convex/mandiPrices";

// Crops mentioned across the site (profile, advisory, disease detection, schemes)
// mapped to the commodity names used in the AGMARKNET dataset.
const CROPS = [
  "Wheat",
  "Paddy",
  "Maize",
  "Cotton",
  "Sugarcane",
  "Mustard",
  "Moong",
  "Gram",
  "Tomato",
  "Onion",
  "Potato",
  "Garlic",
];

const PUNJAB_DISTRICTS = [
  "All Punjab",
  "Amritsar",
  "Bathinda",
  "Faridkot",
  "Firozpur",
  "Gurdaspur",
  "Hoshiarpur",
  "Jalandhar",
  "Kapurthala",
  "Ludhiana",
  "Moga",
  "Mohali",
  "Muktsar",
  "Pathankot",
  "Patiala",
  "Sangrur",
];

function formatPrice(value: string): string {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? `₹${num.toLocaleString("en-IN")}` : "—";
}

export default function MandiPrices() {
  const { language, t } = useLanguage();
  const farmerProfile = useQuery(api.farmers.getCurrentFarmer);
  const getMandiPrices = useAction(api.mandiPrices.getMandiPrices);

  const [selectedCrops, setSelectedCrops] = useState<string[]>(["Wheat", "Paddy"]);
  const [district, setDistrict] = useState<string>(PUNJAB_DISTRICTS[0]);
  const [records, setRecords] = useState<MandiPriceRecord[]>([]);
  const [live, setLive] = useState(false);
  const [stale, setStale] = useState(false);
  const [source, setSource] = useState("");
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Default the district from the farmer profile when available
  useEffect(() => {
    if (farmerProfile?.district) {
      const match = PUNJAB_DISTRICTS.find(
        (d) => d.toLowerCase() === farmerProfile.district.toLowerCase()
      );
      if (match) setDistrict(match);
    }
  }, [farmerProfile?.district]);

  const fetchPrices = async (crops = selectedCrops, districtOverride = district) => {
    if (crops.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getMandiPrices({
        crops,
        state: "Punjab",
        district: districtOverride === "All Punjab" ? undefined : districtOverride,
      });
      setRecords(result.records);
      setLive(result.live);
      setStale(result.stale ?? false);
      setSource(result.source);
      setFetchedAt(result.fetchedAt);
      if (result.error) setError(result.error);
    } catch (err) {
      console.error("Mandi prices error:", err);
      setRecords([]);
      setLive(false);
      setStale(false);
      setError(
        language === "en"
          ? "Could not load mandi prices. Please try again."
          : language === "hi"
            ? "मंडी भाव लोड नहीं हो सके। कृपया पुनः प्रयास करें।"
            : "ਮੰਡੀ ਭਾਅ ਲੋਡ ਨਹੀਂ ਹੋ ਸਕੇ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
      );
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch once the profile default is applied
  useEffect(() => {
    const timer = setTimeout(() => fetchPrices(), 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCrop = (crop: string) => {
    setSelectedCrops((prev) => {
      const next = prev.includes(crop)
        ? prev.filter((c) => c !== crop)
        : [...prev, crop];
      return next;
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, MandiPriceRecord[]>();
    for (const record of records) {
      const key = record.commodity;
      const list = map.get(key) || [];
      list.push(record);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [records]);

  const hasData = records.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold text-green-800 flex items-center justify-center gap-2">
          <Store className="h-8 w-8" />
          {t("mandi.title")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">{t("mandi.subtitle")}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          {live && !stale ? (
            <Badge className="bg-green-600">
              <span className="relative flex h-2 w-2 mr-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              {t("mandi.live")}
            </Badge>
          ) : live && stale ? (
            <Badge className="bg-amber-500">
              {language === "en"
                ? "Last known prices"
                : language === "hi"
                  ? "पिछले ज्ञात भाव"
                  : "ਪਿਛਲੇ ਜਾਣੇ ਭਾਅ"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              {t("mandi.offline")}
            </Badge>
          )}
          <Badge variant="outline" className="text-blue-700 border-blue-300">
            {source || "data.gov.in (AGMARKNET)"}
          </Badge>
        </div>
      </motion.div>

      {/* Controls */}
      <Card className="border-2 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-700 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("mandi.chooseCrops")}
          </CardTitle>
          <CardDescription>
            {language === "en"
              ? "Select crops and a district to see today's wholesale mandi rates"
              : language === "hi"
                ? "आज के थोक मंडी भाव देखने के लिए फसलें और जिला चुनें"
                : "ਅੱਜ ਦੇ ਥੋਕ ਮੰਡੀ ਭਾਅ ਵੇਖਣ ਲਈ ਫਸਲਾਂ ਅਤੇ ਜ਼ਿਲ੍ਹਾ ਚੁਣੋ"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CROPS.map((crop) => {
              const active = selectedCrops.includes(crop);
              return (
                <Button
                  key={crop}
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className={active ? "bg-green-600 hover:bg-green-700" : "hover:bg-green-50"}
                  onClick={() => toggleCrop(crop)}
                >
                  {crop}
                </Button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1.5">
                {t("mandi.district")}
              </label>
              <Select value={district} onValueChange={setDistrict}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PUNJAB_DISTRICTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => fetchPrices()}
              disabled={loading || selectedCrops.length === 0}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {language === "en" ? "Loading..." : language === "hi" ? "लोड हो रहा है..." : "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ..."}
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t("mandi.getPrices")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup needed card */}
      {!loading && !hasData && error && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-2 border-amber-200 bg-amber-50">
            <CardContent className="flex items-start gap-3 p-5">
              <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-800">
                  {error.includes("DATA_GOV_IN_API_KEY")
                    ? language === "en"
                      ? "Connect live mandi prices"
                      : language === "hi"
                        ? "लाइव मंडी भाव कनेक्ट करें"
                        : "ਲਾਈਵ ਮੰਡੀ ਭਾਅ ਕਨੈਕਟ ਕਰੋ"
                    : language === "en"
                      ? "No prices right now"
                      : language === "hi"
                        ? "अभी कोई भाव उपलब्ध नहीं"
                        : "ਹੁਣ ਕੋਈ ਭਾਅ ਉਪਲਬਧ ਨਹੀਂ"}
                </h3>
                <p className="text-sm text-amber-800 mt-1">{error}</p>
                {error.includes("DATA_GOV_IN_API_KEY") && (
                  <a
                    href="https://data.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-green-700 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {language === "en"
                      ? "Get a free API key at data.gov.in"
                      : language === "hi"
                        ? "data.gov.in से मुफ्त API key प्राप्त करें"
                        : "data.gov.in ਤੋਂ ਮੁਫ਼ਤ API key ਲਵੋ"}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Prices table */}
      {hasData && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {grouped.map(([commodity, rows]) => (
            <Card key={commodity} className="border-2 border-green-200 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100 pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <span className="text-xl">🌾</span>
                  {commodity}
                  <Badge className="bg-green-600 ml-auto">{rows.length} mandis</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-green-600 text-white">
                        <th className="text-left p-3 font-medium">{t("mandi.market")}</th>
                        <th className="text-left p-3 font-medium hidden md:table-cell">{t("mandi.district")}</th>
                        <th className="text-left p-3 font-medium hidden lg:table-cell">{t("mandi.variety")}</th>
                        <th className="text-right p-3 font-medium">{t("mandi.minPrice")}</th>
                        <th className="text-right p-3 font-medium">{t("mandi.maxPrice")}</th>
                        <th className="text-right p-3 font-medium">{t("mandi.modalPrice")}</th>
                        <th className="text-right p-3 font-medium hidden sm:table-cell">{t("mandi.arrivalDate")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-green-50/50 transition-colors dark:border-emerald-900 dark:hover:bg-green-900/30">
                          <td className="p-3 font-semibold text-gray-800 dark:text-gray-100">{row.market}</td>
                          <td className="p-3 text-gray-600 dark:text-gray-400 hidden md:table-cell">{row.district}</td>
                          <td className="p-3 text-gray-600 dark:text-gray-400 hidden lg:table-cell">{row.variety}</td>
                          <td className="p-3 text-right text-gray-700 dark:text-gray-300">{formatPrice(row.minPrice)}</td>
                          <td className="p-3 text-right text-gray-700 dark:text-gray-300">{formatPrice(row.maxPrice)}</td>
                          <td className="p-3 text-right">
                            <span className="inline-block px-2.5 py-1 rounded-md bg-green-100 text-green-800 font-bold">
                              {formatPrice(row.modalPrice)}
                            </span>
                          </td>
                          <td className="p-3 text-right text-gray-500 dark:text-gray-400 hidden sm:table-cell">{row.arrivalDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2.5 bg-gray-50 text-xs text-gray-500 dark:bg-emerald-950/70 dark:text-emerald-200 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    {t("mandi.unit")}: <strong>{records[0]?.unit}</strong>
                  </span>
                  {fetchedAt && (
                    <span>
                      {t("mandi.updated")}:{" "}
                      {new Date(fetchedAt).toLocaleTimeString(language === "en" ? "en-IN" : "hi-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                  <span className="ml-auto">
                    {language === "en"
                      ? "Source: Official Govt of India (data.gov.in / AGMARKNET)"
                      : language === "hi"
                        ? "स्रोत: भारत सरकार (data.gov.in / AGMARKNET)"
                        : "ਸਰੋਤ: ਭਾਰਤ ਸਰਕਾਰ (data.gov.in / AGMARKNET)"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
