import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/ai-api": "http://127.0.0.1:8000",
      "/login/creds": "http://127.0.0.1:5000",
      "/auth": "http://127.0.0.1:5000",
      "/admin/": {
        target: "http://127.0.0.1:5000",
        bypass: (req) => {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html";
          }
        },
      },
      "/uploads": "http://127.0.0.1:5000",
      "/letters": "http://127.0.0.1:5000",
    },
  },
});