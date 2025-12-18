import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface EmailIdentity {
  id: string;
  fromName: string;
  fromEmail: string;
  warmupState: 'new' | 'warming' | 'stable' | 'restricted';
  dailySendLimit: number;
  currentDailySent: number;
  perMinuteLimit: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

interface CanSendResponse {
  allowed: boolean;
  reason?: string;
  identity: EmailIdentity;
}

interface DeliverabilityWarningsProps {
  emailIdentityId: string;
  compact?: boolean;
}

export function DeliverabilityWarnings({
  emailIdentityId,
  compact = false,
}: DeliverabilityWarningsProps) {
  const [canSendData, setCanSendData] = useState<CanSendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkCanSend = async () => {
      try {
        setLoading(true);
        const response = await api.post(`/api/email-identities/${emailIdentityId}/can-send`);
        setCanSendData(response.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to check send status');
      } finally {
        setLoading(false);
      }
    };

    checkCanSend();
    // Refresh every 60 seconds
    const interval = setInterval(checkCanSend, 60000);
    return () => clearInterval(interval);
  }, [emailIdentityId]);

  if (loading) {
    return (
      <div className="flex items-center text-sm text-gray-600">
        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full mr-2"></div>
        Checking deliverability...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center text-sm text-red-600">
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        {error}
      </div>
    );
  }

  if (!canSendData) {
    return null;
  }

  const { allowed, reason, identity } = canSendData;
  const percentUsed = (identity.currentDailySent / identity.dailySendLimit) * 100;

  const getWarmupColor = (state: string) => {
    switch (state) {
      case 'new':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'warming':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'stable':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'restricted':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getWarmupLabel = (state: string) => {
    switch (state) {
      case 'new':
        return 'New Identity';
      case 'warming':
        return 'Warming Up';
      case 'stable':
        return 'Stable';
      case 'restricted':
        return 'Restricted';
      default:
        return state;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <span
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getWarmupColor(
            identity.warmupState
          )}`}
        >
          {getWarmupLabel(identity.warmupState)}
        </span>
        
        <span className="text-xs text-gray-600">
          {identity.currentDailySent} / {identity.dailySendLimit} sent today
        </span>
        
        {!allowed && (
          <span className="inline-flex items-center text-xs text-red-600">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Cannot send
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Email Deliverability Status</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {identity.fromName} &lt;{identity.fromEmail}&gt;
          </p>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getWarmupColor(
            identity.warmupState
          )}`}
        >
          {getWarmupLabel(identity.warmupState)}
        </span>
      </div>

      {/* Send Limit Progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-700">Daily Send Limit</span>
          <span className="font-medium text-gray-900">
            {identity.currentDailySent} / {identity.dailySendLimit}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              percentUsed >= 90
                ? 'bg-red-500'
                : percentUsed >= 70
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
        {percentUsed >= 90 && (
          <p className="text-xs text-red-600 mt-1">⚠️ Approaching daily limit</p>
        )}
      </div>

      {/* Rate Limit */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700">Rate Limit</span>
        <span className="text-gray-900">{identity.perMinuteLimit} per minute</span>
      </div>

      {/* Quiet Hours */}
      {identity.quietHoursStart && identity.quietHoursEnd && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700">Quiet Hours</span>
          <span className="text-gray-900">
            {identity.quietHoursStart} - {identity.quietHoursEnd}{' '}
            {identity.timezone && `(${identity.timezone})`}
          </span>
        </div>
      )}

      {/* Status Message */}
      {!allowed && reason && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Cannot send emails</p>
              <p className="text-xs text-red-700 mt-1">{reason}</p>
            </div>
          </div>
        </div>
      )}

      {allowed && (
        <div className="bg-green-50 border border-green-200 rounded-md p-3">
          <div className="flex">
            <svg
              className="h-5 w-5 text-green-400 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-medium text-green-800">Ready to send</p>
          </div>
        </div>
      )}
    </div>
  );
}
