import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardHome from "@/components/dashboard/DashboardHome";
import IrrigationAlerts from "@/components/dashboard/IrrigationAlerts";
import DiseaseDetection from "@/components/dashboard/DiseaseDetection";
import SmartCropAdvisory from "@/components/dashboard/SmartCropAdvisory";
import GovtSchemes from "@/components/dashboard/GovtSchemes";
import MandiPrices from "@/components/dashboard/MandiPrices";
import FarmerProfileForm from "@/components/dashboard/FarmerProfileForm";
import ChatAssistant from "@/components/dashboard/ChatAssistant";
import VoiceChatbot from "@/components/VoiceChatbot";

export default function Dashboard() {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState("home");

  // Check for section parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section) {
      setCurrentSection(section);
      // Clean up URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <DashboardLayout currentSection={currentSection} onSectionChange={setCurrentSection}>
        {currentSection === "home" && <DashboardHome />}
        {currentSection === "profile" && <FarmerProfileForm />}
        {currentSection === "advisory" && <SmartCropAdvisory />}
        {currentSection === "irrigation" && <IrrigationAlerts />}
        {currentSection === "disease" && <DiseaseDetection />}
        {currentSection === "schemes" && <GovtSchemes />}
        {currentSection === "mandi" && <MandiPrices />}
        {currentSection === "insights" && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold">Farm Insights - Coming Soon</h2>
          </div>
        )}
        {currentSection === "chat" && <ChatAssistant />}
        {currentSection === "settings" && (
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold">Settings - Coming Soon</h2>
          </div>
        )}
      </DashboardLayout>
      <VoiceChatbot onNavigate={setCurrentSection} />
    </>
  );
}