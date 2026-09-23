import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Droplets, CloudRain, Sun, Cloud, AlertCircle, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

interface WeatherData {
  temperature: number;
  humidity: number;
  condition: string;
  description?: string;
  rainProbability?: number;
}

export default function IrrigationAlerts() {
  const { t, language } = useLanguage();
  const dashboardData = useQuery(api.farmers.getDashboardSummary, {});
  const fetchWeather = useAction(api.weather.fetchWeatherData);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Load weather data from live API
  useEffect(() => {
    if (dashboardData?.profile?.district) {
      fetchWeather({ district: dashboardData.profile.district })
        .then((weather) => {
          if (weather) {
            setWeatherData({
              temperature: weather.temperature,
              humidity: weather.humidity,
              condition: weather.condition,
              description: weather.condition.toLowerCase(),
              rainProbability: weather.rainfall > 0 ? 70 : 10,
            });
          } else if (dashboardData?.weather) {
            // Fallback to dashboard data if API returns null
            setWeatherData({
              temperature: dashboardData.weather.temperature,
              humidity: dashboardData.weather.humidity,
              condition: dashboardData.weather.condition,
              description: dashboardData.weather.condition.toLowerCase(),
              rainProbability: dashboardData.weather.rainfall > 0 ? 70 : 10,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to fetch weather:", err);
          // Fallback to dashboard data
          if (dashboardData?.weather) {
            setWeatherData({
              temperature: dashboardData.weather.temperature,
              humidity: dashboardData.weather.humidity,
              condition: dashboardData.weather.condition,
              description: dashboardData.weather.condition.toLowerCase(),
              rainProbability: dashboardData.weather.rainfall > 0 ? 70 : 10,
            });
          }
        });
    }
  }, [dashboardData?.profile?.district, fetchWeather, dashboardData?.weather]);

  const getWeatherData = () => {
    if (!dashboardData?.profile?.district) {
      toast.error("Please set your district in My Profile first");
      return;
    }
    
    setLoading(true);
    fetchWeather({ district: dashboardData.profile.district })
      .then((weather) => {
        if (weather) {
          setWeatherData({
            temperature: weather.temperature,
            humidity: weather.humidity,
            condition: weather.condition,
            description: weather.condition.toLowerCase(),
            rainProbability: weather.rainfall > 0 ? 70 : 10,
          });
          toast.success(t("irrigation.weatherUpdated"));
        } else {
          toast.error("Weather API key not configured. Using fallback data.");
          if (dashboardData?.weather) {
            setWeatherData({
              temperature: dashboardData.weather.temperature,
              humidity: dashboardData.weather.humidity,
              condition: dashboardData.weather.condition,
              description: dashboardData.weather.condition.toLowerCase(),
              rainProbability: dashboardData.weather.rainfall > 0 ? 70 : 10,
            });
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch weather:", err);
        toast.error("Failed to fetch weather data");
      })
      .finally(() => setLoading(false));
  };

  const getIrrigationAdvice = () => {
    if (!weatherData) return t("irrigation.clickRefresh");

    const { temperature, humidity, condition, rainProbability = 0 } = weatherData;

    // Logic for irrigation advice
    if (condition.toLowerCase().includes("rain") || rainProbability > 70) {
      return t("irrigation.advice.skipRain");
    } else if (temperature > 35 && humidity < 40) {
      return t("irrigation.advice.highTemp");
    } else if (humidity > 80) {
      return t("irrigation.advice.highHumidity");
    } else if (temperature < 20) {
      return t("irrigation.advice.lowTemp");
    } else {
      return t("irrigation.advice.normal");
    }
  };

  const getWeatherIcon = () => {
    if (!weatherData) return <Cloud className="h-12 w-12 text-gray-400 dark:text-gray-500 dark:text-gray-400" />;
    
    const condition = weatherData.condition.toLowerCase();
    if (condition.includes("rain")) {
      return <CloudRain className="h-12 w-12 text-blue-500" />;
    } else if (condition.includes("clear")) {
      return <Sun className="h-12 w-12 text-yellow-500" />;
    } else {
      return <Cloud className="h-12 w-12 text-gray-500 dark:text-gray-400" />;
    }
  };

  // New function to speak irrigation advice
  const speakIrrigationAdvice = () => {
    if (!("speechSynthesis" in window)) {
      toast.error("Text-to-speech not supported in this browser");
      return;
    }

    const advice = getIrrigationAdvice();
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(advice);
    
    const langMap: Record<string, string> = {
      en: "en-IN",
      hi: "hi-IN",
      pa: "pa-IN",
    };
    utterance.lang = langMap[language] || "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => {
      setIsSpeaking(false);
      toast.error("Failed to play audio");
    };

    window.speechSynthesis.speak(utterance);
    toast.success(language === "en" ? "Playing advice..." : language === "hi" ? "सलाह चल रही है..." : "ਸਲਾਹ ਚੱਲ ਰਹੀ ਹੈ...");
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl p-6 shadow-lg"
      >
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          {t("irrigation.title")} 💧
        </h2>
        <p className="text-blue-100">{t("irrigation.subtitle")}</p>
      </motion.div>

      {/* Profile Info Banner */}
      {dashboardData?.profile && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg p-4 border-2 border-blue-200 dark:bg-card dark:border-blue-900"
        >
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold">📍 Location:</span>
            <span>{dashboardData.profile.district}</span>
            <span className="mx-2">|</span>
            <span className="font-semibold">🌱 Soil:</span>
            <span>{dashboardData.profile.soilType}</span>
            <span className="mx-2">|</span>
            <span className="font-semibold">💧 Water:</span>
            <span>{dashboardData.profile.waterAvailability}</span>
          </div>
        </motion.div>
      )}

      {!dashboardData?.profile && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-amber-50 rounded-lg p-4 border-2 border-amber-200 flex items-start gap-2"
        >
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Complete your profile for personalized irrigation advice!</p>
            <p className="text-xs text-amber-700 mt-1">
              Add your district, soil type, and water availability in "My Profile" to get tailored recommendations.
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weather Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-2 border-blue-200 hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>🌤️ {t("irrigation.weather")}{dashboardData?.profile?.district ? ` - ${dashboardData.profile.district}` : ""}</span>
                <Button
                  onClick={getWeatherData}
                  disabled={loading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                  {t("irrigation.refresh")}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!weatherData ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>{t("irrigation.clickRefresh")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-center py-4">
                    {getWeatherIcon()}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t("irrigation.temperature")}</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {weatherData.temperature}°C
                      </p>
                    </div>
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t("irrigation.humidity")}</p>
                      <p className="text-2xl font-bold text-cyan-700">
                        {weatherData.humidity}%
                      </p>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg dark:bg-emerald-950/60">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t("irrigation.condition")}</p>
                    <p className="text-lg font-semibold text-gray-800 dark:text-gray-100 capitalize">
                      {weatherData.description}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Irrigation Advice Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-2 border-green-200 hover:shadow-lg transition-shadow h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-green-600" />
                {t("irrigation.adviceTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-br from-green-50 to-cyan-50 p-6 rounded-lg">
                <p className="text-lg font-medium text-gray-800 dark:text-gray-100 leading-relaxed">
                  {getIrrigationAdvice()}
                </p>
              </div>
              {weatherData && (
                <>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>{t("irrigation.tip")}:</strong> {t("irrigation.tipText")}
                    </p>
                  </div>
                  <Button
                    onClick={speakIrrigationAdvice}
                    disabled={isSpeaking}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700"
                  >
                    <Volume2 className={`h-4 w-4 mr-2 ${isSpeaking ? "animate-pulse" : ""}`} />
                    {isSpeaking 
                      ? (language === "en" ? "Playing..." : language === "hi" ? "चल रहा है..." : "ਚੱਲ ਰਿਹਾ ਹੈ...")
                      : (language === "en" ? "🔊 Listen to Advice" : language === "hi" ? "🔊 सलाह सुनें" : "🔊 ਸਲਾਹ ਸੁਣੋ")
                    }
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Additional Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-2 border-amber-200">
          <CardHeader>
            <CardTitle>💡 {t("irrigation.bestPractices")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>{t("irrigation.practice1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>{t("irrigation.practice2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>{t("irrigation.practice3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>{t("irrigation.practice4")}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}