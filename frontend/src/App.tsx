import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage';

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex">
        {/* Sidebar */}
        <nav className="w-52 bg-white border-r border-gray-200 flex flex-col py-6 px-3 gap-1 shrink-0">
          <span className="px-3 mb-4 text-xs font-bold text-gray-400 uppercase tracking-widest">
            Warehouse Optimizer
          </span>

          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => [
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              <span className="text-base">{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="*" element={
              <div className="p-10 text-gray-400 text-sm">Coming in next phase…</div>
            } />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

const NAV_ITEMS = [
  { to: '/upload',          label: 'Import Data',    icon: '📤' },
  { to: '/map',             label: 'Warehouse Map',  icon: '🗺️'  },
  { to: '/recommendations', label: 'Recommendations',icon: '💡' },
  { to: '/scoring',         label: 'Scoring',        icon: '📊' },
  { to: '/routes',          label: 'Routes',         icon: '🚶' },
  { to: '/settings',        label: 'Settings',       icon: '⚙️'  },
];
