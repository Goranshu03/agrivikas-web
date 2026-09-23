import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { Mic, X, Send, Volume2, VolumeX, MessageCircle, Camera } from "lucide-react";
import { toast } from "sonner";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  action?: {
    type: "open_disease_detection" | "open_irrigation" | "open_schemes" | "open_advisory" | "view_full_report";
    label: string;
    target?: string;
  };
}

interface VoiceChatbotProps {
  onNavigate?: (section: string) => void;
}

export default function VoiceChatbot({ onNavigate }: VoiceChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [, setHighlightUpload] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { language, t } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthesizeSpeech = useAction(api.noizTts.synthesizeSpeech);

  const getChatResponse = useAction(api.chatbot.getChatResponse);
  const dashboardData = useQuery(api.farmers.getDashboardSummary, {});

  // Load voices eagerly and keep them updated
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
        return;
      }
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;

        const langMap: Record<string, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
        recognitionRef.current.lang = langMap[language] || "en-IN";

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleSendMessage(transcript);
          setIsRecording(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          setIsRecording(false);
          if (event.error === "not-allowed" || event.error === "permission-denied") {
            toast.error(language === "en" ? "🚫 Microphone access denied." : language === "hi" ? "🚫 माइक्रोफ़ोन एक्सेस अस्वीकृत।" : "🚫 ਮਾਈਕ੍ਰੋਫੋਨ ਪਹੁੰਚ ਅਸਵੀਕਾਰ।");
          } else if (event.error === "no-speech") {
            toast.error(language === "en" ? "No speech detected." : language === "hi" ? "कोई आवाज़ नहीं मिली।" : "ਕੋਈ ਆਵਾਜ਼ ਨਹੀਂ ਮਿਲੀ।");
          } else {
            toast.error(t("chatbot.error.microphone"));
          }
        };

        recognitionRef.current.onend = () => setIsRecording(false);
    }
  }, [language]);

  useEffect(() => {
    if (recognitionRef.current) {
      const langMap: Record<string, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
      recognitionRef.current.lang = langMap[language] || "en-IN";
    }
  }, [language]);

  // Enhanced intent detection with disease-specific keywords
  const detectIntent = (message: string): string | null => {
    const lowerMessage = message.toLowerCase();
    
    // Greeting keywords
    const greetingKeywords = [
      "hello", "hi", "hey", "namaste", "नमस्ते", "ਸਤ ਸ੍ਰੀ ਅਕਾਲ", 
      "sat sri akal", "good morning", "good evening"
    ];
    
    // Disease detection keywords (multilingual)
    const diseaseKeywords = [
      // English
      "disease", "leaf", "detect", "check my crop", "infection", "diagnose", "symptom",
      "sick", "problem", "issue", "spot", "yellow", "brown", "dying", "unhealthy",
      // Hindi
      "बीमारी", "रोग", "पत्ती", "जांच", "संक्रमण", "निदान", "लक्षण",
      // Punjabi
      "ਬਿਮਾਰੀ", "ਰੋਗ", "ਪੱਤਾ", "ਜਾਂਚ", "ਸੰਕਰਮਣ", "ਨਿਦਾਨ", "ਲੱਛਣ"
    ];
    
    // Irrigation keywords
    const irrigationKeywords = [
      "water", "irrigation", "irrigate", "rain", "weather", "पानी", "सिंचाई",
      "मौसम", "ਪਾਣੀ", "ਸਿੰਚਾई", "ਮੌਸਮ"
    ];
    
    // Schemes keywords
    const schemesKeywords = [
      "scheme", "subsidy", "government", "pm-kisan", "benefit", "योजना", "सब्सिडी",
      "सरकार", "ਯੋਜਨਾ", "ਸਬਸਿਡੀ", "ਸਰਕਾਰ", "लाभ", "ਲਾਭ"
    ];
    
    // Crop advisory keywords
    const advisoryKeywords = [
      // English
      "crop", "suggest crop", "what to plant", "what to grow", "best crop", "crop recommendation",
      "soil", "which crop", "crop advice", "crop advisory", "diversification", "alternate crop",
      "change crop", "switch crop", "fasal", "crop for my land",
      // Hindi
      "फसल", "फसल सुझाव", "क्या उगाएं", "कौन सी फसल", "फसल सलाह", "फसल की सिफारिश",
      "मिट्टी के लिए फसल", "फसल बदलें", "वैकल्पिक फसल",
      // Punjabi
      "ਫਸਲ", "ਫਸਲ ਸੁਝਾਅ", "ਕੀ ਉਗਾਉਣਾ", "ਕਿਹੜੀ ਫਸਲ", "ਫਸਲ ਸਲਾਹ", "ਫਸਲ ਸਿਫਾਰਸ਼",
      "ਮਿੱਟੀ ਲਈ ਫਸਲ", "ਫਸਲ ਬਦਲੋ", "ਵਿਕਲਪਿਕ ਫਸਲ"
    ];
    
    // Check for greeting intent FIRST
    if (greetingKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return "greeting";
    }
    
    // Check for crop advisory intent
    if (advisoryKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return "advisory";
    }
    
    // Check for disease detection intent
    if (diseaseKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return "disease";
    }

    // Weather questions get LIVE answers from the AI (real temperature,
    // humidity, etc.) — never intercept them with a canned reply
    const weatherKeywords = [
      "weather", "temperature", "forecast",
      "मौसम", "तापमान",
      "ਮੌਸਮ", "ਤਾਪਮਾਨ"
    ];
    if (weatherKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return null;
    }

    if (irrigationKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return "irrigation";
    }
    if (schemesKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return "schemes";
    }
    
    return null;
  };

  // Enhanced intent response with disease detection trigger
  const getIntentResponse = (intent: string): { message: string; action?: { type: "open_disease_detection" | "open_irrigation" | "open_schemes" | "open_advisory"; label: string; target?: string } } => {
    switch (intent) {
      case "greeting":
        return {
          message: language === "en" 
            ? "Namaste 🙏 I'm AgriVikas, your farm assistant! How can I help today — crop advice, weather, irrigation alerts, disease detection, or government schemes?"
            : language === "hi"
            ? "नमस्ते 🙏 मैं एग्रीविकास हूं, आपका खेती सहायक! आज मैं कैसे मदद कर सकता हूं — फसल सलाह, मौसम, सिंचाई अलर्ट, रोग पहचान, या सरकारी योजनाएं?"
            : "ਸਤ ਸ੍ਰੀ ਅਕਾਲ 🙏 ਮੈਂ ਐਗਰੀਵਿਕਾਸ ਹਾਂ, ਤੁਹਾਡਾ ਖੇਤੀ ਸਹਾਇਕ! ਅੱਜ ਮੈਂ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ — ਫਸਲ ਸਲਾਹ, ਮੌਸਮ, ਸਿੰਚਾਈ ਚੇਤਾਵਨੀਆਂ, ਬਿਮਾਰੀ ਪਛਾਣ, ਜਾਂ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ?",
        };
      
      case "advisory":
        return {
          message: language === "en" 
            ? "I can help you choose the best crops for your land! 🌾 Let me open the Smart Crop Advisory for you."
            : language === "hi"
            ? "मैं आपकी भूमि के लिए सर्वोत्तम फसलें चुनने में आपकी मदद कर सकता हूं! 🌾 मैं आपके लिए स्मार्ट फसल सलाह खोलता हूं।"
            : "ਮੈਂ ਤੁਹਾਡੀ ਜ਼ਮੀਨ ਲਈ ਸਭ ਤੋਂ ਵਧੀਆ ਫਸਲਾਂ ਚੁਣਨ ਵਿੱਚ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ! 🌾 ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਸਮਾਰਟ ਫਸਲ ਸਲਾਹ ਖੋਲ੍ਹਦਾ ਹਾਂ।",
          action: { 
            type: "open_advisory", 
            label: language === "en" ? "Open Crop Advisory" : language === "hi" ? "फसल सलाह खोलें" : "ਫਸਲ ਸਲਾਹ ਖੋਲ੍ਹੋ",
            target: "advisory" 
          }
        };
      
      case "disease":
        // Trigger upload highlight
        setHighlightUpload(true);
        setTimeout(() => setHighlightUpload(false), 5000);
        
        return {
          message: language === "en" 
            ? "Please upload a clear photo of the infected leaf so I can check it for you 🌿. Make sure the image is well-lit and focused on the affected area!"
            : language === "hi"
            ? "कृपया संक्रमित पत्ती की स्पष्ट तस्वीर अपलोड करें ताकि मैं इसकी जांच कर सकूं 🌿। सुनिश्चित करें कि छवि अच्छी तरह से रोशन है और प्रभावित क्षेत्र पर केंद्रित है!"
            : "ਕਿਰਪਾ ਕਰਕੇ ਸੰਕਰਮਿਤ ਪੱਤੇ ਦੀ ਸਪੱਸ਼ਟ ਤਸਵੀਰ ਅੱਪਲੋਡ ਕਰੋ ਤਾਂ ਜੋ ਮੈਂ ਇਸਦੀ ਜਾਂਚ ਕਰ ਸਕਾਂ 🌿। ਯਕੀਨੀ ਬਣਾਓ ਕਿ ਤਸਵੀਰ ਚੰਗੀ ਤਰ੍ਹਾਂ ਰੋਸ਼ਨੀ ਵਾਲੀ ਹੈ ਅਤੇ ਪ੍ਰਭਾਵਿਤ ਖੇਤਰ 'ਤੇ ਕੇਂਦਰਿਤ ਹੈ!",
          action: { 
            type: "open_disease_detection", 
            label: t("chatbot.disease.uploadPrompt"),
            target: "disease" 
          }
        };
      
      case "irrigation":
        return {
          message: language === "en" 
            ? "I can provide irrigation advice based on current weather conditions. Let me open the Irrigation Alerts section for you."
            : language === "hi"
            ? "मैं वर्तमान मौसम की स्थिति के आधार पर सिंचाई सलाह प्रदान कर सकता हूं। मैं आपके लिए सिंचाई अलर्ट अनुभाग खोलता हूं।"
            : "ਮੈਂ ਮੌਜੂਦਾ ਮੌਸਮ ਦੀਆਂ ਸਥਿਤੀਆਂ ਦੇ ਆਧਾਰ ਤੇ ਸਿੰਚਾਈ ਸਲਾਹ ਪ੍ਰਦਾਨ ਕਰ ਸਕਦਾ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਸਿੰਚਾਈ ਚੇਤਾਵਨੀਆਂ ਸੈਕਸ਼ਨ ਖੋਲ੍ਹਦਾ ਹਾਂ।",
          action: { 
            type: "open_irrigation", 
            label: language === "en" ? "View Irrigation Alerts" : language === "hi" ? "सिंचाई अलर्ट देखें" : "ਸਿੰਚਾई ਚੇਤਾਵਨੀਆਂ ਦੇਖੋ",
            target: "irrigation" 
          }
        };
      
      case "schemes":
        return {
          message: language === "en" 
            ? "Here are some government benefits you may be eligible for based on your crop and location. Let me show you the available schemes."
            : language === "hi"
            ? "यहां कुछ सरकारी लाभ हैं जिनके लिए आप अपनी फसल और स्थान के आधार पर पात्र हो सकते हैं। मैं आपको उपलब्ध योजनाएं दिखाता हूं।"
            : "ਇੱਥੇ ਕੁਝ ਸਰਕਾਰੀ ਲਾਭ ਹਨ ਜਿਨ੍ਹਾਂ ਲਈ ਤੁਸੀਂ ਆਪਣੀ ਫਸਲ ਅਤੇ ਸਥਾਨ ਦੇ ਆਧਾਰ 'ਤੇ ਯੋਗ ਹੋ ਸਕਦੇ ਹੋ। ਮੈਂ ਤੁਹਾਨੂੰ ਉਪਲਬਧ ਯੋਜਨਾਵਾਂ ਦਿਖਾਉਂਦਾ ਹਾਂ।",
          action: { 
            type: "open_schemes", 
            label: language === "en" ? "View Government Schemes" : language === "hi" ? "सरकारी योजनाएं देखें" : "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਦੇਖੋ",
            target: "schemes" 
          }
        };
      
      default:
        return { message: "" };
    }
  };

  // Handle action button click
  const handleActionClick = (actionType: string) => {
    const sectionMap: Record<string, string> = {
      open_disease_detection: "disease",
      open_irrigation: "irrigation",
      open_schemes: "schemes",
      open_advisory: "advisory",
      view_full_report: "disease"
    };
    
    const section = sectionMap[actionType];
    if (section && onNavigate) {
      onNavigate(section);
      
      // If viewing full report, scroll to results after navigation
      if (actionType === "view_full_report") {
        setTimeout(() => {
          const resultsElement = document.getElementById("disease_results");
          if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: "smooth", block: "start" });
          } else {
            console.warn("Disease results element not found for scrolling");
          }
        }, 800); // Increased timeout to ensure component is fully mounted
      }
      
      toast.success(language === "en" ? "Opening module..." : language === "hi" ? "मॉड्यूल खोल रहे हैं..." : "ਮੋਡੀਊਲ ਖੋਲ੍ਹ ਰਹੇ ਹਾਂ...");
    }
  };

  // Enhanced TTS: tries Noiz AI first, falls back to browser TTS
  const speakText = useCallback(async (text: string) => {
    if (!voiceEnabled) return;

    // Stop any ongoing speech
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(true);

    try {
      // Try Noiz AI TTS first
      const result = await synthesizeSpeech({ text, outputFormat: "mp3" });

      if (result.success && result.audioBase64) {
        const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          setIsSpeaking(false);
          // Fallback to browser TTS on audio error
          browserSpeakText(text);
        };
        await audio.play();
        return;
      }
    } catch (err) {
      console.warn("Noiz TTS failed, falling back to browser TTS:", err);
    }

    // Fallback: browser TTS
    browserSpeakText(text);
  }, [voiceEnabled, language, availableVoices, synthesizeSpeech]);

  // Browser TTS fallback
  const browserSpeakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    const langMap: Record<string, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
    const targetLang = langMap[language] || "en-IN";
    const langPrefix = targetLang.split("-")[0];

    utterance.lang = targetLang;
    utterance.rate = 0.85;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const exactMatch = voices.find(v => v.lang === targetLang);
    const prefixMatch = voices.find(v => v.lang.startsWith(langPrefix));
    const indianEnglish = voices.find(v => v.lang === "en-IN");
    const anyEnglish = voices.find(v => v.lang.startsWith("en"));

    if (exactMatch) utterance.voice = exactMatch;
    else if (prefixMatch) utterance.voice = prefixMatch;
    else if (language !== "en" && indianEnglish) { utterance.voice = indianEnglish; utterance.lang = "en-IN"; }
    else if (anyEnglish) { utterance.voice = anyEnglish; utterance.lang = "en-IN"; }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [language, availableVoices]);

  // Handle sending message with intent detection
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      // Detect intent first
      const intent = detectIntent(text);
      
      if (intent) {
        // Handle intent-based response
        const intentResponse = getIntentResponse(intent);
        
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: intentResponse.message,
          sender: "bot",
          timestamp: new Date(),
          action: intentResponse.action,
        };
        
        setMessages((prev) => [...prev, botMessage]);
        
        if (voiceEnabled) {
          speakText(intentResponse.message);
        }
        
        // Add follow-up prompt after a short delay (except for greetings)
        if (intent !== "greeting") {
          setTimeout(() => {
            const followUpMessage: Message = {
              id: (Date.now() + 2).toString(),
              text: language === "en"
                ? "Would you like me to save this in your farmer record for future reference?"
                : language === "hi"
                ? "क्या आप चाहते हैं कि मैं इसे भविष्य के संदर्भ के लिए आपके किसान रिकॉर्ड में सहेजूं?"
                : "ਕੀ ਤੁਸੀਂ ਚਾਹੁੰਦੇ ਹੋ ਕਿ ਮੈਂ ਇਸਨੂੰ ਭਵਿੱਖ ਦੇ ਸੰਦਰਭ ਲਈ ਤੁਹਾਡੇ ਕਿਸਾਨ ਰਿਕਾਰਡ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਕਰਾਂ?",
              sender: "bot",
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, followUpMessage]);
          }, 2000);
        }
      } else {
        // Regular AI response
        const weatherData = dashboardData?.weather ? {
          temperature: dashboardData.weather.temperature,
          condition: dashboardData.weather.condition,
          humidity: 65,
        } : undefined;

        const botResponse = await getChatResponse({
          message: text.trim(),
          language,
          weatherData,
          location: "Punjab, India",
        });

        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: botResponse,
          sender: "bot",
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, botMessage]);
        
        if (voiceEnabled) {
          speakText(botResponse);
        }
        
        // Add follow-up prompt for general queries too
        setTimeout(() => {
          const followUpMessage: Message = {
            id: (Date.now() + 2).toString(),
            text: language === "en"
              ? "Is there anything else I can help you with today?"
              : language === "hi"
              ? "क्या आज मैं आपकी कोई और मदद कर सकता हूं?"
              : "ਕੀ ਅੱਜ ਮੈਂ ਤੁਹਾਡੀ ਕੋਈ ਹੋਰ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",
            sender: "bot",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, followUpMessage]);
        }, 2000);
      }
    } catch (error) {
      console.error("Error getting bot response:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action buttons
  const quickActions = [
    { icon: "🪴", label: language === "en" ? "Diagnose my crop" : language === "hi" ? "मेरी फसल का निदान करें" : "ਮੇਰੀ ਫਸਲ ਦਾ ਨਿਦਾਨ ਕਰੋ", query: "diagnose my crop" },
    { icon: "💧", label: language === "en" ? "Irrigation advice" : language === "hi" ? "सिंचाई सलाह" : "ਸਿੰਚਾई ਸਲਾਹ", query: "irrigation advice" },
    { icon: "🏛️", label: language === "en" ? "Govt Schemes" : language === "hi" ? "सरकारी योजनाएं" : "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ", query: "government schemes" },
    { icon: "🌾", label: language === "en" ? "Crop Advisory" : language === "hi" ? "फसल सलाह" : "ਫਸਲ ਸਲਾਹ", query: "crop advisory" },
  ];

  // Start voice recording with permission check
  const startRecording = async () => {
    if (!recognitionRef.current) {
      toast.error(t("chatbot.error.notSupported"));
      return;
    }

    // First, try to access the microphone to verify permissions
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed to check permissions
      stream.getTracks().forEach(track => track.stop());
      
      // Now start speech recognition
      try {
        setIsRecording(true);
        recognitionRef.current.start();
        toast.success(
          language === "en" 
            ? "🎤 Listening... Speak now!" 
            : language === "hi" 
            ? "🎤 सुन रहे हैं... अब बोलें!" 
            : "🎤 ਸੁਣ ਰਹੇ ਹਾਂ... ਹੁਣ ਬੋਲੋ!"
        );
      } catch (error: any) {
        console.error("Error starting recognition:", error);
        setIsRecording(false);
        if (error.message?.includes("already started")) {
          toast.error(
            language === "en"
              ? "Microphone is already active. Please wait and try again."
              : language === "hi"
              ? "माइक्रोफ़ोन पहले से सक्रिय है। कृपया प्रतीक्षा करें और पुनः प्रयास करें।"
              : "ਮਾਈਕ੍ਰੋਫੋਨ ਪਹਿਲਾਂ ਹੀ ਸਰਗਰਮ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਉਡੀਕ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
          );
        } else {
          toast.error(t("chatbot.error.microphone"));
        }
      }
    } catch (error: any) {
      console.error("Microphone permission error:", error);
      setIsRecording(false);
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        toast.error(
          language === "en"
            ? "🚫 Microphone blocked! Click the 🔒 lock icon in your browser's address bar, allow microphone, then refresh the page (F5)."
            : language === "hi"
            ? "🚫 माइक्रोफ़ोन ब्लॉक! ब्राउज़र के एड्रेस बार में 🔒 लॉक आइकन पर क्लिक करें, माइक्रोफ़ोन की अनुमति दें, फिर पेज रीफ्रेश करें (F5)।"
            : "🚫 ਮਾਈਕ੍ਰੋਫੋਨ ਬਲੌਕ! ਬ੍ਰਾਊਜ਼ਰ ਦੇ ਐਡਰੈੱਸ ਬਾਰ ਵਿੱਚ 🔒 ਲਾਕ ਆਈਕਨ 'ਤੇ ਕਲਿੱਕ ਕਰੋ, ਮਾਈਕ੍ਰੋਫੋਨ ਦੀ ਇਜਾਜ਼ਤ ਦਿਓ, ਫਿਰ ਪੇਜ ਰਿਫ੍ਰੈਸ਼ ਕਰੋ (F5)।"
        );
      } else if (error.name === "NotFoundError") {
        toast.error(
          language === "en"
            ? "No microphone found. Please connect a microphone and try again."
            : language === "hi"
            ? "कोई माइक्रोफ़ोन नहीं मिला। कृपया माइक्रोफ़ोन कनेक्ट करें और पुनः प्रयास करें।"
            : "ਕੋਈ ਮਾਈਕ੍ਰੋਫੋਨ ਨਹੀਂ ਮਿਲਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਮਾਈਕ੍ਰੋਫੋਨ ਕਨੈਕਟ ਕਰੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
        );
      } else {
        toast.error(t("chatbot.error.microphone"));
      }
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Toggle voice output
  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Clear chat function
  const clearChat = () => {
    setMessages([]);
    toast.success(t("chatbot.clearChat"));
  };

  // Open camera/disease detection
  const openDiseaseDetection = () => {
    if (onNavigate) {
      onNavigate("disease");
      toast.success(language === "en" ? "Opening Disease Detection..." : language === "hi" ? "रोग पहचान खोल रहे हैं..." : "ਬਿਮਾਰੀ ਪਛਾਣ ਖੋਲ੍ਹ ਰਹੇ ਹਾਂ...");
    }
  };

  // Expose method to post analysis results (called from DiseaseDetection component)
  useEffect(() => {
    // Listen for disease analysis completion events
    const handleAnalysisComplete = (event: CustomEvent) => {
      const { disease, confidence, treatment, impact, nutrientDeficiency, nutrientAdvice } = event.detail;
      
      let summaryMessage = "";
      
      if (language === "en") {
        summaryMessage = `🤖 Analysis complete!\n\n🌿 Disease: ${disease} (${Math.round(confidence * 100)}% confidence)\n💡 Suggestion: ${treatment}\n📈 Estimated Yield Impact: ${impact}`;
        
        if (nutrientDeficiency) {
          summaryMessage += `\n\n🧪 Soil Tip: Likely ${nutrientDeficiency} deficiency — ${nutrientAdvice?.short_term || "try nutrient-rich fertilizer and soil test."}`;
        }
      } else if (language === "hi") {
        summaryMessage = `🤖 विश्लेषण पूर्ण!\n\n🌿 रोग: ${disease} (${Math.round(confidence * 100)}% विश्वास)\n💡 सुझाव: ${treatment}\n📈 अनुमानित उपज प्रभाव: ${impact}`;
        
        if (nutrientDeficiency) {
          summaryMessage += `\n\n🧪 मिट्टी सुझाव: संभावित ${nutrientDeficiency} की कमी — ${nutrientAdvice?.short_term || "पोषक तत्व युक्त उर्वरक और मिट्टी परीक्षण आज़माएं।"}`;
        }
      } else {
        summaryMessage = `🤖 ਵਿਸ਼ਲੇਸ਼ਣ ਪੂਰਾ!\n\n🌿 ਬਿਮਾਰੀ: ${disease} (${Math.round(confidence * 100)}% ਵਿਸ਼ਵਾਸ)\n💡 ਸੁਝਾਅ: ${treatment}\n📈 ਅਨੁਮਾਨਿਤ ਉਪਜ ਪ੍ਰਭਾਵ: ${impact}`;
        
        if (nutrientDeficiency) {
          summaryMessage += `\n\n🧪 ਮਿੱਟੀ ਸੁਝਾਅ: ਸੰਭਾਵਿਤ ${nutrientDeficiency} ਦੀ ਕਮੀ — ${nutrientAdvice?.short_term || "ਪੋਸ਼ਕ ਤੱਤ ਭਰਪੂਰ ਖਾਦ ਅਤੇ ਮਿੱਟੀ ਜਾਂਚ ਕਰੋ।"}`;
        }
      }
      
      const botMessage: Message = {
        id: Date.now().toString(),
        text: summaryMessage,
        sender: "bot",
        timestamp: new Date(),
        action: { 
          type: "view_full_report" as any, 
          label: t("chatbot.disease.viewReport"),
          target: "disease_results" 
        }
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      // Speak the summary if voice is enabled
      // Use the speakText function for consistency
      if (voiceEnabled) {
        speakText(summaryMessage);
      }
    };

    window.addEventListener("diseaseAnalysisComplete" as any, handleAnalysisComplete);
    
    return () => {
      window.removeEventListener("diseaseAnalysisComplete" as any, handleAnalysisComplete);
    };
  }, [language, voiceEnabled]);

  return (
    <>
      {/* Floating Button */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-green-700 hover:from-green-600 hover:to-green-800 shadow-lg hover:shadow-xl transition-all active:scale-95"
        >
          <MessageCircle className="h-8 w-8 text-white" />
        </Button>
      </motion.div>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 md:hidden"
              onClick={() => setIsOpen(false)}
            />

            {/* Chat Container */}
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed bottom-0 right-0 z-50 w-full h-full md:bottom-6 md:right-6 md:w-[400px] md:h-[600px] md:rounded-xl shadow-2xl"
            >
              <Card className="h-full flex flex-col border-2 border-green-200 dark:border-green-900">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h3 className="font-bold text-lg">{t("chatbot.title")}</h3>
                      <p className="text-xs text-green-100">{t(`lang.${language === "en" ? "english" : language === "hi" ? "hindi" : "punjabi"}`)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearChat}
                      className="text-white hover:bg-green-700"
                      title={t("chatbot.clearChat")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="text-white hover:bg-green-700"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-green-50 to-amber-50 dark:from-emerald-950/60 dark:to-amber-950/60">
                  {messages.length === 0 && (
                    <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                      <p className="text-sm mb-4">{t("chatbot.placeholder")}</p>
                      {/* Quick Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {quickActions.map((action, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendMessage(action.query)}
                            className="text-xs h-auto py-2 px-3"
                          >
                            <span className="mr-1">{action.icon}</span>
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className="flex flex-col max-w-[80%]">
                        <div
                          className={`rounded-lg p-3 ${
                            message.sender === "user"
                              ? "bg-green-600 text-white"
                              : "bg-white text-gray-800 border border-gray-200 dark:bg-emerald-950/70 dark:text-emerald-50 dark:border-emerald-900"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-lg">
                              {message.sender === "user" ? "🧑‍🌾" : "🤖"}
                            </span>
                            <p className="text-sm">{message.text}</p>
                          </div>
                          {/* Action Button */}
                          {message.action && (
                            <Button
                              onClick={() => handleActionClick(message.action!.type)}
                              size="sm"
                              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                              {message.action.label}
                            </Button>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 px-2">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex justify-start"
                    >
                      <div className="bg-white text-gray-800 border border-gray-200 rounded-lg p-3 dark:bg-emerald-950/70 dark:text-emerald-50 dark:border-emerald-900">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🤖</span>
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                            <span className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                            <span className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-200 rounded-b-xl dark:bg-transparent dark:border-border">
                  {!speechSupported && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-2 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900">
                      {language === "en"
                        ? "🎙️ Voice input isn't supported in this browser — please type your question instead."
                        : language === "hi"
                        ? "🎙️ इस ब्राउज़र में वॉयस इनपुट उपलब्ध नहीं है — कृपया अपना प्रश्न टाइप करें।"
                        : "🎙️ ਇਸ ਬਰਾਊਜ਼ਰ ਵਿੱਚ ਵੌਇਸ ਇਨਪੁਟ ਉਪਲਬਧ ਨਹੀਂ ਹੈ — ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਸਵਾਲ ਟਾਈਪ ਕਰੋ।"}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendMessage(inputText)}
                      placeholder={t("chatbot.inputPlaceholder")}
                      className="flex-1"
                      disabled={isLoading}
                    />
                    <Button
                      onClick={() => handleSendMessage(inputText)}
                      size="icon"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isLoading}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex-1 ${
                        isRecording
                          ? "bg-red-600 hover:bg-red-700 animate-pulse"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                      disabled={isLoading}
                    >
                      <Mic className="h-5 w-5 mr-2" />
                      {isRecording ? t("chatbot.recording") : t("chatbot.voiceInput")}
                    </Button>
                    <Button
                      onClick={openDiseaseDetection}
                      size="icon"
                      variant="outline"
                      className="text-green-600 border-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-900/40"
                      title={language === "en" ? "Open Disease Detection" : language === "hi" ? "रोग पहचान खोलें" : "ਬਿਮਾਰੀ ਪਛਾਣ ਖੋਲ੍ਹੋ"}
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={toggleVoice}
                      size="icon"
                      variant="outline"
                      className={voiceEnabled ? "text-green-600" : "text-gray-400 dark:text-gray-500"}
                    >
                      {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}