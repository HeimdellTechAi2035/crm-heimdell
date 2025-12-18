import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';

interface SystemHealth {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
}

export function SystemStatusDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    try {
      const response = await api.get('/api/diagnostics/health');
      setHealth(response.data);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
      setHealth({ status: 'down', timestamp: new Date().toISOString() });
      setLastCheck(new Date());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'down':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'down':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">System Status</h1>
        <p className="text-gray-600">Real-time operational metrics and system health</p>
      </div>

      {/* Overall Status */}
      <Card className="mb-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Overall System Status</h2>
            {health && (
              <div
                className={`inline-flex items-center px-4 py-2 rounded-lg text-lg font-semibold ${getStatusColor(
                  health.status
                )}`}
              >
                <span className="mr-2 text-2xl">{getStatusIcon(health.status)}</span>
                {health.status.toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-right text-sm text-gray-600">
            {lastCheck && (
              <>
                <div>Last checked: {lastCheck.toLocaleTimeString()}</div>
                <div className="mt-1">Auto-refresh: 30s</div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <ComponentStatusCard
          name="API Server"
          status={health?.status === 'ok' ? 'operational' : 'down'}
          lastCheck={lastCheck}
        />
        <ComponentStatusCard
          name="Database"
          status={health?.status === 'ok' ? 'operational' : 'unknown'}
          lastCheck={lastCheck}
        />
        <ComponentStatusCard
          name="Redis Cache"
          status="unknown"
          lastCheck={lastCheck}
        />
        <ComponentStatusCard
          name="Queue System"
          status="unknown"
          lastCheck={lastCheck}
        />
        <ComponentStatusCard
          name="Email Service"
          status="unknown"
          lastCheck={lastCheck}
        />
        <ComponentStatusCard
          name="AI Services"
          status="unknown"
          lastCheck={lastCheck}
        />
      </div>

      {/* Quick Actions */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => (window.location.href = '/admin/diagnostics')}
            className="p-4 border rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="font-semibold">Run Full Diagnostics</div>
            <div className="text-sm text-gray-600 mt-1">
              Comprehensive system check across all components
            </div>
          </button>
          <button
            onClick={() => checkHealth()}
            className="p-4 border rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="font-semibold">Refresh Status</div>
            <div className="text-sm text-gray-600 mt-1">
              Immediately check current system health
            </div>
          </button>
          <button
            onClick={() => (window.location.href = '/docs')}
            className="p-4 border rounded-lg hover:bg-gray-50 text-left"
          >
            <div className="font-semibold">View API Docs</div>
            <div className="text-sm text-gray-600 mt-1">
              Swagger documentation for all endpoints
            </div>
          </button>
        </div>
      </Card>

      {/* Info Note */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start">
          <span className="text-blue-600 mr-2">ℹ️</span>
          <div className="text-sm text-blue-800">
            <strong>Note:</strong> For detailed component status, run a full diagnostics check
            from the Diagnostics page. This dashboard shows basic health indicators only.
          </div>
        </div>
      </div>
    </div>
  );
}

interface ComponentStatusCardProps {
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  lastCheck: Date | null;
}

function ComponentStatusCard({ name, status, lastCheck }: ComponentStatusCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'down':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <Card className={`p-4 border-2 ${getStatusColor(status)}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{name}</h3>
        <span className="text-2xl">{getStatusIcon(status)}</span>
      </div>
      <div className="text-sm font-medium capitalize">{status}</div>
      {lastCheck && (
        <div className="text-xs mt-1 opacity-75">
          Checked {lastCheck.toLocaleTimeString()}
        </div>
      )}
    </Card>
  );
}
