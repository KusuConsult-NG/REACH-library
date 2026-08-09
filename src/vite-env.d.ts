/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Base URL of the REACH Express proxy; unset means run on seeded local data. */
  readonly VITE_API_BASE_URL?: string
  /** EZproxy-style prefix used to authenticate off-campus e-resource access. */
  readonly VITE_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Fired by Chromium browsers when the app becomes installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
