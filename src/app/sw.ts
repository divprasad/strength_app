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

// Filter out defaultCache rules that conflict with our custom handlers.
// The default "pages-rsc", "pages-rsc-prefetch", "pages", and "others" rules
// use NetworkFirst with NO networkTimeoutSeconds, causing them to hang
// indefinitely offline. We replace them with our own timeout-aware versions.
const EXCLUDED_CACHES = new Set([
  "pages-rsc",
  "pages-rsc-prefetch",
  "pages",
  "others",
]);

const filteredDefaultCache = defaultCache.filter((rule) => {
  // Each defaultCache rule has a handler with a cacheName property.
  // We need to access it via the internal _cacheName on the strategy.
  const cacheName =
    (rule.handler as { cacheName?: string })?.cacheName ??
    (rule.handler as { _cacheName?: string })?._cacheName;
  return !cacheName || !EXCLUDED_CACHES.has(cacheName);
});

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

    // ── All RSC requests (header-based AND param-based) ─────────────────
    // Next.js uses RSC payloads for client-side navigation. These come in
    // two flavours:
    //   1. Prefetch:   ?_rsc=... param + RSC:1 + Next-Router-Prefetch:1 headers
    //   2. Navigation: RSC:1 header only (no _rsc param)
    //
    // We catch BOTH here with a 1s timeout so the bottom nav responds
    // instantly when offline.
    {
      matcher({ request, url }) {
        return (
          request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")
        );
      },
      handler: new NetworkFirst({
        cacheName: "offline-rsc-cache",
        networkTimeoutSeconds: 1,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          }),
          // If both network and cache miss (route never visited online),
          // return an empty response. This causes Next.js to fall back to
          // a full-page navigation, which the navigate handler above will
          // catch and serve from the precached root "/".
          {
            handlerDidError: async () => {
              return new Response("", {
                status: 200,
                headers: { "Content-Type": "text/x-component" },
              });
            },
          },
        ],
      }),
    },

    // ── Same-origin HTML pages ──────────────────────────────────────────
    // Replaces defaultCache's "pages" rule (which had no timeout).
    {
      matcher({ request, url: { pathname }, sameOrigin }) {
        return (
          request.headers.get("Content-Type")?.includes("text/html") &&
          sameOrigin &&
          !pathname.startsWith("/api/")
        );
      },
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 2,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },

    // ── Same-origin catch-all ───────────────────────────────────────────
    // Replaces defaultCache's "others" rule (which had no timeout).
    {
      matcher({ url: { pathname }, sameOrigin }) {
        return sameOrigin && !pathname.startsWith("/api/");
      },
      handler: new NetworkFirst({
        cacheName: "others",
        networkTimeoutSeconds: 2,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
          }),
        ],
      }),
    },

    // ── Default asset caching (JS chunks, CSS, images, fonts, etc.) ─────
    // Filtered to exclude rules we've replaced above.
    ...filteredDefaultCache,
  ],
});

serwist.addEventListeners();
