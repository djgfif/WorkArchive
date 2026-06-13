import react from '@vitejs/plugin-react-swc';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 새 버전은 자동 새로고침하지 않고 토스트로 사용자에게 알린다.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['work-archive-icon.svg'],
      manifest: {
        name: 'Work Archive — 내 감상 기록 서재',
        short_name: 'Work Archive',
        description:
          '소설, 웹소설, 라이트노벨, 웹툰, 만화, 애니, 영화, 드라마 감상 기록을 내 기기에 먼저 저장하는 개인 서재.',
        lang: 'ko',
        dir: 'ltr',
        theme_color: '#0c0b0a',
        background_color: '#0c0b0a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        categories: ['books', 'entertainment', 'productivity'],
        icons: [
          {
            src: '/work-archive-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/work-archive-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA 라우트는 오프라인에서도 index.html 로 폴백한다(API 제외).
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/health/],
        // 자체 호스팅 한글 폰트는 unicode-range 서브셋이 수백 개라 precache 에서
        // 제외하고, 실제 요청되는 글리프 청크만 런타임 CacheFirst 로 보관한다.
        globPatterns: ['**/*.{js,css,html,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // 자체 호스팅 웹폰트 — 요청된 서브셋만 캐시 우선으로 보관
            urlPattern: ({ request, url }) =>
              request.destination === 'font' ||
              /\.(?:woff2?|ttf|otf)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wa-fonts',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 표지 프록시 — 이미지이므로 캐시 우선
            urlPattern: ({ url }) => url.pathname.startsWith('/api/image-proxy'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wa-cover-proxy',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 그 외 API 응답은 인증·데이터 민감 — 캐시하지 않고 네트워크 전용
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
          {
            // 프록시가 실패해 외부 표지 후보로 넘어가도 표지는 캐시 우선으로 유지한다.
            urlPattern: ({ url }) =>
              url.protocol === 'https:' &&
              new RegExp(
                '(^|\\.)((archive\\.org)|(books\\.google\\.com)|' +
                  '(covers\\.openlibrary\\.org)|(daumcdn\\.net)|' +
                  '(googleusercontent\\.com)|(image\\.aladin\\.co\\.kr)|' +
                  '(image\\.tmdb\\.org)|(kakaocdn\\.net)|(pstatic\\.net)|' +
                  '(s4\\.anilist\\.co)|(static\\.tvmaze\\.com)|' +
                  '(wikimedia\\.org))$',
              ).test(url.hostname.toLowerCase()),
            handler: 'CacheFirst',
            options: {
              cacheName: 'wa-external-covers',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // 개발 모드에서는 SW 를 끄고(HMR 충돌 방지), 프로덕션 프리뷰로 검증한다.
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@test': fileURLToPath(new URL('./src/test', import.meta.url)),
    },
  },

  server: {
    host: 'localhost',
    port: 18730,
    proxy: {
      '/api': {
        target: 'http://localhost:18731',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:18731',
        changeOrigin: true,
      },
    },
    strictPort: true,
  },

  build: {
    // 폰트는 service worker 런타임 CacheFirst 정책으로 다룬다. 작은 woff/woff2도
    // CSS에 data: URL로 인라인하지 않아 precache CSS가 비대해지지 않게 한다.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (!normalizedId.includes('node_modules')) {
            return undefined;
          }

          if (normalizedId.includes('/dexie')) {
            return 'dexie-vendor';
          }

          if (normalizedId.includes('/@dnd-kit/')) {
            return 'dnd-kit-vendor';
          }

          if (normalizedId.includes('/html-to-image/')) {
            return 'html-to-image-vendor';
          }

          if (
            normalizedId.includes('/react/') ||
            normalizedId.includes('/react-dom/') ||
            normalizedId.includes('/react-router') ||
            normalizedId.includes('/@tanstack/react-query/')
          ) {
            return 'react-vendor';
          }

          if (normalizedId.includes('/@mantine/')) {
            return 'mantine-vendor';
          }

          return undefined;
        },
      },
    },
  },

  test: {
    // virtual:pwa-register/react 는 빌드 시점에만 존재하므로 테스트에서는 stub 으로 대체한다.
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url),
      ),
    },
    environment: 'jsdom',
    exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    globals: false,
    setupFiles: './src/test/setup.ts',
    testTimeout: 15_000,
  },
});
