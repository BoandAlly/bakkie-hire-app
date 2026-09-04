// Android's back button, made to behave the way every other Android app does.
//
// Out of the box Capacitor closes the app on back, wherever you are. So a
// driver halfway through a listing, or a customer reading a booking, taps back
// once out of habit and the app is gone.
//
// The standard Android pattern instead:
//   - on a pushed screen, go back one screen
//   - on a main tab that is not the first, go to the first tab
//   - on the first tab, one press warns and a second within two seconds exits
//
// The plugin only exists inside the APK. In a browser this does nothing, which
// is correct: a browser has its own back button and its own history.

const EXIT_WINDOW_MS = 2000

/**
 * Wire up the hardware back button.
 *
 * `handler` is called with no arguments and returns true if it handled the
 * press (it went back somewhere), or false if there was nowhere left to go -
 * at which point the double-press-to-exit behaviour takes over.
 *
 * `onWarn` is called when the first press lands with nowhere to go, so the app
 * can say "press back again to exit". Returns a cleanup function.
 */
export function onBackButton(handler, onWarn) {
  let removeListener = null
  let cancelled = false
  let armedUntil = 0

  // Imported at call time so the browser build never pulls the plugin in.
  import('@capacitor/app')
    .then(({ App }) => {
      if (cancelled) return
      const sub = App.addListener('backButton', () => {
        if (handler()) {
          armedUntil = 0
          return
        }

        // Nowhere left to go. First press warns, second one within the window
        // actually leaves - so a stray tap never closes the app.
        const now = Date.now()
        if (now < armedUntil) {
          App.exitApp()
          return
        }
        armedUntil = now + EXIT_WINDOW_MS
        onWarn?.()
      })

      // addListener resolves to the handle in Capacitor 5+, and returns it
      // directly in older versions.
      Promise.resolve(sub).then((h) => {
        if (cancelled) h?.remove?.()
        else removeListener = () => h?.remove?.()
      })
    })
    .catch(() => {
      // Not running inside the app - a browser has its own back button.
    })

  return () => {
    cancelled = true
    removeListener?.()
  }
}
