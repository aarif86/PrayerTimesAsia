import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/nunito/wght.css'
import './ui/flags.css'
import { render } from 'preact'
import './ui/app.css'
import './ui/screens.css'
import { App } from './ui/App'
import { registerServiceWorker } from './ui/pwa'

render(<App />, document.getElementById('app')!)
registerServiceWorker()

// Opening screen (index.html): let its movement finish (about a second), or keep a still dial up
// for a short moment so it is seen, not flashed, then fade it out.
const opening = document.getElementById('opening')
if (opening) {
  const holdMs = (window as { __openingMs?: number }).__openingMs ?? 900
  const shown = Math.max(0, holdMs - performance.now())
  setTimeout(() => {
    opening.classList.add('done')
    setTimeout(() => opening.remove(), 450)
  }, shown)
}
