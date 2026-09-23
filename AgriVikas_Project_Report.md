# AgriVikas Home - System Audit Report

**Date:** October 26, 2023
**Auditor:** AI Agent
**Project:** AgriVikas Home

## 1. Executive Summary
The AgriVikas platform is a robust, AI-driven agricultural assistant designed for Indian farmers. It successfully integrates real-time weather data, AI-based advisory services (text and vision), and multilingual voice interaction. The core infrastructure is built on Convex (backend) and React/Vite (frontend). The system is functional, but several areas regarding code maintainability (large file sizes), browser compatibility (Speech API), and AI safety disclaimers could be improved.

## 2. Feature Walkthrough & Verification

### ✅ Landing Page
- **Status:** Functional.
- **Observations:** Contains multilingual support and entry points to the application.
- **Note:** File size (`src/pages/Landing.tsx`) is large (>22k chars), suggesting a need for component decomposition.

### ✅ Authentication
- **Status:** Implemented via Convex Auth.
- **Observations:** `useAuth` hook manages state correctly. Protected routes are enforced in `Dashboard.tsx`.

### ✅ Dashboard
- **Home:** Aggregates weather and alerts.
- **Farmer Profile:** `FarmerProfileForm.tsx` correctly reads/writes to `farmerProfiles` table.
- **Irrigation:** Logic in `farmers.ts` (`calculateIrrigationDays`) is rule-based, providing stable but deterministic advice based on soil/weather.
- **Disease Detection:** `DiseaseDetection.tsx` integrates with AI vision models.
- **Crop Advisory:** `SmartCropAdvisory.tsx` uses AI for recommendations.
- **Govt Schemes:** Functional search and listing.

### ✅ Voice Chatbot
- **Status:** Functional (Browser Dependent).
- **Observations:**
    - Relies on `window.SpeechRecognition` (Web Speech API). Support is excellent in Chrome/Edge but limited in Firefox/Safari.
    - Multilingual support (English, Hindi, Punjabi) is hardcoded and functional.
    - Intent detection is client-side keyword matching (`detectIntent` in `VoiceChatbot.tsx`). This is fast but less flexible than LLM-based intent classification.

## 3. Integration Status

### 🔌 Convex Backend
- **Status:** Healthy.
- **Schema:** Well-defined in `src/convex/schema.ts`.
- **Functions:** Actions and queries are properly separated.

### 🔌 OpenRouter AI (Ling 3.0 Flash / Gemini vision)
- **Status:** Integrated.
- **Config:** Centralized in `src/convex/config.ts`.
- **Models:** Ling 3.0 Flash (`inclusionai/ling-3.0-flash`) powers the chatbot, voice assistant, crop advisory, and govt schemes; Gemini 2.5 Flash (via OpenRouter) powers disease detection image analysis.
- **Error Handling:** `chatbot.ts` includes specific checks for missing API keys and returns user-friendly error messages.

### 🔌 OpenWeatherMap
- **Status:** Integrated.
- **Config:** Centralized in `src/convex/config.ts`.
- **Usage:** Used in `weather.ts`, `chatbot.ts` (live weather answers) and `farmers.ts` for irrigation logic.

### 🔌 data.gov.in AGMARKNET (Mandi Prices)
- **Status:** Integrated.
- **Source:** Official "Current Daily Price of Various Commodities from Various Markets (Mandi)" dataset.
- **Usage:** `mandiPrices.ts` fetches live wholesale prices; surfaced in the Mandi Prices section, Smart Crop Advisory results, and the chatbot's mandi intent.

## 4. Data Consistency & Schema

- **Farmer Profiles:** The `farmerProfiles` table is the source of truth. The schema correctly links `userId` to profile data.
- **History Tracking:**
    - `diseaseAnalyses` tracks past detections.
    - `cropAdvisories` tracks past advice.
    - `schemeSearches` tracks scheme interest.
- **Consistency:** Data flow from Backend -> Frontend is reactive using Convex queries (`useQuery`), ensuring UI is always in sync with DB.

## 5. AI Trust, Safety & Prompts

### 🛡️ Chatbot (`src/convex/chatbot.ts`)
- **System Prompt:** "You are AgriVikas Smart Assistant... helpful AI companion...".
- **Safety:**
    - Explicitly instructs to respond in the requested language ONLY.
    - Instructs to be concise and practical.
- **Gap:** Lacks a strong medical/agricultural disclaimer (e.g., "Consult an expert before applying chemical treatments").

### 🛡️ Disease Detection
- **Analysis:** Relies on Vision models.
- **Safety:** The prompt structure (inferred from context) asks for disease name, confidence, and treatment.
- **Risk:** AI hallucinations on blurry images could lead to wrong chemical usage.

## 6. User Experience & Accessibility

### ♿ Accessibility
- **Voice:** Excellent feature for low-literacy users.
- **Language:** Context provider (`LanguageContext.tsx`) covers the entire app.
- **Visuals:** UI uses Shadcn/Tailwind, which is generally accessible, but high-contrast modes for outdoor usage could be verified.

### 📱 Responsiveness
- **Mobile:** `DashboardLayout` and `VoiceChatbot` (floating button) are designed for mobile.
- **Performance:** Large component files might cause slower initial hydration on low-end devices.

## 7. Code Quality & Performance

### ⚠️ Maintenance Risks
- **Large Files:**
    - `src/components/dashboard/DiseaseDetection.tsx` (~48k chars)
    - `src/contexts/LanguageContext.tsx` (~45k chars)
    - `src/components/VoiceChatbot.tsx` (~33k chars)
    - `src/pages/Landing.tsx` (~22k chars)
- **Impact:** Hard to read, debug, and maintain. High risk of merge conflicts.

### ⚡ Performance
- **Client-side Logic:** Heavy logic in `VoiceChatbot` (intent detection) runs on the main thread.
- **API Calls:** Weather and AI calls are handled via Convex Actions (server-side), which is excellent for hiding API keys and managing rate limits.

## 8. Recommendations

### 🔴 Critical (Safety & Stability)
1.  **Add Disclaimers:** Update AI system prompts to include: *"Note: AI advice is for guidance only. Please consult a local agriculture expert before applying chemical treatments."*
2.  **Browser Fallback:** Add a UI notice if `SpeechRecognition` is not supported (e.g., on Firefox), suggesting the user type instead.

### 🟡 Important (Maintenance)
3.  **Refactor Large Components:** Break down `DiseaseDetection.tsx` and `VoiceChatbot.tsx` into smaller sub-components (e.g., `ChatInterface`, `AudioRecorder`, `ResultCard`).
4.  **Move Intent Logic:** Consider moving intent detection to a Convex Action (using a small LLM or regex) to centralize logic and improve accuracy over time.

### 🟢 Enhancements (UX)
5.  **Offline Mode:** Implement basic offline support for viewing previously loaded reports (PWA capabilities).
6.  **Image Validation:** Add client-side checks to ensure uploaded leaf images are not blurry before sending to AI to save costs/time.

---
**End of Report**