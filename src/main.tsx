import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import { SettingsProvider } from './contexts/SettingsContext.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { RequireAdmin } from './components/RequireAdmin.tsx'
import { AdminLayout } from './pages/admin/AdminLayout.tsx'
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx'
import { AdminUsers } from './pages/admin/AdminUsers.tsx'
import { AdminProjects } from './pages/admin/AdminProjects.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/admin"
              element={
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="projects" element={<AdminProjects />} />
            </Route>
          </Routes>
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
