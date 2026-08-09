import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { store } from '@/app/store'
import { App } from '@/App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

// `autoUpdate` is configured in vite.config.ts, so a new build takes effect on
// the next launch without prompting the user mid-session.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
