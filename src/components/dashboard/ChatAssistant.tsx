import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  Send,
  Volume2,
  VolumeX,
  ImagePlus,
  X,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
  image?: string;
}

const LANG_LABELS: Record<string, string> = {
  en: "🇬🇧 English",
  hi: "🇮🇳 हिंदी",
  pa: "🇮🇳 ਪੰਜਾਬੀ",
};

const STT_LANG: Record<string, string> = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };

interface SpeechRecognitionResultLike {
  results: Array<Array<{ transcript: string }>>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionHandle {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function ChatAssistant() {
  const { language: globalLanguage } = useLanguage();
  const [chatLanguage, setChatLanguage] = useState<string>(globalLanguage || "en");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionHandle | null>(null);

  const getChatResponse = useAction(api.chatbot.getChatResponse);
  const synthesizeSpeech = useAction(api.noizTts.synthesizeSpeech);
  const dashboardData = useQuery(api.farmers.getDashboardSummary, {});

  const t = (en: string, hi: string, pa: string) =>
    chatLanguage === "hi" ? hi : chatLanguage === "pa" ? pa : en;

  // Load TTS voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Speech recognition setup per chat language
  useEffect(() => {
    if (typeof window === "undefined") return;
    const speechWindow = window as unknown as Record<string, unknown>;
    const SpeechRecognition = (speechWindow.SpeechRecognition ||
      speechWindow.webkitSpeechRecognition) as
      | (new () => SpeechRecognitionHandle)
      | undefined;
    if (!SpeechRecognition) return;

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = STT_LANG[chatLanguage] || "en-IN";

    recognitionRef.current.onresult = (event: SpeechRecognitionResultLike) => {
      const transcript = event.results[0][0].transcript;
      setIsRecording(false);
      handleSend(transcript);
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionErrorLike) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        toast.error(
          t("🚫 Microphone access denied.", "🚫 माइक्रोफ़ोन एक्सेस अस्वीकृत।", "🚫 ਮਾਈਕ੍ਰੋਫੋਨ ਪਹੁੰਚ ਅਸਵੀਕਾਰ।")
        );
      } else if (event.error === "no-speech") {
        toast.error(t("No speech detected.", "कोई आवाज़ नहीं मिली।", "ਕੋਈ ਆਵਾਜ਼ ਨਹੀਂ ਮਿਲੀ।"));
      }
    };
    recognitionRef.current.onend = () => setIsRecording(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatLanguage]);

  const browserSpeak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) {
        setIsSpeaking(false);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = STT_LANG[chatLanguage] || "en-IN";
      const langPrefix = targetLang.split("-")[0];
      utterance.lang = targetLang;
      utterance.rate = 0.85;
      utterance.pitch = 1;

      const voices =
        availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
      const exactMatch = voices.find((v) => v.lang === targetLang);
      const prefixMatch = voices.find((v) => v.lang.startsWith(langPrefix));
      const anyEnglish = voices.find((v) => v.lang.startsWith("en"));
      if (exactMatch) utterance.voice = exactMatch;
      else if (prefixMatch) utterance.voice = prefixMatch;
      else if (anyEnglish) {
        utterance.voice = anyEnglish;
        utterance.lang = "en-IN";
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [chatLanguage, availableVoices]
  );

  const speakText = useCallback(
    async (text: string) => {
      if (!voiceEnabled) return;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      setIsSpeaking(true);

      try {
        const result = await synthesizeSpeech({ text, outputFormat: "mp3" });
        if (result.success && result.audioBase64) {
          const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            setIsSpeaking(false);
            browserSpeak(text);
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn("Noiz TTS failed, falling back to browser TTS:", err);
      }
      browserSpeak(text);
    },
    [voiceEnabled, browserSpeak, synthesizeSpeech]
  );

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleSend = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: cleanText,
      sender: "user",
      timestamp: new Date(),
      image: attachedImage || undefined,
    };
    const imageToSend = attachedImage;
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setAttachedImage(null);
    setIsLoading(true);

    try {
      const weather = dashboardData?.weather
        ? {
            temperature: dashboardData.weather.temperature,
            condition: dashboardData.weather.condition,
            humidity: dashboardData.weather.humidity,
          }
        : undefined;

      const botResponse = await getChatResponse({
        message: cleanText,
        language: chatLanguage,
        weatherData: weather,
        location: dashboardData?.profile?.district || "Punjab, India",
        imageBase64: imageToSend || undefined,
      });

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
      if (voiceEnabled) speakText(botResponse);
    } catch (error) {
      console.error("Error getting bot response:", error);
      toast.error(
        t(
          "Failed to get a response. Please try again.",
          "प्रतिक्रिया प्राप्त करने में विफल। कृपया पुनः प्रयास करें।",
          "ਜਵਾਬ ਪ੍ਰਾਪਤ ਕਰਨ ਵਿੱਚ ਅਸਫਲ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|jpg|png|webp)$/)) {
      toast.error(
        t("Please choose a JPEG, PNG or WebP image.", "कृपया JPEG, PNG या WebP छवि चुनें।", "ਕਿਰਪਾ ਕਰਕੇ JPEG, PNG ਜਾਂ WebP ਤਸਵੀਰ ਚੁਣੋ।")
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("Image is too large (max 5MB).", "छवि बहुत बड़ी है (अधिकतम 5MB)।", "ਤਸਵੀਰ ਬਹੁਤ ਵੱਡੀ ਹੈ (ਵੱਧ ਤੋਂ ਵੱਧ 5MB)।"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setAttachedImage(e.target?.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startRecording = async () => {
    if (!recognitionRef.current) {
      toast.error(
        t(
          "Voice input is not supported in this browser.",
          "इस ब्राउज़र में वॉयस इनपुट समर्थित नहीं है।",
          "ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਵੌਇਸ ਇਨਪੁਟ ਸਮਰਥਿਤ ਨਹੀਂ ਹੈ।"
        )
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(true);
      recognitionRef.current.start();
    } catch (error) {
      console.error("Microphone error:", error);
      setIsRecording(false);
      toast.error(
        t(
          "Microphone access denied. Allow it in your browser and try again.",
          "माइक्रोफ़ोन एक्सेस अस्वीकृत। ब्राउज़र में अनुमति दें और पुनः प्रयास करें।",
          "ਮਾਈਕ੍ਰੋਫੋਨ ਪਹੁੰਚ ਅਸਵੀਕਾਰ। ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਇਜਾਜ਼ਤ ਦਿਓ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।"
        )
      );
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    stopSpeaking();
    toast.success(t("Chat cleared.", "चैट साफ़ हुई।", "ਚੈਟ ਸਾਫ਼ ਹੋਈ।"));
  };

  const quickPrompts = [
    { icon: "🌦️", text: t("What is today's weather?", "आज मौसम कैसा है?", "ਅੱਜ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ?") },
    { icon: "🌿", text: t("Is my crop leaf healthy?", "क्या मेरी फसल की पत्ती स्वस्थ है?", "ਕੀ ਮੇਰੀ ਫਸਲ ਦਾ ਪੱਤਾ ਸਿਹਤਮੰਦ ਹੈ?") },
    { icon: "💧", text: t("When should I water my fields?", "मुझे अपने खेतों में कब पानी देना चाहिए?", "ਮੈਨੂੰ ਆਪਣੇ ਖੇਤਾਂ ਨੂੰ ਕਦੋਂ ਪਾਣੀ ਦੇਣਾ ਚਾਹੀਦਾ ਹੈ?") },
    { icon: "🏛️", text: t("Which govt schemes fit me?", "कौन सी सरकारी योजनाएं मेरे लिए हैं?", "ਕਿਹੜੀਆਂ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ ਮੇਰੇ ਲਈ ਹਨ?") },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="border-2 border-green-200 overflow-hidden flex flex-col h-[calc(100vh-190px)] min-h-[520px]">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 text-white px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">🤖</span>
            <div className="min-w-0">
              <h2 className="font-bold text-lg leading-tight truncate">
                {t("AgriVikas AI Assistant", "एग्रीविकास एआई सहायक", "ਐਗਰੀਵਿਕਾਸ ਏਆਈ ਸਹਾਇਕ")}
              </h2>
              <p className="text-xs text-green-100 flex items-center gap-1 truncate">
                <Sparkles className="h-3 w-3 shrink-0" />
                {t(
                  "Live AI — type, speak, or share a photo",
                  "लाइव एआई — टाइप करें, बोलें, या फोटो भेजें",
                  "ਲਾਈਵ ਏਆਈ — ਟਾਈਪ ਕਰੋ, ਬੋਲੋ, ਜਾਂ ਫੋਟੋ ਭੇਜੋ"
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Chat language selector */}
            <Select value={chatLanguage} onValueChange={setChatLanguage}>
              <SelectTrigger className="w-[128px] h-9 bg-green-600 border-green-500 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANG_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-green-700 h-9 w-9"
              onClick={() => {
                setVoiceEnabled(!voiceEnabled);
                if (isSpeaking) stopSpeaking();
              }}
              title={t("Toggle voice replies", "वॉयस उत्तर टॉगल करें", "ਵੌਇਸ ਜਵਾਬ ਟੌਗਲ ਕਰੋ")}
            >
              {voiceEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-green-700 h-9 w-9"
              onClick={clearChat}
              title={t("Clear chat", "चैट साफ़ करें", "ਚੈਟ ਸਾਫ਼ ਕਰੋ")}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-green-50 via-amber-50 to-green-50">
          {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4">
              <div className="text-5xl">🌾</div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {t("How can I help you farm better?", "मैं आपकी खेती बेहतर करने में कैसे मदद करूं?", "ਮੈਂ ਤੁਹਾਡੀ ਖੇਤੀ ਨੂੰ ਬਿਹਤਰ ਬਣਾਉਣ ਵਿੱਚ ਕਿਵੇਂ ਮਦਦ ਕਰਾਂ?")}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1 max-w-sm">
                  {t(
                    "Ask about weather, crops, diseases, irrigation, or schemes — or attach a photo of your plant.",
                    "मौसम, फसल, रोग, सिंचाई या योजनाओं के बारे में पूछें — या अपने पौधे की फोटो जोड़ें।",
                    "ਮੌਸਮ, ਫਸਲ, ਬਿਮਾਰੀਆਂ, ਸਿੰਚਾਈ ਜਾਂ ਯੋਜਨਾਵਾਂ ਬਾਰੇ ਪੁੱਛੋ — ਜਾਂ ਆਪਣੇ ਪੌਦੇ ਦੀ ਫੋਟੋ ਜੋੜੋ।"
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-start text-left h-auto py-2.5 px-3 text-sm border-green-300 bg-white hover:bg-green-50 dark:border-green-800 dark:bg-card dark:hover:bg-green-900/40"
                    onClick={() => handleSend(prompt.text)}
                  >
                    <span className="mr-2 shrink-0">{prompt.icon}</span>
                    <span className="text-left">{prompt.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="flex flex-col max-w-[85%] sm:max-w-[75%]">
                  <div
                    className={`rounded-2xl p-3 ${
                      message.sender === "user"
                        ? "bg-green-600 text-white rounded-br-md"
                        : "bg-white text-gray-800 dark:text-gray-100 border border-gray-200 dark:bg-card dark:border-emerald-900 rounded-bl-md"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-lg shrink-0">
                        {message.sender === "user" ? "🧑‍🌾" : "🤖"}
                      </span>
                      <div className="min-w-0">
                        {message.image && (
                          <img
                            src={message.image}
                            alt="Attached"
                            className="rounded-lg border border-green-200 mb-2 max-h-40 object-cover"
                          />
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {message.sender === "bot" && voiceEnabled && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-green-600"
                        onClick={() => (isSpeaking ? stopSpeaking() : speakText(message.text))}
                        title={t("Listen", "सुनें", "ਸੁਣੋ")}
                      >
                        {isSpeaking ? (
                          <VolumeX className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-white text-gray-800 dark:text-gray-100 border border-gray-200 dark:bg-card dark:border-emerald-900 rounded-2xl rounded-bl-md p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 bg-white border-t border-gray-200 space-y-2 dark:bg-card dark:border-border">
          {attachedImage && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2">
              <img
                src={attachedImage}
                alt="Preview"
                className="h-12 w-12 object-cover rounded border border-green-200 shrink-0"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500 flex-1">
                {t(
                  "Image attached — I'll analyze it with the photo.",
                  "छवि जुड़ी — मैं इसे फोटो के साथ विश्लेषित करूंगा।",
                  "ਤਸਵੀਰ ਜੁੜੀ — ਮੈਂ ਇਸਨੂੰ ਫੋਟੋ ਨਾਲ ਵਿਸ਼ਲੇਸ਼ਿਤ ਕਰਾਂਗਾ।"
                )}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setAttachedImage(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 text-green-600 border-green-300 hover:bg-green-50"
              onClick={() => fileInputRef.current?.click()}
              title={t("Attach a photo", "फोटो जोड़ें", "ਫੋਟੋ ਜੋੜੋ")}
            >
              <ImagePlus className="h-5 w-5" />
            </Button>
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSend(inputText)}
              placeholder={t("Type your message…", "अपना संदेश लिखें…", "ਆਪਣਾ ਸੁਨੇਹਾ ਲਿਖੋ…")}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              variant="outline"
              size="icon"
              className={`shrink-0 ${
                isRecording
                  ? "bg-red-600 text-white border-red-600 animate-pulse"
                  : "text-green-600 border-green-300 hover:bg-green-50"
              }`}
              onClick={isRecording ? stopRecording : startRecording}
              title={t("Voice input", "वॉयस इनपुट", "ਵੌਇਸ ਇਨਪੁਟ")}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>
            <Button
              size="icon"
              className="shrink-0 bg-green-600 hover:bg-green-700"
              onClick={() => handleSend(inputText)}
              disabled={isLoading || (!inputText.trim() && !attachedImage)}
              title={t("Send", "भेजें", "ਭੇਜੋ")}
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">
            {t(
              `Voice input & replies use ${LANG_LABELS[chatLanguage]} — change above anytime.`,
              `वॉयस इनपुट और उत्तर ${LANG_LABELS[chatLanguage]} में हैं — कभी भी ऊपर बदलें।`,
              `ਵੌਇਸ ਇਨਪੁਟ ਅਤੇ ਜਵਾਬ ${LANG_LABELS[chatLanguage]} ਵਿੱਚ ਹਨ — ਕਦੇ ਵੀ ਉੱਪਰ ਬਦਲੋ।`
            )}
          </p>
        </div>
      </Card>
    </div>
  );
}
