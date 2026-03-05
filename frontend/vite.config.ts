import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy allows calling conversion-service without CORS issues from the browser.
// Browser -> http://localhost:5173/conversion/... -> Vite -> http://conversion:8000/...
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/conversion": {
        target: "http://conversion:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/conversion/, ""),
      },
    },
  },
});
