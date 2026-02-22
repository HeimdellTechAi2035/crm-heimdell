import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/auth';
import { api } from './lib/api';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { PipelineKanban } from './pages/PipelineKanban';
import { LeadDetail } from './pages/LeadDetail';
import { Leads } from './pages/Leads';
import { SettingsPage } from './pages/Settings';

function App() {
  const { user, isAuthenticated, setUser } = useAuthStore();
  const [booting, setBooting] = useState(true);

  // On mount: if a stored token exists, try to restore the session via /auth/me
  useEffect(() => {
    const restore = async () => {
      const token = api.getToken();
      if (!token) {
        setBooting(false);
        return;
      }
      try {
        const data = await api.getCurrentUser();
        if (data?.user) {
          setUser(data.user);
        } else {
          // Token invalid — clear it
          api.setToken(null);
        }
      } catch {
        api.setToken(null);
      } finally {
        setBooting(false);
      }
    };
    restore();
  }, [setUser]);

  // Boot screen
  if (booting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black scan-lines">
        <div className="text-center">
          <div className="text-lg font-['Orbitron'] font-bold text-cyan-400 neon-text mb-4">
            INITIALIZING HEIMDELL...
          </div>
          <div className="w-48 h-1 mx-auto bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-cyan-400 animate-pulse rounded" style={{ width: '60%' }} />
          </div>
          <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40 mt-2">
            LOADING OUTREACH ENGINE
          </div>
        </div>
      </div>
    );
  }

  // Not logged in → show login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // Authenticated → show app
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<PipelineKanban />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/leads/:id" element={<LeadDetail />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;