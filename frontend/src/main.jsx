import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import PassengerApp from './pages/PassengerApp.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/app" element={<PassengerApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
