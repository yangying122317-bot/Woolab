import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      "Cache-Control": "no-store",
    },
  },
  build: {
    target: ["es2020", "safari14", "ios14", "chrome90"],
    cssTarget: ["safari14", "ios14", "chrome90"],
  },
});
