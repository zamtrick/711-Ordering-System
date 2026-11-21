import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");

  // A production build without an explicit API URL would silently point the
  // admin at http://localhost:5000. Fail the build instead of shipping that.
  if (mode === "production" && !env.VITE_API_URL) {
    throw new Error(
      "VITE_API_URL is required for production builds " +
        "(e.g. VITE_API_URL=https://711-api.onrender.com/api).",
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
  };
});
