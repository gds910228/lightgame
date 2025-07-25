import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
// 导入EmailJS初始化函数
import { initEmailService } from './services/emailService'
import { FavoritesProvider } from './contexts/FavoritesContext'

// 初始化Email.js服务
initEmailService()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <FavoritesProvider>
        <App />
      </FavoritesProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
