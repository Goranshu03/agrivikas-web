import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  Droplets,
  Leaf,
  Brain,
  ChevronDown,
  Menu,
  X,
  ArrowRight,
  Shield,
  Zap,
  Globe,
  Star,
  CheckCircle2,
  Sprout,
  CloudRain,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import VoiceChatbot from "@/components/VoiceChatbot";

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleExploreGuest = () => navigate("/dashboard");
  const handleSignIn = () => navigate("/auth");

  const languageOptions = [
    { code: "en" as const, label: t("lang.english"), flag: "🇬🇧" },
    { code: "hi" as const, label: t("lang.hindi"), flag: "🇮🇳" },
    { code: "pa" as const, label: t("lang.punjabi"), flag: "🇮🇳" },
  ];

  const currentLanguageLabel =
    languageOptions.find((l) => l.code === language)?.label || t("lang.english");

  const features = [
    {
      icon: <Droplets className="h-7 w-7" />,
      color: "text-sky-600",
      bg: "bg-sky-50",
      title: t("features.irrigation.title"),
      desc: t("features.irrigation.description"),
      badge: t("features.irrigation.badge"),
      badgeColor: "bg-sky-100 text-sky-700",
    },
    {
      icon: <Leaf className="h-7 w-7" />,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      title: t("features.health.title"),
      desc: t("features.health.description"),
      badge: t("features.health.badge"),
      badgeColor: "bg-emerald-100 text-emerald-700",
    },
    {
      icon: <Brain className="h-7 w-7" />,
      color: "text-amber-600",
      bg: "bg-amber-50",
      title: t("features.advisory.title"),
      desc: t("features.advisory.description"),
      badge: t("features.advisory.badge"),
      badgeColor: "bg-amber-100 text-amber-700",
    },
    {
      icon: <Shield className="h-7 w-7" />,
      color: "text-violet-600",
      bg: "bg-violet-50",
      title: t("features.schemes.title"),
      desc: t("features.schemes.description"),
      badge: t("features.schemes.badge"),
      badgeColor: "bg-violet-100 text-violet-700",
    },
    {
      icon: <Sprout className="h-7 w-7" />,
      color: "text-teal-600",
      bg: "bg-teal-50",
      title: t("features.diversification.title"),
      desc: t("features.diversification.description"),
      badge: t("features.diversification.badge"),
      badgeColor: "bg-teal-100 text-teal-700",
    },
    {
      icon: <MessageSquare className="h-7 w-7" />,
      color: "text-rose-600",
      bg: "bg-rose-50",
      title: t("features.chatbot.title"),
      desc: t("features.chatbot.description"),
      badge: t("features.chatbot.badge"),
      badgeColor: "bg-rose-100 text-rose-700",
    },
  ];

  const stats = [
    { value: "50K+", label: language === "en" ? "Farmers Helped" : language === "hi" ? "किसानों की मदद" : "ਕਿਸਾਨਾਂ ਦੀ ਮਦਦ" },
    { value: "95%", label: language === "en" ? "Disease Accuracy" : language === "hi" ? "रोग सटीकता" : "ਬਿਮਾਰੀ ਸ਼ੁੱਧਤਾ" },
    { value: "3", label: language === "en" ? "Languages" : language === "hi" ? "भाषाएं" : "ਭਾਸ਼ਾਵਾਂ" },
    { value: "24/7", label: language === "en" ? "AI Support" : language === "hi" ? "AI सहायता" : "AI ਸਹਾਇਤਾ" },
  ];

  const testimonials = [
    {
      name: "Gurpreet Singh",
      location: "Amritsar, Punjab",
      text: language === "en"
        ? "AgriVikas helped me detect wheat rust early. Saved my entire crop this season!"
        : language === "hi"
        ? "एग्रीविकास ने मुझे गेहूं की जंग जल्दी पहचानने में मदद की। इस सीजन में मेरी पूरी फसल बच गई!"
        : "ਐਗਰੀਵਿਕਾਸ ਨੇ ਮੈਨੂੰ ਕਣਕ ਦੀ ਜੰਗ ਜਲਦੀ ਪਛਾਣਨ ਵਿੱਚ ਮਦਦ ਕੀਤੀ। ਇਸ ਸੀਜ਼ਨ ਵਿੱਚ ਮੇਰੀ ਪੂਰੀ ਫਸਲ ਬਚ ਗਈ!",
      rating: 5,
    },
    {
      name: "Ramesh Kumar",
      location: "Ludhiana, Punjab",
      text: language === "en"
        ? "The irrigation alerts saved me 30% water usage. The AI advice is spot on!"
        : language === "hi"
        ? "सिंचाई अलर्ट ने मुझे 30% पानी की बचत करने में मदद की। AI सलाह बिल्कुल सटीक है!"
        : "ਸਿੰਚਾਈ ਚੇਤਾਵਨੀਆਂ ਨੇ ਮੈਨੂੰ 30% ਪਾਣੀ ਦੀ ਬੱਚਤ ਕਰਨ ਵਿੱਚ ਮਦਦ ਕੀਤੀ। AI ਸਲਾਹ ਬਿਲਕੁਲ ਸਹੀ ਹੈ!",
      rating: 5,
    },
    {
      name: "Harjinder Kaur",
      location: "Patiala, Punjab",
      text: language === "en"
        ? "Finally an app that speaks Punjabi! The voice chatbot is amazing for us farmers."
        : language === "hi"
        ? "आखिरकार एक ऐप जो पंजाबी बोलता है! वॉयस चैटबॉट हम किसानों के लिए अद्भुत है।"
        : "ਆਖਰਕਾਰ ਇੱਕ ਐਪ ਜੋ ਪੰਜਾਬੀ ਬੋਲਦਾ ਹੈ! ਵੌਇਸ ਚੈਟਬੋਟ ਸਾਡੇ ਕਿਸਾਨਾਂ ਲਈ ਸ਼ਾਨਦਾਰ ਹੈ।",
      rating: 5,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAVBAR ── */}
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              className="flex items-center gap-2.5 cursor-pointer transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
              onClick={() => navigate("/")}
            >
              <div className="relative flex items-center justify-center w-9 h-9 bg-primary rounded-lg shadow-sm">
                <Leaf className="h-5 w-5 text-primary-foreground" fill="currentColor" />
              </div>
              <div>
                <span className="text-xl font-bold text-foreground tracking-tight">
                  Agri<span className="text-primary">Vikas</span>
                </span>
                <p className="text-[10px] text-muted-foreground leading-none hidden sm:block">
                  {t("header.subtitle")}
                </p>
              </div>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {["home", "about", "features", "schemes", "contact"].map((item) => (
                <a
                  key={item}
                  href={`#${item}`}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t(`header.${item}`)}
                </a>
              ))}
            </nav>

            {/* Right Actions */}
            <div className="hidden md:flex items-center gap-2 lg:gap-3">
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-sm">
                    <Globe className="h-4 w-4" />
                    {currentLanguageLabel}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {languageOptions.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className="cursor-pointer"
                    >
                      {lang.flag} {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {!isAuthenticated && (
                <>
                  <Button variant="ghost" size="sm" onClick={handleSignIn}>
                    {t("header.signIn")}
                  </Button>
                  <Button size="sm" onClick={handleSignIn} className="bg-primary hover:bg-primary/90">
                    {t("header.guestLogin")}
                  </Button>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border bg-background"
            >
              <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
                {["home", "about", "features", "schemes", "contact"].map((item) => (
                  <a
                    key={item}
                    href={`#${item}`}
                    className="text-sm font-medium text-muted-foreground py-1"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {t(`header.${item}`)}
                  </a>
                ))}
                <div className="pt-2 border-t border-border flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {t("header.title")}
                    </span>
                    <ThemeToggle />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Globe className="h-4 w-4" />
                        {currentLanguageLabel}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full">
                      {languageOptions.map((lang) => (
                        <DropdownMenuItem
                          key={lang.code}
                          onClick={() => setLanguage(lang.code)}
                          className="cursor-pointer"
                        >
                          {lang.flag} {lang.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {!isAuthenticated && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleSignIn} className="w-full">
                        {t("header.signIn")}
                      </Button>
                      <Button size="sm" onClick={handleSignIn} className="w-full bg-primary hover:bg-primary/90">
                        {t("header.guestLogin")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* ── HERO ── */}
      <section id="home" className="relative overflow-hidden">
        {/* Background image with overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1600&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-foreground/60" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 md:py-40">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-primary/20 border border-primary/40 text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-6 backdrop-blur-sm"
            >
              <Zap className="h-3.5 w-3.5" />
              {language === "en"
                ? "AI-Powered Farming Platform"
                : language === "hi"
                ? "AI-संचालित कृषि मंच"
                : "AI-ਸੰਚਾਲਿਤ ਖੇਤੀ ਪਲੇਟਫਾਰਮ"}
            </motion.div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              {t("hero.tagline")}
            </h1>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl leading-relaxed">
              {t("hero.description")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                onClick={handleExploreGuest}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base rounded-xl shadow-lg gap-2"
              >
                {t("hero.exploreGuest")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleSignIn}
                className="border-white/40 text-white hover:bg-white/10 px-8 py-6 text-base rounded-xl backdrop-blur-sm"
              >
                {t("hero.signInDashboard")}
              </Button>
            </div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-8 mt-14"
            >
              {stats.map((stat, i) => (
                <div key={i} className="text-white">
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <div className="text-sm text-white/70">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── ABOUT STRIP ── */}
      <section id="about" className="bg-primary py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { icon: <CloudRain className="h-6 w-6" />, label: language === "en" ? "Real-time Weather" : language === "hi" ? "रियल-टाइम मौसम" : "ਰੀਅਲ-ਟਾਈਮ ਮੌਸਮ" },
              { icon: <BarChart3 className="h-6 w-6" />, label: language === "en" ? "Smart Analytics" : language === "hi" ? "स्मार्ट विश्लेषण" : "ਸਮਾਰਟ ਵਿਸ਼ਲੇਸ਼ਣ" },
              { icon: <Globe className="h-6 w-6" />, label: language === "en" ? "Multilingual" : language === "hi" ? "बहुभाषी" : "ਬਹੁਭਾਸ਼ੀ" },
              { icon: <Shield className="h-6 w-6" />, label: language === "en" ? "Govt Schemes" : language === "hi" ? "सरकारी योजनाएं" : "ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center gap-2 text-primary-foreground"
              >
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {t("features.title")}
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
              {t("features.subtitle")}
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <Card className="h-full border border-border hover:border-primary/40 hover:shadow-lg transition-all duration-300">
                  <CardContent className="p-7">
                    <div className={`inline-flex items-center justify-center w-12 h-12 ${f.bg} ${f.color} rounded-xl mb-5`}>
                      {f.icon}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4">{f.desc}</p>
                    <span className={`inline-block ${f.badgeColor} px-3 py-1 rounded-full text-xs font-medium`}>
                      {f.badge}
                    </span>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {language === "en" ? "How It Works" : language === "hi" ? "यह कैसे काम करता है" : "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ"}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: <Leaf className="h-8 w-8 text-primary" />,
                title: language === "en" ? "Create Your Profile" : language === "hi" ? "अपनी प्रोफ़ाइल बनाएं" : "ਆਪਣੀ ਪ੍ਰੋਫਾਈਲ ਬਣਾਓ",
                desc: language === "en" ? "Enter your farm details, crops, and location for personalized insights." : language === "hi" ? "व्यक्तिगत जानकारी के लिए अपने खेत का विवरण, फसलें और स्थान दर्ज करें।" : "ਵਿਅਕਤੀਗਤ ਜਾਣਕਾਰੀ ਲਈ ਆਪਣੇ ਖੇਤ ਦਾ ਵੇਰਵਾ, ਫਸਲਾਂ ਅਤੇ ਸਥਾਨ ਦਰਜ ਕਰੋ।",
              },
              {
                step: "02",
                icon: <Brain className="h-8 w-8 text-primary" />,
                title: language === "en" ? "Get AI Insights" : language === "hi" ? "AI अंतर्दृष्टि प्राप्त करें" : "AI ਜਾਣਕਾਰੀ ਪ੍ਰਾਪਤ ਕਰੋ",
                desc: language === "en" ? "Our AI analyzes weather, soil, and crop data to give you actionable advice." : language === "hi" ? "हमारा AI मौसम, मिट्टी और फसल डेटा का विश्लेषण करके आपको कार्रवाई योग्य सलाह देता है।" : "ਸਾਡਾ AI ਮੌਸਮ, ਮਿੱਟੀ ਅਤੇ ਫਸਲ ਡੇਟਾ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਕੇ ਤੁਹਾਨੂੰ ਕਾਰਵਾ�ਯੋਗ ਸਲਾਹ ਦਿੰਦਾ ਹੈ।",
              },
              {
                step: "03",
                icon: <CheckCircle2 className="h-8 w-8 text-primary" />,
                title: language === "en" ? "Grow Better" : language === "hi" ? "बेहतर उगाएं" : "ਬਿਹਤਰ ਉਗਾਓ",
                desc: language === "en" ? "Apply recommendations, track results, and improve your yield season after season." : language === "hi" ? "सिफारिशें लागू करें, परिणाम ट्रैक करें और हर सीजन अपनी उपज में सुधार करें।" : "ਸਿਫਾਰਸ਼ਾਂ ਲਾਗੂ ਕਰੋ, ਨਤੀਜੇ ਟਰੈਕ ਕਰੋ ਅਤੇ ਹਰ ਸੀਜ਼ਨ ਆਪਣੀ ਉਪਜ ਵਿੱਚ ਸੁਧਾਰ ਕਰੋ।",
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                <Card className="h-full border border-border bg-card">
                  <CardContent className="p-8">
                    <div className="text-5xl font-black text-primary/10 mb-4">{step.step}</div>
                    <div className="mb-4">{step.icon}</div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {language === "en" ? "Trusted by Farmers" : language === "hi" ? "किसानों का विश्वास" : "ਕਿਸਾਨਾਂ ਦਾ ਭਰੋਸਾ"}
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full border border-border hover:shadow-md transition-shadow">
                  <CardContent className="p-7">
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-5 italic">
                      "{t.text}"
                    </p>
                    <div>
                      <div className="font-semibold text-foreground text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.location}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GOVT SCHEMES STRIP ── */}
      <section id="schemes" className="py-16 bg-muted/30 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                {language === "en" ? "Government Schemes for Farmers" : language === "hi" ? "किसानों के लिए सरकारी योजनाएं" : "ਕਿਸਾਨਾਂ ਲਈ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ"}
              </h2>
              <p className="text-muted-foreground mb-6">
                {language === "en"
                  ? "Discover PM-KISAN, PMFBY, Soil Health Card, and more schemes you may be eligible for."
                  : language === "hi"
                  ? "PM-KISAN, PMFBY, मृदा स्वास्थ्य कार्ड और अन्य योजनाएं खोजें जिनके लिए आप पात्र हो सकते हैं।"
                  : "PM-KISAN, PMFBY, ਮਿੱਟੀ ਸਿਹਤ ਕਾਰਡ ਅਤੇ ਹੋਰ ਯੋਜਨਾਵਾਂ ਖੋਜੋ ਜਿਨ੍ਹਾਂ ਲਈ ਤੁਸੀਂ ਯੋਗ ਹੋ ਸਕਦੇ ਹੋ।"}
              </p>
              <div className="flex flex-wrap gap-2">
                {["PM-KISAN", "PMFBY", "Soil Health Card", "KCC", "eNAM"].map((scheme) => (
                  <span
                    key={scheme}
                    className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {scheme}
                  </span>
                ))}
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleExploreGuest}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 rounded-xl gap-2 shrink-0"
            >
              {language === "en" ? "Explore Schemes" : language === "hi" ? "योजनाएं देखें" : "ਯੋਜਨਾਵਾਂ ਦੇਖੋ"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              {language === "en"
                ? "Start Growing Smarter Today"
                : language === "hi"
                ? "आज से स्मार्ट खेती शुरू करें"
                : "ਅੱਜ ਤੋਂ ਸਮਾਰਟ ਖੇਤੀ ਸ਼ੁਰੂ ਕਰੋ"}
            </h2>
            <p className="text-primary-foreground/80 mb-8 text-lg">
              {language === "en"
                ? "Join thousands of farmers already using AgriVikas to improve their yields."
                : language === "hi"
                ? "हजारों किसानों से जुड़ें जो पहले से ही AgriVikas का उपयोग करके अपनी उपज में सुधार कर रहे हैं।"
                : "ਹਜ਼ਾਰਾਂ ਕਿਸਾਨਾਂ ਨਾਲ ਜੁੜੋ ਜੋ ਪਹਿਲਾਂ ਤੋਂ ਹੀ AgriVikas ਦੀ ਵਰਤੋਂ ਕਰਕੇ ਆਪਣੀ ਉਪਜ ਵਿੱਚ ਸੁਧਾਰ ਕਰ ਰਹੇ ਹਨ।"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={handleExploreGuest}
                className="bg-background text-foreground hover:bg-background/90 px-8 py-6 rounded-xl gap-2"
              >
                {t("hero.exploreGuest")}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleSignIn}
                className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-6 rounded-xl"
              >
                {t("hero.signInDashboard")}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="contact" className="bg-foreground text-background py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <Leaf className="h-4 w-4 text-primary-foreground" fill="currentColor" />
                </div>
                <span className="text-lg font-bold">AgriVikas</span>
              </div>
              <p className="text-background/60 text-sm leading-relaxed max-w-xs">
                {language === "en"
                  ? "Empowering Indian farmers with AI-driven insights for better yields and sustainable farming."
                  : language === "hi"
                  ? "बेहतर उपज और टिकाऊ खेती के लिए AI-संचालित अंतर्दृष्टि के साथ भारतीय किसानों को सशक्त बनाना।"
                  : "ਬਿਹਤਰ ਉਪਜ ਅਤੇ ਟਿਕਾਊ ਖੇਤੀ ਲਈ AI-ਸੰਚਾਲਿਤ ਜਾਣਕਾਰੀ ਨਾਲ ਭਾਰਤੀ ਕਿਸਾਨਾਂ ਨੂੰ ਸਸ਼ਕਤ ਬਣਾਉਣਾ।"}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">
                {language === "en" ? "Features" : language === "hi" ? "सुविधाएं" : "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ"}
              </h4>
              <ul className="space-y-2 text-sm text-background/60">
                <li>{t("features.irrigation.title")}</li>
                <li>{t("features.health.title")}</li>
                <li>{t("features.advisory.title")}</li>
                <li>{t("features.schemes.title")}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">
                {language === "en" ? "Languages" : language === "hi" ? "भाषाएं" : "ਭਾਸ਼ਾਵਾਂ"}
              </h4>
              <ul className="space-y-2 text-sm text-background/60">
                <li>🇬🇧 English</li>
                <li>🇮🇳 हिंदी</li>
                <li>🇮🇳 ਪੰਜਾਬੀ</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-background/10 pt-6 text-center text-sm text-background/40">
            © 2024 AgriVikas. {language === "en" ? "All rights reserved." : language === "hi" ? "सर्वाधिकार सुरक्षित।" : "ਸਾਰੇ ਅਧਿਕਾਰ ਸੁਰੱਖਿਅਤ।"}
          </div>
        </div>
      </footer>

      {/* Voice Chatbot */}
      <VoiceChatbot onNavigate={(section) => navigate(`/dashboard?section=${section}`)} />
    </div>
  );
}