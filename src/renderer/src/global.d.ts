export {}

declare global {
  interface Window {
    electronAPI: {
      retryLoad: () => void
    }
  }
}
