import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function DashboardHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const dashboardData = useQuery(api.farmers.getDashboardSummary, {});
  const fetchWeather = useAction(api.weather.fetchWeatherData);
  const farmerProfile = dashboardData?.profile;
  
  const [liveWeather, setLiveWeather] = useState<any>(null);

  // Fetch live weather when profile district is available
  useEffect(() => {
    if (farmerProfile?.district) {
      fetchWeather({ district: farmerProfile.district })
        .then((weather) => setLiveWeather(weather))
        .catch((err) => console.error("Failed to fetch weather:", err));
    }
  }, [farmerProfile?.district, fetchWeather]);

  // Show loading state while data is being fetched
  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t("dashboard.home.loading") || "Loading your personalized dashboard..."}</p>
        </div>
      </div>
    );
  }

  // Use live weather if available, otherwise fallback to dashboard data
  const weatherToDisplay = liveWeather || dashboardData.weather;

  const infoCards = [
    {
      icon: weatherToDisplay.icon,
      title: t("dashboard.home.weather"),
      value: `${weatherToDisplay.temperature}°C, ${weatherToDisplay.condition}`,
      subtitle: farmerProfile?.district ? `${farmerProfile.district}` : "",
      color: "bg-blue-50 border-blue-200",
    },
    {
      icon: "💧",
      title: t("dashboard.home.irrigation"),
      value: t("dashboard.home.irrigationValue").replace("{days}", String(dashboardData.irrigation.nextDays)),
      subtitle: dashboardData.irrigation.advice,
      color: dashboardData.irrigation.status === "urgent" 
        ? "bg-red-50 border-red-200" 
        : dashboardData.irrigation.status === "good"
        ? "bg-green-50 border-green-200"
        : "bg-cyan-50 border-cyan-200",
    },
    {
      icon: "🌿",
      title: t("dashboard.home.cropHealth"),
      value: dashboardData.cropHealth.message,
      subtitle: dashboardData.cropHealth.cropsMonitored > 0 
        ? `Monitoring ${dashboardData.cropHealth.cropsMonitored} crop(s)` 
        : "",
      color: dashboardData.cropHealth.status === "warning"
        ? "bg-amber-50 border-amber-200"
        : "bg-green-50 border-green-200",
    },
    {
      icon: "🏛️",
      title: t("dashboard.home.schemes"),
      value: dashboardData.schemes.count > 0
        ? t("dashboard.home.schemesValue").replace("{count}", String(dashboardData.schemes.count))
        : "Explore available schemes",
      subtitle: dashboardData.schemes.new ? "New recommendations available" : "",
      color: "bg-amber-50 border-amber-200",
    },
  ];

  const schemes = [
    {
      title: t("dashboard.schemes.pmkisan.title"),
      description: t("dashboard.schemes.pmkisan.description"),
      amount: "₹6,000/year",
    },
    {
      title: t("dashboard.schemes.pmfby.title"),
      description: t("dashboard.schemes.pmfby.description"),
      amount: t("dashboard.schemes.pmfby.coverage"),
    },
    {
      title: t("dashboard.schemes.soilHealth.title"),
      description: t("dashboard.schemes.soilHealth.description"),
      amount: t("dashboard.schemes.soilHealth.free"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl p-6 shadow-lg"
      >
        <h2 className="text-2xl md:text-3xl font-bold mb-2">
          {t("dashboard.home.welcome")}, {farmerProfile?.name || user?.name || "Farmer"}! 🌾
        </h2>
        {farmerProfile && (
          <p className="text-green-100 text-sm mt-1">
            📍 {farmerProfile.district} | 🌾 {farmerProfile.landArea} acres | 🌱 {farmerProfile.soilType} soil
          </p>
        )}
        <p className="text-green-100">{t("dashboard.home.subtitle")}</p>
        
        {!farmerProfile && (
          <div className="mt-4 bg-green-800/50 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-300 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-yellow-100">Complete your profile for personalized insights!</p>
              <p className="text-xs text-green-100 mt-1">
                Add your farming details to get weather updates, irrigation alerts, and crop recommendations tailored to your farm.
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {infoCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`${card.color} border-2 hover:shadow-lg transition-shadow`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{card.icon}</span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{card.title}</p>
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.subtitle}</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Latest Government Schemes */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          {t("dashboard.home.latestSchemes")}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {schemes.map((scheme, index) => (
            <motion.div
              key={scheme.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow border-2 border-green-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-start justify-between">
                    <span>{scheme.title}</span>
                    <Badge className="bg-green-600">{scheme.amount}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{scheme.description}</p>
                  <Button variant="outline" size="sm" className="w-full">
                    {t("dashboard.home.knowMore")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Future Enhancements Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <span className="text-2xl">🚀</span>
              {t("dashboard.home.futureEnhancements")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200 dark:bg-card dark:border-purple-900/60">
                <span className="text-2xl">📊</span>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("dashboard.home.yieldPrediction")}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.home.yieldPredictionDesc")}</p>
                  <Badge variant="outline" className="mt-2 text-purple-600 border-purple-300">
                    {t("dashboard.home.comingSoon")}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200 dark:bg-card dark:border-purple-900/60">
                <span className="text-2xl">💧</span>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("dashboard.home.waterTracker")}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.home.waterTrackerDesc")}</p>
                  <Badge variant="outline" className="mt-2 text-purple-600 border-purple-300">
                    {t("dashboard.home.comingSoon")}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200 dark:bg-card dark:border-purple-900/60">
                <span className="text-2xl">📱</span>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("dashboard.home.smsAccess")}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.home.smsAccessDesc")}</p>
                  <Badge variant="outline" className="mt-2 text-purple-600 border-purple-300">
                    {t("dashboard.home.comingSoon")}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-purple-200 dark:bg-card dark:border-purple-900/60">
                <span className="text-2xl">🔗</span>
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100">{t("dashboard.home.portalIntegration")}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{t("dashboard.home.portalIntegrationDesc")}</p>
                  <Badge variant="outline" className="mt-2 text-purple-600 border-purple-300">
                    {t("dashboard.home.comingSoon")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}