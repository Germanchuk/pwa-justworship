import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
// @ts-ignore
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "Just Worship",
        short_name: "Just Worship",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/logo192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/logo512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      strategies: "generateSW",
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/be\.justworship\.uk\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 9999, // Максимум 9999 елементів
                maxAgeSeconds: 60 * 60 * 24 * 365, // 365 днів
              },
              cacheableResponse: {
                statuses: [0, 200], // Кешувати тільки успішні відповіді
              },
            },
          },
        ],
      },
    }),
  ],
});
