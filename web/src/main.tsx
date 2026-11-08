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

// Opening screen (index.html): keep it up for a short moment so it is seen, not flashed, then fade it out.
const opening = document.getElementById('opening')
if (opening) {
  const shown = Math.max(0, 900 - performance.now())
  setTimeout(() => {
    opening.classList.add('done')
    setTimeout(() => opening.remove(), 450)
  }, shown)
}
