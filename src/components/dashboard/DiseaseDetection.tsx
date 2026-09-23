import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Upload, Loader2, Volume2, AlertTriangle, CheckCircle2, Image as ImageIcon, Camera, X, Eye, EyeOff, ChevronDown, ChevronUp, Sprout, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Sample images for testing (base64 or URLs)
const SAMPLE_IMAGES = [
  {
    name: "Healthy Wheat",
    url: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400&h=400&fit=crop",
  },
  {
    name: "Leaf Blight",
    url: "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=400&fit=crop",
  },
  {
    name: "Rust Disease",
    url: "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=400&h=400&fit=crop",
  },
  {
    name: "Powdery Mildew",
    url: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&h=400&fit=crop",
  },
];

interface AnalysisResult {
  disease: string;
  confidence: number;
  plantName?: string;
  isPlant?: boolean;
  severity: string;
  treatment: string;
  impactPercent: string;
  recommendation: string;
  disclaimer?: string;
  needsAgronomist: boolean;
  confidenceLevel?: string;
  confidenceColor?: string;
  focusRegions?: Array<{ x: number; y: number; intensity: number }>;
  ensembleVotes?: Record<string, number>;
  detailedRecommendations?: {
    cultural_controls: string[];
    organic_options: string[];
    chemical_options: string[];
    safety_notes: string;
    estimated_impact: string;
    treatment_cost?: string;
    nutrient_deficiency?: string;
    nutrient_advice?: {
      short_term: string;
      long_term: string;
    };
  } | null;
}

interface UploadedImage {
  file: File;
  preview: string;
  type: 'closeup' | 'fullplant' | null;
}

// Blur detection function
const detectBlur = (imageElement: HTMLImageElement): Promise<boolean> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(false);
      return;
    }

    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    ctx.drawImage(imageElement, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let sum = 0;
    let count = 0;

    for (let y = 1; y < canvas.height - 1; y++) {
      for (let x = 1; x < canvas.width - 1; x++) {
        const idx = (y * canvas.width + x) * 4;
        const center = data[idx];
        const top = data[((y - 1) * canvas.width + x) * 4];
        const bottom = data[((y + 1) * canvas.width + x) * 4];
        const left = data[(y * canvas.width + (x - 1)) * 4];
        const right = data[(y * canvas.width + (x + 1)) * 4];

        const laplacian = Math.abs(4 * center - top - bottom - left - right);
        sum += laplacian;
        count++;
      }
    }

    const variance = sum / count;
    const isBlurry = variance < 10;
    resolve(isBlurry);
  });
};

