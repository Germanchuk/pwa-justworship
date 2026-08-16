import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
// @ts-ignore
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), VitePWA({
    // `prompt`, а не `autoUpdate`: нова версія чекає, поки користувач сам
    // натисне «Оновити» в банері на головному екрані (`src/lib/appUpdate.ts`).
    // Мовчазний перезапуск міг би зловити музиканта посеред служіння.
    registerType: "prompt",
    // Реєструємо SW самі через `virtual:pwa-register` — власний скрипт
    // реєстрації тут лише подвоїв би реєстрацію.
    injectRegister: null,
    devOptions: {
      enabled: true,
    },
    manifest: {
      name: "Just Worship",
      short_name: "Just Worship",
      start_url: "/",
      display: "standalone",
      background_color: "#f8f5eb",
      theme_color: "#f8f5eb",
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
      // Main JS bundle grew past workbox's 2 MiB default after the Slate/Yjs
      // migration, which made generateSW throw and fail the build. Raise the
      // precache size limit so the bundle is cached instead of erroring.
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
  })],
});