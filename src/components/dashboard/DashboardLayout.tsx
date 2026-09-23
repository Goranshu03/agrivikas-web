import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/use-auth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Sprout,
  Droplets,
  Leaf,
  Building2,
  BarChart3,
  Store,
  MessageSquare,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  User,
} from "lucide-react";
import { useNavigate } from "react-router";

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentSection?: string;
  onSectionChange?: (section: string) => void;
}

export default function DashboardLayout({
  children,
  currentSection = "home",
  onSectionChange,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const menuItems = [
    { id: "home", icon: Home, label: t("dashboard.nav.home") },
    { id: "profile", icon: User, label: t("dashboard.nav.profile") },
    { id: "advisory", icon: Sprout, label: t("dashboard.nav.advisory") },
    { id: "irrigation", icon: Droplets, label: t("dashboard.nav.irrigation") },
    { id: "disease", icon: Leaf, label: t("dashboard.nav.disease") },
    { id: "schemes", icon: Building2, label: t("dashboard.nav.schemes") },
    { id: "mandi", icon: Store, label: t("dashboard.nav.mandi") },
    { id: "insights", icon: BarChart3, label: t("dashboard.nav.insights") },
    { id: "chat", icon: MessageSquare, label: t("dashboard.nav.chat") },
    { id: "settings", icon: Settings, label: t("dashboard.nav.settings") },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const languageOptions = [
    { value: "en", label: "🇬🇧 English", flag: "🇬🇧" },
    { value: "hi", label: "🇮🇳 हिंदी", flag: "🇮🇳" },
    { value: "pa", label: "🇮🇳 ਪੰਜਾਬੀ", flag: "🇮🇳" },
  ];

  const renderNav = (onClick?: () => void) =>
    menuItems.map((item) => {
      const Icon = item.icon;
      const isActive = currentSection === item.id;
      return (
        <Button
          key={item.id}
          variant={isActive ? "default" : "ghost"}
          className={`group w-full justify-start gap-3 active:scale-[0.98] ${
            isActive
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
          onClick={() => {
            onClick?.();
            onSectionChange?.(item.id);
          }}
        >
          <Icon className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
          {item.label}
        </Button>
      );
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-amber-50 to-green-50 dark:from-green-950 dark:via-emerald-950 dark:to-green-950">
      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-40 bg-gradient-to-r from-green-700 to-green-600 text-white shadow-lg dark:from-green-800 dark:to-green-700"
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Menu Toggle + Logo */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:flex text-white hover:bg-green-600 active:scale-95"
            >
              {sidebarOpen ? <ChevronLeft /> : <Menu />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white hover:bg-green-600 active:scale-95"
            >
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌿</span>
              <div>
                <h1 className="text-lg font-bold">{t("header.title")}</h1>
                <p className="text-xs text-green-100">{t("dashboard.title")}</p>
              </div>
            </div>
          </div>

          {/* Right: Theme + Language Selector + Profile */}
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle className="text-white hover:bg-green-600 active:scale-95" />
            <Select value={language} onValueChange={(val) => setLanguage(val as any)}>
              <SelectTrigger className="w-[140px] bg-green-600 border-green-500 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {languageOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 text-white hover:bg-green-600 active:scale-95"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-green-500 text-white">
                      {user?.name?.[0]?.toUpperCase() || "F"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">{user?.name || "Farmer"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("dashboard.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25 }}
              className="hidden md:block w-64 bg-card border-r border-border shadow-lg min-h-[calc(100vh-64px)] sticky top-16"
            >
              <nav className="p-4 space-y-2">{renderNav()}</nav>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25 }}
                className="fixed left-0 top-16 bottom-0 w-64 bg-card shadow-2xl z-50 md:hidden overflow-y-auto"
              >
                <nav className="p-4 space-y-2">
                  {renderNav(() => setMobileMenuOpen(false))}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <motion.div
            key={currentSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
