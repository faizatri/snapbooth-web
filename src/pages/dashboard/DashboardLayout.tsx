import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/dashboard', label: 'Ringkasan', end: true },
  { to: '/dashboard/events', label: 'Events', end: false },
  { to: '/dashboard/templates', label: 'Templates', end: false },
  { to: '/dashboard/settings', label: 'Pengaturan', end: false },
]

function MenuIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <line x1="3" y1="6" x2="17" y2="6" />
      <line x1="3" y1="11" x2="17" y2="11" />
      <line x1="3" y1="16" x2="17" y2="16" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
    </svg>
  )
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header (fixed) ── */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 z-40">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="md:hidden p-2 -ml-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'}
        >
          {sidebarOpen ? <XIcon /> : <MenuIcon />}
        </button>

        {/* Logo */}
        <span className="font-bold tracking-[0.2em] text-sm uppercase flex-1">SnapBooth</span>

        {/* User info + logout */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium text-white">{user.name}</span>
              <span className="text-xs text-gray-500">{user.email}</span>
            </div>
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Keluar
          </button>
        </div>
      </header>

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* ── Sidebar (fixed) ── */}
      <nav
        className={[
          'fixed top-14 left-0 bottom-0 w-56',
          'bg-gray-900 border-r border-gray-800',
          'flex flex-col pt-4 pb-6 gap-1 px-2',
          'z-30 transition-transform duration-200 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={closeSidebar}
            className={({ isActive }) =>
              `px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white text-black font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* ── Main content ── */}
      {/* pt-14: clear fixed header; md:pl-56: clear fixed sidebar on desktop */}
      <main className="pt-14 md:pl-56 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
