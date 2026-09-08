import React from 'react'
import ReactDOM from 'react-dom/client'
const Root = React.lazy(() => window.location.pathname === '/trainer-consent' ? import('./TrainerConsent.jsx') : import('./App.jsx'))

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<p role="status">Opening WiFit…</p>}><Root /></React.Suspense>
  </React.StrictMode>,
)
