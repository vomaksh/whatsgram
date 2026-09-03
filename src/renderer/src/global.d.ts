export {}

declare global {
  interface Window {
    loadingAPI: {
      onConnectionStatusChange: (callback: (status: string) => void) => void
      retry: () => void
    }
  }
}
