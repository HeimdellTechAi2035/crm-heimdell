import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';

interface DiagnosticsRun {
  id: string;
  mode: 'quick' | 'full' | 'preflight';
  status: 'running' | 'completed' | 'failed';
  summary: {
    totalChecks?: number;
    passed?: number;
    warned?: number;
    failed?: number;
    totalDurationMs?: number;
    byCategory?: Record<string, any>;
  };
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface CheckResult {
  id: string;
  category: string;
  checkName: string;
  status: 'pass' | 'warn' | 'fail';
  durationMs: number;
  details: Record<string, any>;
  recommendation: string | null;
  evidence: string | null;
  createdAt: string;
}

export function DiagnosticsPage() {
  const [runs, setRuns] = useState<DiagnosticsRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<DiagnosticsRun | null>(null);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      const response = await api.get('/diagnostics/runs');
      setRuns(response.data.runs);
    } catch (error) {
      console.error('Failed to load runs:', error);
    }
  };

  const startRun = async (mode: 'quick' | 'full' | 'preflight', testMode: boolean) => {
    setLoading(true);
    try {
      await api.post('/diagnostics/runs', { mode, testMode });
      // Poll for updates
      setTimeout(() => {
        loadRuns();
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to start run:', error);
      setLoading(false);
    }
  };

  const viewResults = async (run: DiagnosticsRun) => {
    setSelectedRun(run);
    try {
      const response = await api.get(`/diagnostics/runs/${run.id}/results`);
      setResults(response.data.results);
    } catch (error) {
      console.error('Failed to load results:', error);
    }
  };

  const retryFailed = async (runId: string) => {
    setLoading(true);
    try {
      await api.post(`/diagnostics/runs/${runId}/retry-failed`);
      setTimeout(() => {
        loadRuns();
        setLoading(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to retry:', error);
      setLoading(false);
    }
  };

  const toggleResult = (resultId: string) => {
    const newExpanded = new Set(expandedResults);
    if (newExpanded.has(resultId)) {
      newExpanded.delete(resultId);
    } else {
      newExpanded.add(resultId);
    }
    setExpandedResults(newExpanded);
  };

  const downloadJSON = () => {
    if (!selectedRun || !results) return;
    const data = {
      run: selectedRun,
      results,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${selectedRun.id}.json`;
    a.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'text-green-600 bg-green-50';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50';
      case 'fail':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return '✓';
      case 'warn':
        return '⚠';
      case 'fail':
        return '✗';
      default:
        return '?';
    }
  };

  if (selectedRun && results) {
    return (
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Button onClick={() => setSelectedRun(null)} className="mb-4">
              ← Back to Runs
            </Button>
            <h1 className="text-3xl font-bold">Diagnostics Results</h1>
            <p className="text-gray-600">
              Run {selectedRun.id} • {selectedRun.mode} mode • {selectedRun.status}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={downloadJSON}>Download JSON</Button>
            {selectedRun.summary.failed && selectedRun.summary.failed > 0 && (
              <Button onClick={() => retryFailed(selectedRun.id)} disabled={loading}>
                Retry Failed
              </Button>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        {selectedRun.summary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="p-4">
              <div className="text-sm text-gray-600">Total Checks</div>
              <div className="text-2xl font-bold">{selectedRun.summary.totalChecks}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Passed</div>
              <div className="text-2xl font-bold text-green-600">
                {selectedRun.summary.passed}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Warnings</div>
              <div className="text-2xl font-bold text-yellow-600">
                {selectedRun.summary.warned}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-600">Failed</div>
              <div className="text-2xl font-bold text-red-600">
                {selectedRun.summary.failed}
              </div>
            </Card>
          </div>
        )}

        {/* Results Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Check Name</th>
                  <th className="p-3 text-left">Duration (ms)</th>
                  <th className="p-3 text-left">Evidence</th>
                  <th className="p-3 text-left"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <>
                    <tr key={result.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${getStatusColor(
                            result.status
                          )}`}
                        >
                          {getStatusIcon(result.status)} {result.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 font-medium">{result.category}</td>
                      <td className="p-3">{result.checkName}</td>
                      <td className="p-3">{result.durationMs}ms</td>
                      <td className="p-3 text-sm text-gray-600">{result.evidence}</td>
                      <td className="p-3">
                        <Button
                          onClick={() => toggleResult(result.id)}
                          className="text-xs"
                        >
                          {expandedResults.has(result.id) ? 'Hide' : 'Details'}
                        </Button>
                      </td>
                    </tr>
                    {expandedResults.has(result.id) && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="p-4">
                          <div className="space-y-2">
                            {result.recommendation && (
                              <div>
                                <strong>Recommendation:</strong>
                                <p className="text-sm text-gray-700">{result.recommendation}</p>
                              </div>
                            )}
                            <div>
                              <strong>Details:</strong>
                              <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">System Diagnostics</h1>
        <p className="text-gray-600">
          Run comprehensive system checks to verify all components are properly configured
        </p>
      </div>

      {/* Start New Run */}
      <Card className="mb-6 p-6">
        <h2 className="text-xl font-semibold mb-4">Start New Diagnostics Run</h2>
        <div className="flex gap-3">
          <Button
            onClick={() => startRun('quick', false)}
            disabled={loading}
            className="flex-1"
          >
            Quick Check
          </Button>
          <Button
            onClick={() => startRun('full', false)}
            disabled={loading}
            className="flex-1"
          >
            Full Check
          </Button>
          <Button
            onClick={() => startRun('preflight', true)}
            disabled={loading}
            className="flex-1"
          >
            Preflight (Test Mode)
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Quick: Essential checks only • Full: All checks including backups • Preflight: Safe
          test mode with no side effects
        </p>
      </Card>

      {/* Recent Runs */}
      <Card>
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Recent Runs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-3 text-left">Run ID</th>
                <th className="p-3 text-left">Mode</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Results</th>
                <th className="p-3 text-left">User</th>
                <th className="p-3 text-left">Created</th>
                <th className="p-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{run.id.slice(0, 8)}</td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                      {run.mode.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : run.status === 'running'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {run.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    {run.summary && run.summary.totalChecks && (
                      <div className="text-sm">
                        <span className="text-green-600">{run.summary.passed || 0}</span> /{' '}
                        <span className="text-yellow-600">{run.summary.warned || 0}</span> /{' '}
                        <span className="text-red-600">{run.summary.failed || 0}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-sm">{run.user.name}</td>
                  <td className="p-3 text-sm text-gray-600">
                    {new Date(run.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <Button onClick={() => viewResults(run)} className="text-xs">
                      View Results
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
