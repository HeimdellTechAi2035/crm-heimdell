import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useBrand } from '../store/brand';

interface ForecastData {
  pipelineValue: number;
  expectedValue: number;
  probableValue: number;
  dealCount: number;
  dealsByStage: Array<{
    stage: string;
    count: number;
    totalValue: number;
    probability: number;
  }>;
}

interface ForecastDashboardProps {
  pipelineId?: string;
  compact?: boolean;
}

export function ForecastDashboard({ pipelineId, compact = false }: ForecastDashboardProps) {
  const { selectedBrand, loading: brandLoading } = useBrand();
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (selectedBrand?.id) params.append('business_unit_id', selectedBrand.id);
        if (pipelineId) params.append('pipeline_id', pipelineId);

        const response = await api.get(`/api/forecasting/pipeline?${params.toString()}`);
        setForecast(response.data);
        setError(null);
      } catch (err: any) {
        console.warn('Failed to load forecast:', err.message);
        setError(err.message || 'Failed to load forecast');
        setForecast(null); // Fail gracefully
      } finally {
        setLoading(false);
      }
    };

    // Only fetch forecast if brand context has loaded
    if (!brandLoading) {
      fetchForecast();
    }
  }, [selectedBrand?.id, pipelineId, brandLoading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-3 text-sm text-gray-600">Loading forecast...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!forecast) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getConfidenceColor = (value: number, total: number) => {
    const percentage = (value / total) * 100;
    if (percentage >= 75) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (compact) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Pipeline Forecast</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Pipeline</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">
              {formatCurrency(forecast.pipelineValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Expected</p>
            <p
              className={`text-lg font-semibold mt-1 ${getConfidenceColor(
                forecast.expectedValue,
                forecast.pipelineValue
              )}`}
            >
              {formatCurrency(forecast.expectedValue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Probable</p>
            <p
              className={`text-lg font-semibold mt-1 ${getConfidenceColor(
                forecast.probableValue,
                forecast.pipelineValue
              )}`}
            >
              {formatCurrency(forecast.probableValue)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <h3 className="text-lg font-semibold text-white">Pipeline Forecast</h3>
        <p className="text-sm text-blue-100 mt-1">{forecast.dealCount} active deals</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-gray-50">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(forecast.pipelineValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Total if all deals close</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Expected Value</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">
                {formatCurrency(forecast.expectedValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Weighted by stage probability
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Probable Value</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatCurrency(forecast.probableValue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">High-confidence forecast</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Breakdown */}
      <div className="p-6">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Breakdown by Stage</h4>
        <div className="space-y-3">
          {forecast.dealsByStage.map((stage) => {
            const stagePercent = (stage.totalValue / forecast.pipelineValue) * 100;
            return (
              <div key={stage.stage} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-900">{stage.stage}</span>
                    <span className="ml-2 text-xs text-gray-500">
                      ({stage.count} deal{stage.count !== 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(stage.totalValue)}
                    </span>
                    <span className="ml-2 text-xs text-gray-500">
                      {stage.probability}% likely
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(stagePercent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
