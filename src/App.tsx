import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import BoothPage from './pages/BoothPage'
import SharePage from './pages/SharePage'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import DashboardHome from './pages/dashboard/DashboardHome'
import EventsPage from './pages/dashboard/EventsPage'
import EventGalleryPage from './pages/dashboard/EventGalleryPage'
import TemplatesPage from './pages/dashboard/TemplatesPage'
import SettingsPage from './pages/dashboard/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/booth/:eventSlug" element={<BoothPage />} />
        <Route path="/share/:shareToken" element={<SharePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected dashboard routes */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:id/gallery" element={<EventGalleryPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
