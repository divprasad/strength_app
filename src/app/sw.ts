import { defaultCache } from "@serwist/next/worker";
import {
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
  NetworkFirst,
  ExpirationPlugin,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    // ── Navigation requests (full page loads / hard refreshes) ───────────
    // Strategy: NetworkFirst with a 3s timeout.
    //   - Online: fetches fresh HTML from the server, caches it.
    //   - Offline on a cached route: serves cached HTML from offline-pages-cache.
    //   - Offline on an uncached route: falls back to the precached root "/".
    //     This works because it's an SPA — the root shell renders any route.
    {
      matcher({ request }) {
        return request.mode === "navigate" || request.destination === "document";
      },
      handler: new NetworkFirst({
        cacheName: "offline-pages-cache",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
          // Offline fallback: if both network and cache miss, serve the
          // precached root. Serwist precaches "/" as part of __SW_MANIFEST,
          // so this is always available after the first install.
          {
            handlerDidError: async () => {
              return caches.match("/", { ignoreSearch: true });
            },
          },
        ],
      }),
    },

    // ── Next.js RSC (React Server Component) payloads ───────────────────
    // These are the data payloads for client-side navigation (?_rsc=...).
    // Cache them so navigating between pages works offline too.
    {
      matcher({ url }) {
        return url.searchParams.has("_rsc");
      },
      handler: new NetworkFirst({
        cacheName: "offline-rsc-cache",
        networkTimeoutSeconds: 3,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
        ],
      }),
    },

    // ── Default asset caching (JS chunks, CSS, images, fonts, etc.) ─────
    ...defaultCache,
  ],
});

serwist.addEventListeners();
