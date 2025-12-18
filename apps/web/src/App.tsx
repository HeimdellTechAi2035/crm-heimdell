import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import { api } from './lib/api';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Companies } from './pages/Companies';
import { Deals } from './pages/Deals';
import { Tasks } from './pages/Tasks';
import { Sequences } from './pages/Sequences';
import { Reports } from './pages/Reports';
import Imports from './pages/Imports';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { SystemStatusDashboard } from './pages/SystemStatusDashboard';

function App() {
  const { setUser } = useAuthStore();
  const [booting, setBooting] = useState(true);

  // Auto-login as admin (no login page needed in dev mode)
  useEffect(() => {
    const autoLogin = async () => {
      try {
        const response = await api.login('admin', 'admin123');
        setUser(response.user);
      } catch (error) {
        console.error('Auto-login failed:', error);
      } finally {
        setBooting(false);
      }
    };
    
    // Only auto-login if no token exists
    if (!api.getToken()) {
      autoLogin();
    } else {
      setBooting(false);
    }
  }, [setUser]);

  if (booting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Starting...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/deals" element={<Deals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/sequences" element={<Sequences />} />
          <Route path="/imports" element={<Imports />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/admin/diagnostics" element={<DiagnosticsPage />} />
          <Route path="/admin/system-status" element={<SystemStatusDashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
