import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import { useBrand } from './store/brand';
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
  const { initializeBrands } = useBrand();
  const [booting, setBooting] = useState(true);

  console.log('App render - booting:', booting);

  // Auto-login as admin (no login page needed in dev mode)
  useEffect(() => {
    console.log('App useEffect running');
    const autoLogin = async () => {
      try {
        console.log('Starting auto-login...');
        const response = await api.login('admin', 'admin123');
        console.log('Login successful:', response.user);
        setUser(response.user);
        // Initialize brands after successful login
        await initializeBrands();
        console.log('Brands initialized');
      } catch (error) {
        console.error('Auto-login failed:', error);
      } finally {
        console.log('Setting booting to false');
        setBooting(false);
      }
    };
    
    // Only auto-login if no token exists
    if (!api.getToken()) {
      console.log('No token found, auto-logging in...');
      autoLogin();
    } else {
      console.log('Token found, initializing brands...');
      // If token exists, still initialize brands
      initializeBrands().finally(() => setBooting(false));
    }
  }, [setUser]); // Removed initializeBrands from deps to prevent infinite loop

  if (booting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-lg font-semibold text-gray-800 mb-2">Starting Heimdell CRM...</div>
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
        </div>
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