export default function DiseaseDetection() {
  const { t, language } = useLanguage();
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showAgronomistModal, setShowAgronomistModal] = useState(false);
  const [showImageTypeDialog, setShowImageTypeDialog] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [agronomistPhone, setAgronomistPhone] = useState("");
  const [agronomistFarmerId, setAgronomistFarmerId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cultural: false,
    organic: false,
    chemical: false,
    safety: false,
  });

  // Convex hooks
  const analyzeMultipleImages = useAction(api.diseaseDetectionAction.analyzeMultipleImages);
  const saveDiseaseAnalysis = useMutation(api.diseaseDetection.saveDiseaseAnalysis);
  const diseaseHistory = useQuery(api.diseaseDetection.getDiseaseHistory);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.match(/^image\/(jpeg|jpg|png)$/)) {
      toast.error(t("disease.invalidFileType"));
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("disease.fileTooLarge"));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const preview = e.target?.result as string;

      // Check for blur
      const img = new Image();
      img.onload = async () => {
        const isBlurry = await detectBlur(img);
        if (isBlurry) {
          toast.error(t("disease.blurryImage"));
          return;
        }

        // Show dialog to select image type
        setPendingImage({ file, preview });
        setShowImageTypeDialog(true);
      };
      img.src = preview;
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Add image with type
  const addImageWithType = (type: 'closeup' | 'fullplant') => {
    if (!pendingImage) return;

    // Check if this type already exists
    const existingTypeIndex = uploadedImages.findIndex(img => img.type === type);
    if (existingTypeIndex !== -1) {
      // Replace existing image of this type
      const newImages = [...uploadedImages];
      newImages[existingTypeIndex] = { ...pendingImage, type };
      setUploadedImages(newImages);
      toast.success(t("disease.imageReplaced"));
    } else {
      setUploadedImages([...uploadedImages, { ...pendingImage, type }]);
      toast.success(t("disease.imageAdded"));
    }

    setPendingImage(null);
    setShowImageTypeDialog(false);
    setAnalysisResult(null);
  };

  // Remove image
  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
    setAnalysisResult(null);
  };

  // Handle sample image selection
  const handleSampleImageSelect = (imageUrl: string) => {
    // For sample images, add them as both types
    const sampleImage: UploadedImage = {
      file: null as any,
      preview: imageUrl,
      type: 'closeup'
    };
    setUploadedImages([sampleImage]);
    setAnalysisResult(null);
  };

  // Enhanced analyze with ensemble voting and chatbot notification
  const handleAnalyze = async () => {
    if (uploadedImages.length === 0) {
      toast.error(t("disease.noImages"));
      return;
    }

    if (uploadedImages.length < 2) {
      toast.error(t("disease.needMoreImages"));
      return;
    }

    // Check if we have both types
    const hasCloseup = uploadedImages.some(img => img.type === 'closeup');
    const hasFullplant = uploadedImages.some(img => img.type === 'fullplant');

    if (!hasCloseup || !hasFullplant) {
      toast.error(t("disease.needBothTypes"));
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeMultipleImages({
        images: uploadedImages.map(img => img.preview),
        language,
      });

      setAnalysisResult(result);

      // If the image doesn't contain a plant, show a friendly message and
      // skip saving to history / notifying the chatbot
      if (result.isPlant === false) {
        toast.info(
          language === "en"
            ? "This doesn't look like a plant. Please upload a clear photo of a plant leaf."
            : language === "hi"
            ? "यह पौधे जैसा नहीं दिखता। कृपया पौधे की पत्ती की साफ़ तस्वीर अपलोड करें।"
            : "ਇਹ ਪੌਦੇ ਵਰਗਾ ਨਹੀਂ ਲੱਗਦਾ। ਕਿਰਪਾ ਕਰਕੇ ਪੌਦੇ ਦੇ ਪੱਤੇ ਦੀ ਸਾਫ਼ ਤਸਵੀਰ ਅੱਪਲੋਡ ਕਰੋ।"
        );
        return;
      }

      // Save to history
      await saveDiseaseAnalysis({
        diseaseName: result.disease,
        confidence: result.confidence,
        severity: result.severity,
        treatment: result.treatment,
        impactPercent: result.impactPercent,
        language,
      });

      toast.success(t("disease.analysisComplete"));

      // Notify chatbot of analysis completion
      const analysisEvent = new CustomEvent("diseaseAnalysisComplete", {
        detail: {
          disease: result.disease,
          confidence: result.confidence,
          treatment: result.treatment,
          impact: result.impactPercent,
          nutrientDeficiency: result.detailedRecommendations?.nutrient_deficiency,
          nutrientAdvice: result.detailedRecommendations?.nutrient_advice
        }
      });
      window.dispatchEvent(analysisEvent);

      // Auto-prompt for agronomist if low confidence
      if (result.needsAgronomist) {
        setTimeout(() => {
          setShowAgronomistModal(true);
        }, 1000);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(t("disease.analysisError"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Enhanced speak result with detailed recommendations
  const speakAllRecommendations = () => {
    if (!analysisResult || !(("speechSynthesis" in window))) return;

    let text = `${t(`disease.name.${analysisResult.disease.toLowerCase().replace(/\s+/g, "")}`)}. ${getSureLabel(analysisResult.confidence)}. `;

    if (analysisResult.detailedRecommendations) {
      const recs = analysisResult.detailedRecommendations;
      
      text += `${t("disease.recommendations.cultural")}: ${recs.cultural_controls.join(", ")}. `;
      text += `${t("disease.recommendations.organic")}: ${recs.organic_options.join(", ")}. `;
      text += `${t("disease.recommendations.chemical")}: ${recs.chemical_options.join(", ")}. `;
      text += `${t("disease.recommendations.safety")}: ${recs.safety_notes}. `;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      en: "en-IN",
      hi: "hi-IN",
      pa: "pa-IN",
    };
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

  // Speak result using TTS
  const speakResult = () => {
    if (!analysisResult || !("speechSynthesis" in window)) return;

    const text = `${t(`disease.name.${analysisResult.disease.toLowerCase().replace(/\s+/g, "")}`)}. ${getSureLabel(analysisResult.confidence)}. ${t("disease.treatment")}: ${analysisResult.treatment}`;

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = {
      en: "en-IN",
      hi: "hi-IN",
      pa: "pa-IN",
    };
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

  // Submit agronomist request
  const handleAgronomistRequest = () => {
    if (!agronomistPhone) {
      toast.error("Please enter your phone number");
      return;
    }

    toast.success(t("disease.agronomist.success"));
    setShowAgronomistModal(false);
    setAgronomistPhone("");
    setAgronomistFarmerId("");
  };

  // Plain-language "how sure we are" label (instead of jargon like "confidence")
  const getSureLabel = (confidence: number): string => {
    if (confidence >= 0.85)
      return language === "en" ? "Very sure" : language === "hi" ? "बहुत पक्का" : "ਬਹੁਤ ਪੱਕਾ";
    if (confidence >= 0.6)
      return language === "en" ? "Fairly sure" : language === "hi" ? "काफी पक्का" : "ਕਾਫ਼ੀ ਪੱਕਾ";
    if (confidence >= 0.5)
      return language === "en" ? "Not fully sure" : language === "hi" ? "पूरा पक्का नहीं" : "ਪੂਰਾ ਪੱਕਾ ਨਹੀਂ";
    return language === "en" ? "Needs expert check" : language === "hi" ? "विशेषज्ञ जाँच ज़रूरी" : "ਮਾਹਰ ਜਾਂਚ ਜ਼ਰੂਰੀ";
  };

  // Color for the certainty bar
  const getSureBarColor = (confidence: number) => {
    if (confidence >= 0.85) return "bg-green-600";
    if (confidence >= 0.6) return "bg-yellow-500";
    if (confidence >= 0.5) return "bg-orange-500";
    return "bg-red-500";
  };

  // Get severity badge color
  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "none":
        return "bg-green-500";
      case "early":
      case "early stage":
        return "bg-yellow-500";
      case "moderate":
        return "bg-orange-500";
      case "severe":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Get similar diseases for comparison
  const getSimilarDiseases = (currentDisease: string): Array<{ name: string; similarity: string; keyDifference: string }> => {
    const comparisons: Record<string, Array<{ name: string; similarity: string; keyDifference: string }>> = {
      "Leaf Blight": [
        { name: "Early Blight", similarity: "Both cause leaf spots", keyDifference: "Early Blight has concentric rings" },
        { name: "Late Blight", similarity: "Both affect leaves rapidly", keyDifference: "Late Blight spreads faster, more severe" },
      ],
      "Rust": [
        { name: "Leaf Blight", similarity: "Both cause discoloration", keyDifference: "Rust has orange/brown pustules" },
        { name: "Powdery Mildew", similarity: "Both are fungal", keyDifference: "Rust has raised spots, Mildew is powdery white" },
      ],
      "Powdery Mildew": [
        { name: "Rust", similarity: "Both are fungal diseases", keyDifference: "Mildew appears as white powder" },
        { name: "Downy Mildew", similarity: "Both are mildews", keyDifference: "Powdery is on top, Downy underneath leaves" },
      ],
      "Early Blight": [
        { name: "Late Blight", similarity: "Both are blight diseases", keyDifference: "Early Blight is slower, less severe" },
        { name: "Leaf Blight", similarity: "Both cause leaf damage", keyDifference: "Early Blight has target-like spots" },
      ],
      "Late Blight": [
        { name: "Early Blight", similarity: "Both affect leaves", keyDifference: "Late Blight is more aggressive" },
        { name: "Bacterial Spot", similarity: "Both spread rapidly", keyDifference: "Late Blight is fungal, Bacterial Spot is bacterial" },
      ],
      "Bacterial Spot": [
        { name: "Late Blight", similarity: "Both spread quickly", keyDifference: "Bacterial Spot has water-soaked lesions" },
        { name: "Leaf Blight", similarity: "Both cause spots", keyDifference: "Bacterial Spot has yellow halos" },
      ],
    };
    return comparisons[currentDisease] || [];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl p-6 shadow-lg"
      >
        <h2 className="text-2xl md:text-3xl font-bold mb-2">{t("disease.title")} 🔬</h2>
        <p className="text-green-100">{t("disease.subtitle")}</p>
      </motion.div>

      {/* Photo Quality Guide */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <Camera className="h-5 w-5" />
            {t("disease.photoGuide.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-900">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">1.</span>
              <span>{t("disease.photoGuide.step1")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">2.</span>
              <span>{t("disease.photoGuide.step2")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">3.</span>
              <span>{t("disease.photoGuide.step3")}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">4.</span>
              <span>{t("disease.photoGuide.step4")}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Advisory Note */}
      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">{t("disease.advisoryNote")}</AlertDescription>
      </Alert>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Upload & Preview with Grad-CAM */}
        <Card className="border-2 border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t("disease.uploadTitle")}
              </span>
              {analysisResult?.focusRegions && analysisResult.focusRegions.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowHeatmap(!showHeatmap)}
                >
                  {showHeatmap ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showHeatmap ? "Hide heatmap" : "Show model focus 🔍"}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Image Previews with Grad-CAM overlay */}
            <div className="space-y-3">
              {uploadedImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {uploadedImages.map((img, index) => (
                    <div key={index} className="relative border-2 border-green-200 dark:border-green-900 rounded-lg p-2">
                      <div className="relative">
                        <img
                          src={img.preview}
                          alt={`Uploaded ${index + 1}`}
                          className="w-full h-32 object-cover rounded"
                        />
                        {/* Enhanced Grad-CAM Heatmap Overlay with Gradient */}
                        {showHeatmap && analysisResult?.focusRegions && analysisResult.focusRegions.length > 0 && (
                          <div className="absolute inset-0 pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 100 100">
                              <defs>
                                <radialGradient id={`heatmap-${index}`}>
                                  <stop offset="0%" stopColor="rgba(255, 0, 0, 0.8)" />
                                  <stop offset="30%" stopColor="rgba(255, 100, 0, 0.6)" />
                                  <stop offset="60%" stopColor="rgba(255, 200, 0, 0.3)" />
                                  <stop offset="100%" stopColor="rgba(255, 255, 0, 0)" />
                                </radialGradient>
                              </defs>
                              {analysisResult.focusRegions.map((region, i) => (
                                <circle
                                  key={i}
                                  cx={region.x * 100}
                                  cy={region.y * 100}
                                  r={20 * region.intensity}
                                  fill={`url(#heatmap-${index})`}
                                  opacity={region.intensity}
                                />
                              ))}
                            </svg>
                          </div>
                        )}
                      </div>
                      <Badge className="absolute top-3 left-3 bg-green-600 text-white text-xs">
                        {img.type === 'closeup' ? t("disease.closeup") : t("disease.fullplant")}
                      </Badge>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-3 right-3 h-6 w-6"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 min-h-[200px] flex items-center justify-center bg-gray-50">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <ImageIcon className="h-16 w-16 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">{t("disease.dragDrop")}</p>
                    <p className="text-xs mt-1">{t("disease.fileTypes")}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Progress Indicator */}
            {uploadedImages.length > 0 && uploadedImages.length < 2 && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {t("disease.uploadProgress").replace("{count}", uploadedImages.length.toString())}
                </AlertDescription>
              </Alert>
            )}

            {/* Upload Buttons */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="flex-1"
                disabled={uploadedImages.length >= 2}
              >
                <Upload className="h-4 w-4 mr-2" />
                {t("disease.chooseImage")}
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={uploadedImages.length < 2 || isAnalyzing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("disease.analyzing")}
                  </>
                ) : (
                  t("disease.analyzeImage")
                )}
              </Button>
            </div>

            {/* Sample Images */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">{t("disease.sampleImages")}</h4>
              <div className="grid grid-cols-4 gap-2">
                {SAMPLE_IMAGES.map((sample, index) => (
                  <button
                    key={index}
                    onClick={() => handleSampleImageSelect(sample.url)}
                    className="border-2 border-gray-200 rounded-lg p-2 hover:border-green-500 transition-colors"
                  >
                    <img
                      src={sample.url}
                      alt={sample.name}
                      className="w-full h-16 object-cover rounded"
                    />
                    <p className="text-xs mt-1 truncate">{sample.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Enhanced Results with Detailed Recommendations */}
        <Card className="border-2 border-green-200 dark:border-green-900" id="disease_results">
          <CardHeader>
            <CardTitle>{t("disease.resultsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {!analysisResult ? (
                <motion.div
                  key="no-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-gray-500 dark:text-gray-400 py-12"
                >
                  <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <p>{t("disease.noResults")}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  {analysisResult.isPlant === false ? (
                    <div className="text-center py-10 space-y-3">
                      <div className="text-5xl">🪴</div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {language === "en" ? "This doesn't look like a plant" : language === "hi" ? "यह पौधे जैसा नहीं दिखता" : "ਇਹ ਪੌਦੇ ਵਰਗਾ ਨਹੀਂ ਲੱਗਦਾ"}
                      </h3>
                      <p className="text-sm text-gray-600 max-w-md mx-auto">
                        {language === "en"
                          ? "We couldn't find a plant in this photo. Please take a clear, close-up photo of the plant's leaf, stem, or fruit and try again."
                          : language === "hi"
                          ? "हमें इस फोटो में पौधा नहीं मिला। कृपया पौधे की पत्ती, तना या फल की साफ़, करीबी तस्वीर लें और फिर से कोशिश करें।"
                          : "ਸਾਨੂੰ ਇਸ ਫੋਟੋ ਵਿੱਚ ਪੌਦਾ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਪੌਦੇ ਦੇ ਪੱਤੇ, ਤਣੇ ਜਾਂ ਫਲ ਦੀ ਸਾਫ਼, ਨਜ਼ਦੀਕੀ ਤਸਵੀਰ ਲਓ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Identified plant (plant lens) banner */}
                      {analysisResult.plantName && (
                        <div className="flex items-center gap-2 bg-green-50 border-2 border-green-200 dark:border-green-900 rounded-lg p-3">
                          <Sprout className="h-5 w-5 text-green-600 shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {language === "en" ? "Identified plant:" : language === "hi" ? "पहचाना गया पौधा:" : "ਪਛਾਣਿਆ ਗਿਆ ਪੌਦਾ:"}{" "}
                            <strong className="text-green-800">{analysisResult.plantName}</strong>
                          </span>
                        </div>
                      )}

                      {/* Disease Name with Confidence Level */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                      {analysisResult.disease === "Uncertain"
                        ? t("disease.name.uncertain")
                        : t(`disease.name.${analysisResult.disease.toLowerCase().replace(/\s+/g, "")}`)}
                    </h3>
                    {analysisResult.disease === "Healthy" ? (
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                    )}
                  </div>

                  {/* How sure we are (plain language) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">
                        {language === "en" ? "How sure we are" : language === "hi" ? "कितना पक्का है" : "ਕਿੰਨਾ ਪੱਕਾ ਹੈ"}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          {getSureLabel(analysisResult.confidence)}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({Math.round(analysisResult.confidence * 100)}%)
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getSureBarColor(analysisResult.confidence)}`}
                        style={{ width: `${analysisResult.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Low Confidence Warning */}
                  {analysisResult.needsAgronomist && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <strong>Uncertain result</strong> — Would you like to request an agronomist review?
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Severity */}
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">
                      {t("disease.severity")}
                    </span>
                    <Badge className={`${getSeverityColor(analysisResult.severity)} text-white`}>
                      {t(`disease.severity.${analysisResult.severity.toLowerCase().replace(/\s+/g, "")}`)}
                    </Badge>
                  </div>

                  {/* Treatment */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-950/40 dark:border-green-900">
                    <h4 className="font-semibold text-green-800 mb-2">
                      {t("disease.treatment")}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{analysisResult.treatment}</p>
                  </div>

                  {/* Impact */}
                  {analysisResult.impactPercent !== "0" && analysisResult.impactPercent !== "Unknown" && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                        {t("disease.impact")}
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {analysisResult.impactPercent}% yield loss if untreated
                      </p>
                    </div>
                  )}

                  {/* Detailed Recommendations Section */}
                  {analysisResult.detailedRecommendations && (
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100">
                          {t("disease.recommendations.title")}
                        </h4>
                        <Button
                          onClick={() => {
                            if (window.speechSynthesis.speaking) {
                              stopSpeaking();
                            } else {
                              speakAllRecommendations();
                            }
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <Volume2 className="h-4 w-4 mr-2" />
                          {window.speechSynthesis.speaking ? (language === "en" ? "Stop" : language === "hi" ? "रोकें" : "ਰੋਕੋ") : t("disease.recommendations.speakAll")}
                        </Button>
                      </div>

                      {/* Cultural Controls */}
                      <Collapsible
                        open={openSections.cultural}
                        onOpenChange={(open) => setOpenSections({ ...openSections, cultural: open })}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>{t("disease.recommendations.cultural")}</span>
                            {openSections.cultural ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {analysisResult.detailedRecommendations.cultural_controls.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-green-600">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Organic Options */}
                      <Collapsible
                        open={openSections.organic}
                        onOpenChange={(open) => setOpenSections({ ...openSections, organic: open })}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>{t("disease.recommendations.organic")}</span>
                            {openSections.organic ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {analysisResult.detailedRecommendations.organic_options.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-emerald-600">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Chemical Options */}
                      <Collapsible
                        open={openSections.chemical}
                        onOpenChange={(open) => setOpenSections({ ...openSections, chemical: open })}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>{t("disease.recommendations.chemical")}</span>
                            {openSections.chemical ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/40 dark:border-blue-900">
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {analysisResult.detailedRecommendations.chemical_options.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-blue-600 dark:text-blue-400">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Safety Notes */}
                      <Collapsible
                        open={openSections.safety}
                        onOpenChange={(open) => setOpenSections({ ...openSections, safety: open })}
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" className="w-full justify-between">
                            <span>{t("disease.recommendations.safety")}</span>
                            {openSections.safety ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {analysisResult.detailedRecommendations.safety_notes}
                          </p>
                        </CollapsibleContent>
                      </Collapsible>

                      {/* Estimated Impact */}
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <h5 className="font-semibold text-red-800 text-sm mb-1">
                          {t("disease.recommendations.impact")}
                        </h5>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.detailedRecommendations.estimated_impact}
                        </p>
                      </div>

                      {/* Treatment Cost Estimates */}
                      {analysisResult.detailedRecommendations.treatment_cost && (
                        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <h5 className="font-semibold text-purple-800 text-sm mb-1 flex items-center gap-2">
                            💰 {language === "en" ? "Treatment Cost Estimate" : language === "hi" ? "उपचार लागत अनुमान" : "ਇਲਾਜ ਦੀ ਲਾਗਤ ਅਨੁਮਾਨ"}
                          </h5>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {analysisResult.detailedRecommendations.treatment_cost}
                          </p>
                          <p className="text-xs text-purple-600 mt-1">
                            {language === "en" ? "* Costs may vary by region and supplier" : language === "hi" ? "* लागत क्षेत्र और आपूर्तिकर्ता के अनुसार भिन्न हो सकती है" : "* ਲਾਗਤ ਖੇਤਰ ਅਤੇ ਸਪਲਾਇਰ ਅਨੁਸਾਰ ਵੱਖਰੀ ਹੋ ਸਕਦੀ ਹੈ"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Disease Comparison Panel */}
                  {analysisResult.disease !== "Healthy" && analysisResult.disease !== "Uncertain" && (
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        🔍 {language === "en" ? "Similar Diseases - Know the Difference" : language === "hi" ? "समान रोग - अंतर जानें" : "ਸਮਾਨ ਬਿਮਾਰੀਆਂ - ਫਰਕ ਜਾਣੋ"}
                      </h4>
                      <div className="space-y-2">
                        {getSimilarDiseases(analysisResult.disease).map((comparison, idx) => (
                          <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/40 dark:border-blue-900">
                            <div className="flex items-start gap-2">
                              <span className="text-blue-600 dark:text-blue-400 font-bold">{idx + 1}.</span>
                              <div className="flex-1">
                                <h5 className="font-semibold text-blue-800 dark:text-blue-200">{comparison.name}</h5>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                  <span className="font-medium">✓ {language === "en" ? "Similar:" : language === "hi" ? "समान:" : "ਸਮਾਨ:"}</span> {comparison.similarity}
                                </p>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                                  <span className="font-medium">⚡ {language === "en" ? "Key Difference:" : language === "hi" ? "मुख्य अंतर:" : "ਮੁੱਖ ਫਰਕ:"}</span> {comparison.keyDifference}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fertilizer & Soil Health Suggestion Panel */}
                  {analysisResult.detailedRecommendations && (
                    <div className="space-y-3 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <Sprout className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-lg text-gray-800 dark:text-gray-100">
                          {t("disease.fertilizer.title")}
                        </h4>
                      </div>

                      {analysisResult.detailedRecommendations.nutrient_deficiency ? (
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 space-y-3 dark:bg-amber-950/40 dark:border-amber-900">
                          {/* Nutrient Deficiency */}
                          <div>
                            <h5 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">
                              {t("disease.fertilizer.deficiency")}
                            </h5>
                            <p className="text-base font-bold text-amber-900 dark:text-amber-100">
                              {analysisResult.detailedRecommendations.nutrient_deficiency}
                            </p>
                          </div>

                          {/* Short-term Fix */}
                          {analysisResult.detailedRecommendations.nutrient_advice && (
                            <>
                              <div className="bg-white rounded p-3 border border-amber-200 dark:bg-card dark:border-amber-900/60">
                                <h5 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">
                                  {t("disease.fertilizer.shortTerm")}
                                </h5>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {analysisResult.detailedRecommendations.nutrient_advice.short_term}
                                </p>
                              </div>

                              {/* Long-term Solution */}
                              <div className="bg-white rounded p-3 border border-amber-200 dark:bg-card dark:border-amber-900/60">
                                <h5 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">
                                  {t("disease.fertilizer.longTerm")}
                                </h5>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                  {analysisResult.detailedRecommendations.nutrient_advice.long_term}
                                </p>
                              </div>
                            </>
                          )}

                          {/* Soil Testing Center Button */}
                          <Button
                            onClick={() => window.open("https://soilhealth.dac.gov.in", "_blank")}
                            className="w-full bg-green-600 hover:bg-green-700"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {t("disease.fertilizer.soilTest")}
                          </Button>
                        </div>
                      ) : (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-950/40 dark:border-green-900">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {t("disease.fertilizer.noDeficiency")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Recommendation */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950/40 dark:border-blue-900">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                      {t("disease.recommendation")}
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{analysisResult.recommendation}</p>
                  </div>

                  {/* AI advisory disclaimer */}
                  {analysisResult.disclaimer && (
                    <p className="text-xs text-muted-foreground italic flex items-start gap-1.5">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {analysisResult.disclaimer}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button
                      onClick={() => {
                        if (window.speechSynthesis.speaking) {
                          stopSpeaking();
                        } else {
                          speakResult();
                        }
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      {window.speechSynthesis.speaking ? (language === "en" ? "Stop Speaking" : language === "hi" ? "बोलना बंद करें" : "ਬੋਲਣਾ ਬੰਦ ਕਰੋ") : t("disease.speakResult")}
                    </Button>
                    {analysisResult.needsAgronomist && (
                      <Button
                        onClick={() => setShowAgronomistModal(true)}
                        className="flex-1 bg-orange-600 hover:bg-orange-700"
                      >
                        {t("disease.requestAgronomist")}
                      </Button>
                    )}
                  </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Analysis History */}
      {diseaseHistory && diseaseHistory.length > 0 && (
        <Card className="border-2 border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle>{t("disease.historyTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {diseaseHistory.map((analysis) => (
                <div
                  key={analysis._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 dark:bg-emerald-950/60 dark:border-emerald-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-100">{analysis.diseaseName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(analysis._creationTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{Math.round(analysis.confidence * 100)}%</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Image Type Selection Dialog */}
      <Dialog open={showImageTypeDialog} onOpenChange={setShowImageTypeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disease.selectImageType")}</DialogTitle>
            <DialogDescription>{t("disease.selectImageTypeDesc")}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              onClick={() => addImageWithType('closeup')}
              className="h-24 flex flex-col gap-2 bg-green-600 hover:bg-green-700"
            >
              <Camera className="h-8 w-8" />
              <span>{t("disease.closeup")}</span>
            </Button>
            <Button
              onClick={() => addImageWithType('fullplant')}
              className="h-24 flex flex-col gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <ImageIcon className="h-8 w-8" />
              <span>{t("disease.fullplant")}</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Agronomist Request Modal */}
      <Dialog open={showAgronomistModal} onOpenChange={setShowAgronomistModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("disease.agronomist.title")}</DialogTitle>
            <DialogDescription>{t("disease.agronomist.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("disease.agronomist.phone")}
              </label>
              <Input
                type="tel"
                placeholder={t("disease.agronomist.phonePlaceholder")}
                value={agronomistPhone}
                onChange={(e) => setAgronomistPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                {t("disease.agronomist.farmerId")}
              </label>
              <Input
                type="text"
                placeholder={t("disease.agronomist.farmerIdPlaceholder")}
                value={agronomistFarmerId}
                onChange={(e) => setAgronomistFarmerId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgronomistModal(false)}>
              {t("disease.agronomist.cancel")}
            </Button>
            <Button onClick={handleAgronomistRequest} className="bg-green-600 hover:bg-green-700">
              {t("disease.agronomist.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}