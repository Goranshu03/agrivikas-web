"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

export const synthesizeSpeech = action({
  args: {
    text: v.string(),
    voiceId: v.optional(v.string()),
    outputFormat: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.NOIZ_API_KEY;

    if (!apiKey || apiKey.trim() === "") {
      return { success: false, error: "NOIZ_API_KEY not configured" };
    }

    const text = args.text.slice(0, 500); // Limit text length
    const voiceId = args.voiceId || ""; // Will use default if empty
    const outputFormat = args.outputFormat || "mp3";

    try {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("output_format", outputFormat);
      if (voiceId) {
        formData.append("voice_id", voiceId);
      }

      const response = await fetch("https://noiz.ai/v1/text-to-speech", {
        method: "POST",
        headers: {
          Authorization: apiKey,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Noiz TTS error:", response.status, errorText);
        return { success: false, error: `Noiz API error ${response.status}: ${errorText}` };
      }

      const audioBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString("base64");

      return {
        success: true,
        audioBase64: base64Audio,
        mimeType: outputFormat === "wav" ? "audio/wav" : "audio/mpeg",
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("Noiz TTS fetch error:", msg);
      return { success: false, error: msg };
    }
  },
});
