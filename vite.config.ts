import { defineConfig, loadEnv } from "vite";
import { configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
// @ts-ignore
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Препрод і прод збираються з того самого коду й різняться лише змінними
  // збірки в Cloudflare. Препрод упізнаємо за адресою бекенду й даємо йому
  // бірюзову іконку, щоб на домашньому екрані не сплутати з продом.
  const isPreprod = /\/\/pre-be\./.test(loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL ?? "");
  const icon = (size: number) => (isPreprod ? `/logo-pre-${size}.png` : `/logo${size}.png`);

  return {
    plugins: [react(), tailwindcss(), tsconfigPaths(), {
      name: "env-favicon",
      transformIndexHtml: (html: string) =>
        isPreprod ? html.replace("/favicon.ico", "/favicon-pre.ico") : html,
    }, VitePWA({
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
            src: icon(192),
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: icon(512),
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
        // Типові файли плюс семпли гітари: програвання доріжок має звучати й без мережі.
        globPatterns: ["**/*.{js,wasm,css,html,mp3}"],
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
    test: {
      // Заморожений знімок старого звуку не тестується (ADR-0003, `archive/`).
      exclude: [...configDefaults.exclude, "archive/**"],
    },
  };
});
