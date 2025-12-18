import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface FieldChange {
  id: string;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: {
    id: string;
    email: string;
    name?: string;
  };
  changeReason?: string;
  notes?: string;
  createdAt: string;
}

interface FieldHistoryTimelineProps {
  entityType: 'lead' | 'deal' | 'company';
  entityId: string;
  fieldName?: string; // If specified, only show history for this field
}

export function FieldHistoryTimeline({
  entityType,
  entityId,
  fieldName,
}: FieldHistoryTimelineProps) {
  const [changes, setChanges] = useState<FieldChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const endpoint = fieldName
          ? `/api/field-history/${entityType}/${entityId}/${fieldName}`
          : `/api/field-history/${entityType}/${entityId}`;
        const response = await api.get(endpoint);
        setChanges(response.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [entityType, entityId, fieldName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
        <span className="ml-3 text-sm text-gray-600">Loading history...</span>
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

  if (changes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm">No changes recorded</p>
      </div>
    );
  }

  const formatValue = (value: string | null) => {
    if (value === null || value === '') return <em className="text-gray-400">empty</em>;
    return <span className="font-medium">{value}</span>;
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {changes.map((change, idx) => (
          <li key={change.id}>
            <div className="relative pb-8">
              {idx !== changes.length - 1 && (
                <span
                  className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex space-x-3">
                <div>
                  <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
                    <svg
                      className="h-4 w-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 font-medium">
                        {change.fieldName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Changed by {change.changedBy.name || change.changedBy.email} •{' '}
                        {new Date(change.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 bg-gray-50 rounded-md p-3 border border-gray-200">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Old Value</p>
                        <p className="text-gray-700">{formatValue(change.oldValue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">New Value</p>
                        <p className="text-gray-900">{formatValue(change.newValue)}</p>
                      </div>
                    </div>
                    
                    {change.changeReason && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Reason</p>
                        <p className="text-sm text-gray-700">{change.changeReason}</p>
                      </div>
                    )}
                    
                    {change.notes && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Notes</p>
                        <p className="text-sm text-gray-600 italic">{change.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
