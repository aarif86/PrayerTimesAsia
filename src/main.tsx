import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/nunito/wght.css'
import { render } from 'preact'
import './ui/app.css'
import './ui/screens.css'
import { App } from './ui/App'
import { registerServiceWorker } from './ui/pwa'

render(<App />, document.getElementById('app')!)
registerServiceWorker()
