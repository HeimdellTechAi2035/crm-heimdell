import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './lib/useAuth';
import { AuthGuard } from './components/SupabaseAuthGuard';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { Companies } from './pages/Companies';
import { Deals } from './pages/Deals';
import { Tasks } from './pages/Tasks';
import { Sequences } from './pages/Sequences';
import { Reports } from './pages/Reports';
import Imports from './pages/Imports';
import { NetlifyImports } from './pages/NetlifyImports';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { SystemStatusDashboard } from './pages/SystemStatusDashboard';
import { AdminPage } from './pages/AdminPage';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthGuard>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              
              {/* Protected routes - all wrapped in Layout */}
              <Route path="/" element={<Layout><Dashboard /></Layout>} />
              <Route path="/leads" element={<Layout><Leads /></Layout>} />
              <Route path="/companies" element={<Layout><Companies /></Layout>} />
              <Route path="/deals" element={<Layout><Deals /></Layout>} />
              <Route path="/tasks" element={<Layout><Tasks /></Layout>} />
              <Route path="/sequences" element={<Layout><Sequences /></Layout>} />
              <Route path="/imports" element={<Layout><Imports /></Layout>} />
              <Route path="/imports/netlify" element={<Layout><NetlifyImports /></Layout>} />
              <Route path="/reports" element={<Layout><Reports /></Layout>} />
              <Route path="/admin" element={<Layout><AdminPage /></Layout>} />
              <Route path="/admin/diagnostics" element={<Layout><DiagnosticsPage /></Layout>} />
              <Route path="/admin/system-status" element={<Layout><SystemStatusDashboard /></Layout>} />
              
              {/* Catch-all: redirect unknown routes to login */}
              <Route path="*" element={<LoginPage />} />
            </Routes>
          </AuthGuard>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;