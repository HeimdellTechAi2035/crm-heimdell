import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { DeleteAllDataModal } from './DeleteAllDataModal';
import { useAuth } from '../lib/useAuth';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Target, 
  CheckSquare, 
  Mail, 
  BarChart3,
  Menu,
  Upload,
  Zap,
  Shield,
  Trash2,
  LogOut
} from 'lucide-react';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, isAdmin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = async () => {
    const result = await logout();
    if (result.success) {
      navigate('/login');
    }
  };

  // Base nav items for all users
  const baseNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
    { path: '/leads', icon: Users, label: 'LEADS' },
    { path: '/companies', icon: Building2, label: 'COMPANIES' },
    { path: '/deals', icon: Target, label: 'DEALS' },
    { path: '/tasks', icon: CheckSquare, label: 'TASKS' },
    { path: '/sequences', icon: Mail, label: 'SEQUENCES' },
    { path: '/imports/netlify', icon: Upload, label: 'IMPORT DATA' },
    { path: '/reports', icon: BarChart3, label: 'ANALYTICS' },
  ];

  // Add admin-only items
  const navItems = isAdmin 
    ? [...baseNavItems, { path: '/admin', icon: Shield, label: 'ADMIN PANEL' }]
    : baseNavItems;

  return (
    <div className="flex h-screen bg-background scan-lines">
      {/* Background Effects */}
      <div className="grid-bg" />
      
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-72' : 'w-20'} border-r border-cyan-500/20 bg-black/60 backdrop-blur-xl transition-all duration-300 sidebar-glow relative z-10`}>
        {/* Logo Section */}
        <div className="flex h-20 items-center justify-between px-4 border-b border-cyan-500/20">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Shield className="h-8 w-8 text-cyan-400 glow-icon" />
                <div className="absolute inset-0 h-8 w-8 bg-cyan-400/20 blur-lg animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-bold font-['Orbitron'] tracking-wider text-cyan-400 neon-text">
                  HEIMDELL
                </h1>
                <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/60 tracking-[0.3em]">
                  CRM SYSTEM v3.0
                </span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-cyan-400 hover:bg-cyan-400/10 hover:text-cyan-300"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Energy Bar */}
        <div className="energy-bar" />

        {/* Navigation */}
        <nav className="space-y-1 p-3 mt-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link flex items-center gap-4 px-4 py-3 transition-all duration-300 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-transparent text-cyan-400 border-l-2 border-cyan-400'
                    : 'text-cyan-400/60 hover:text-cyan-400 hover:bg-cyan-400/5'
                }`}
              >
                <Icon className={`h-5 w-5 transition-all duration-300 ${isActive ? 'glow-icon' : 'group-hover:glow-icon'}`} />
                {sidebarOpen && (
                  <span className="font-['Orbitron'] text-xs tracking-wider">
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-cyan-400 shadow-[0_0_10px_#00ffff]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* System Status */}
        {sidebarOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-cyan-500/20">
            <div className="data-panel rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3 w-3 text-green-400 status-online" />
                <span className="text-[10px] font-['Share_Tech_Mono'] text-green-400">SYSTEM ONLINE</span>
              </div>
              <div className="text-[9px] font-['Share_Tech_Mono'] text-cyan-400/40 space-y-1">
                <div className="flex justify-between">
                  <span>NEURAL LINK</span>
                  <span className="text-green-400">ACTIVE</span>
                </div>
                <div className="flex justify-between">
                  <span>DATA SYNC</span>
                  <span className="text-green-400">100%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-8 bg-black/40 backdrop-blur-xl header-glow">
          <div className="flex items-center gap-4">
            <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/40">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }).toUpperCase()}
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Delete All Data Button */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 hover:bg-red-500/20 transition-all font-['Share_Tech_Mono'] text-xs"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">DELETE ALL DATA</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded text-orange-400 hover:bg-orange-500/20 transition-all font-['Share_Tech_Mono'] text-xs"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">LOGOUT</span>
            </button>

            {/* User Info */}
            <div className="flex items-center gap-4 data-panel rounded px-4 py-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isAdmin ? 'bg-gradient-to-br from-yellow-400 to-orange-500' : 'bg-gradient-to-br from-cyan-400 to-purple-500'}`}>
                <span className="text-xs font-['Orbitron'] font-bold text-black">
                  {user?.email?.substring(0, 2).toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <div className="text-sm font-['Orbitron'] text-cyan-400 truncate max-w-[150px]">
                  {user?.email?.split('@')[0] || 'User'}
                </div>
                <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/50">
                  {isAdmin ? (
                    <span className="text-yellow-400">⚡ ADMIN</span>
                  ) : (
                    'AUTHENTICATED'
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Energy Bar */}
        <div className="energy-bar" />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-8 hex-pattern">
          {children}
        </main>
      </div>

      {/* Delete All Data Modal */}
      <DeleteAllDataModal 
        isOpen={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)} 
      />
    </div>
  );
}
