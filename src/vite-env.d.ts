/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: string
  readonly VITE_LOCAL_ADMIN_PASSWORD?: string
  readonly VITE_JONI_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
