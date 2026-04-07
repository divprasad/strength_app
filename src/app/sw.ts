import { defaultCache } from "@serwist/next/worker";
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig, NetworkFirst, ExpirationPlugin } from "serwist";

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
    {
      matcher({ request }) {
        return request.mode === "navigate" || request.destination === "document";
      },
      handler: new NetworkFirst({
        cacheName: "offline-pages-cache",
        networkTimeoutSeconds: 3, // Give up on network fast to serve offline cache
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
          }),
        ],
      }),
    },
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
    ...defaultCache,
  ],
});

serwist.addEventListeners();
