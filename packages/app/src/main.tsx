import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
// 导入EmailJS初始化函数
import { initEmailService } from './services/emailService'

// 初始化Email.js服务
initEmailService()

// Register Service Worker
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[SW] Service Worker registered successfully:', registration.scope)

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content is available
                console.log('[SW] New content is available; please refresh.')
                // You can show a notification to the user here
              }
            })
          }
        })
      })
      .catch((error) => {
        console.error('[SW] Service Worker registration failed:', error)
      })
  })

  // Listen for controlling changes
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Controller changed, page will be reloaded')
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
) 