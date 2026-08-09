import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// The app is served from a sub-path on GitHub Pages but from root in dev/preview.
// Set REACH_BASE at build time (e.g. REACH_BASE=/REACH-library/) when deploying.
const base = process.env.REACH_BASE ?? '/'

export default defineConfig({
  base,
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'REACH — University of Jos Library',
        short_name: 'REACH',
        description:
          'Resource, Engagement, Academic, Community, Hub — discover, borrow and earn XP with University of Jos Library.',
        theme_color: '#0EA5E9',
        background_color: '#0C2342',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        categories: ['education', 'books', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Search the catalogue', url: '/search' },
          { name: 'My loans', url: '/profile' },
          { name: 'Notifications', url: '/notifications' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Catalogue reads stay usable offline; refreshed in the background.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/catalogue'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'reach-catalogue',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'reach-images',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
