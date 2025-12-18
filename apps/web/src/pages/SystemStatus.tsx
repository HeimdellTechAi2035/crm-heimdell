import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  database: { status: string; latency?: number };
  queue: { status: string; jobs?: { pending: number; failed: number } };
  alertCount: number;
}

interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  component: string;
  message: string;
  acknowledgedAt?: string;
  createdAt: string;
}

interface WorkerStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  avgProcessingTime?: number;
}

export function SystemStatusPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [workers, setWorkers] = useState<WorkerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [healthRes, alertsRes, workersRes] = await Promise.all([
        api.get('/health/detailed'),
        api.get('/api/system/alerts?limit=10'),
        api.get('/health/workers'),
      ]);

      setHealth(healthRes.data);
      setAlerts(alertsRes.data);
      setWorkers(workersRes.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load system status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await api.post(`/api/system/alerts/${alertId}/acknowledge`);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'ok':
        return 'bg-green-500';
      case 'degraded':
      case 'warning':
        return 'bg-yellow-500';
      case 'down':
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'critical':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Status</h2>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Status</h1>
          <p className="text-gray-600 mt-1">Real-time monitoring and health checks</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      {health && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(health.status)} mr-3`}></div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  System {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">All systems operational</p>
              </div>
            </div>
            {health.alertCount > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                {health.alertCount} Active Alert{health.alertCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Component Status */}
      {health && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Database */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(health.database.status)} mr-2`}></div>
              <h3 className="text-lg font-semibold text-gray-900">Database</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="font-medium text-gray-900">{health.database.status}</span>
              </div>
              {health.database.latency && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Latency</span>
                  <span className="font-medium text-gray-900">{health.database.latency}ms</span>
                </div>
              )}
            </div>
          </div>

          {/* Queue */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(health.queue.status)} mr-2`}></div>
              <h3 className="text-lg font-semibold text-gray-900">Queue</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status</span>
                <span className="font-medium text-gray-900">{health.queue.status}</span>
              </div>
              {health.queue.jobs && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pending Jobs</span>
                    <span className="font-medium text-gray-900">{health.queue.jobs.pending}</span>
                  </div>
                  {health.queue.jobs.failed > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Failed Jobs</span>
                      <span className="font-medium text-red-600">{health.queue.jobs.failed}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Worker Statistics */}
      {workers && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Worker Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">{workers.totalJobs}</p>
              <p className="text-xs text-gray-600 mt-1">Total Jobs</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{workers.pendingJobs}</p>
              <p className="text-xs text-gray-600 mt-1">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{workers.processingJobs}</p>
              <p className="text-xs text-gray-600 mt-1">Processing</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{workers.completedJobs}</p>
              <p className="text-xs text-gray-600 mt-1">Completed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{workers.failedJobs}</p>
              <p className="text-xs text-gray-600 mt-1">Failed</p>
            </div>
          </div>
          {workers.avgProcessingTime && (
            <div className="mt-4 pt-4 border-t border-gray-200 text-center">
              <p className="text-sm text-gray-600">
                Average Processing Time:{' '}
                <span className="font-medium text-gray-900">{workers.avgProcessingTime}ms</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h3>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 ${getSeverityColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="text-xs font-medium uppercase">{alert.severity}</span>
                      <span className="mx-2">•</span>
                      <span className="text-xs font-medium">{alert.component}</span>
                    </div>
                    <p className="text-sm font-medium mt-1">{alert.message}</p>
                    <p className="text-xs mt-1 opacity-75">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!alert.acknowledgedAt && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="ml-4 px-3 py-1 text-xs font-medium bg-white bg-opacity-50 hover:bg-opacity-75 rounded-md transition-colors"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
