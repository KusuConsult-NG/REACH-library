import '@testing-library/jest-dom/vitest'

// jsdom implements neither of these; the shell calls scrollTo on every route change.
window.scrollTo = (() => {}) as typeof window.scrollTo

// jsdom does not implement matchMedia, which the theme layer reads on mount.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}
