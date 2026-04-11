import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ik-photos",
        short_name: "ik-photos",
        description: "Self-hosted photo gallery for your kDrive",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /\/api\/drives\/.+\/photos\/.+\/thumbnail/,
            handler: "CacheFirst",
            options: {
              cacheName: "thumbnails-cache",
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Strip volatile query params (token, _t) so the cache key
                  // stays stable across JWT refreshes and cache-buster bumps.
                  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
                    const url = new URL(request.url);
                    url.searchParams.delete("token");
                    url.searchParams.delete("_t");
                    return url.href;
                  },
                },
              ],
            },
          },
          {
            urlPattern: /\/api\/drives\/.+\/photos\/.+\/preview/,
            handler: "CacheFirst",
            options: {
              cacheName: "previews-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
              plugins: [
                {
                  // Strip token, _t, and dimensions so resized previews still
                  // hit cache (dimensions rarely change for the same device).
                  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
                    const url = new URL(request.url);
                    url.searchParams.delete("token");
                    url.searchParams.delete("_t");
                    url.searchParams.delete("w");
                    url.searchParams.delete("h");
                    return url.href;
                  },
                },
              ],
            },
          },
          {
            urlPattern: /\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3003,
  },
});
