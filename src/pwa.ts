let deferredPrompt: BeforeInstallPromptEvent | null = null

/**
 * Track installability.
 *
 * `beforeinstallprompt` can only be replayed from a user gesture, so the event
 * is stashed here and released by the Settings screen's install button. Service
 * worker registration itself lives in `main.tsx`, which keeps this module free
 * of build-time virtual imports and therefore testable.
 */
export function watchInstallPrompt(onInstallAvailable: (available: boolean) => void) {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt = event as BeforeInstallPromptEvent
    onInstallAvailable(true)
  })

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    onInstallAvailable(false)
  })
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome
}
