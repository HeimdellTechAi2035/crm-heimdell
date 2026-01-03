/**
 * CSV Upload Component
 * 
 * Provides file upload, preview, and import functionality using Netlify Functions.
 * All database operations go through /.netlify/functions/import_csv
 */

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { netlifyApi, type ImportResult } from '../lib/netlify-api';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Loader2,
  Database,
  Building2,
  Users,
  Target,
  Eye
} from 'lucide-react';

interface CSVUploadProps {
  onComplete?: (result: ImportResult) => void;
  onCancel?: () => void;
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
  rawText: string;
  filename: string;
}

export function CSVUpload({ onComplete, onCancel }: CSVUploadProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (csv: ParsedCSV) => {
      return netlifyApi.importCSV(csv.rawText, csv.filename);
    },
    onSuccess: (data) => {
      setResult(data);
      setStep('complete');
      // Invalidate all data queries
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      onComplete?.(data);
    },
    onError: (err: Error) => {
      setError(err.message);
      setStep('preview');
    },
  });

  // Parse CSV text
  const parseCSVText = useCallback((text: string, filename: string) => {
    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row');
      }

      // Parse header
      const headers = parseCSVRow(lines[0]);
      
      // Parse data rows (first 10 for preview)
      const rows: string[][] = [];
      for (let i = 1; i < Math.min(lines.length, 11); i++) {
        rows.push(parseCSVRow(lines[i]));
      }

      setParsedCSV({ headers, rows, rawText: text, filename });
      setStep('preview');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    }
  }, []);

  // Parse a single CSV row (handle quoted fields)
  const parseCSVRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  // Handle file selection
  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|txt)$/i)) {
      setError('Please select a CSV or TXT file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      parseCSVText(text, file.name);
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  }, [parseCSVText]);

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile]);

  // Start import
  const handleImport = () => {
    if (parsedCSV) {
      setError(null);
      setStep('importing');
      importMutation.mutate(parsedCSV);
    }
  };

  // Reset to start
  const handleReset = () => {
    setStep('upload');
    setParsedCSV(null);
    setResult(null);
    setError(null);
  };

  // Get row count from raw text
  const getTotalRowCount = () => {
    if (!parsedCSV) return 0;
    return parsedCSV.rawText.split(/\r?\n/).filter(line => line.trim()).length - 1;
  };

  return (
    <div className="holo-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-cyan-500/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-cyan-400" />
          <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">
            {step === 'upload' && 'SELECT DATA FILE'}
            {step === 'preview' && 'PREVIEW IMPORT'}
            {step === 'importing' && 'IMPORTING DATA'}
            {step === 'complete' && 'IMPORT COMPLETE'}
          </span>
        </div>
        {onCancel && step !== 'importing' && (
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-cyan-500/10 rounded transition-colors"
          >
            <X className="h-4 w-4 text-cyan-400/50 hover:text-cyan-400" />
          </button>
        )}
      </div>

      <div className="p-6">
        {/* Upload Step */}
        {step === 'upload' && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer
              ${dragActive 
                ? 'border-cyan-400 bg-cyan-500/10' 
                : 'border-cyan-500/30 hover:border-cyan-400/50 hover:bg-cyan-500/5'
              }`}
          >
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileInput}
              className="hidden"
              id="csv-file-upload"
            />
            <label htmlFor="csv-file-upload" className="cursor-pointer">
              <div className="space-y-4">
                <div className="w-20 h-20 mx-auto rounded-lg flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30">
                  <FileSpreadsheet className="h-10 w-10 text-cyan-400" />
                </div>
                <div>
                  <div className="font-['Orbitron'] text-lg text-cyan-400">
                    DROP CSV FILE HERE
                  </div>
                  <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50 mt-1">
                    OR CLICK TO SELECT // SUPPORTS CSV, TXT
                  </div>
                </div>
              </div>
            </label>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && parsedCSV && (
          <div className="space-y-6">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                <div>
                  <div className="font-['Orbitron'] text-sm text-cyan-400">
                    {parsedCSV.filename}
                  </div>
                  <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
                    {getTotalRowCount()} RECORDS // {parsedCSV.headers.length} COLUMNS
                  </div>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="text-xs text-cyan-400/50 hover:text-cyan-400 font-['Share_Tech_Mono']"
              >
                CHANGE FILE
              </button>
            </div>

            {/* Column detection info */}
            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <div className="flex items-center gap-2 text-purple-400 text-sm font-['Orbitron'] mb-2">
                <Eye className="h-4 w-4" />
                DETECTED COLUMNS
              </div>
              <div className="flex flex-wrap gap-2">
                {parsedCSV.headers.map((header, i) => (
                  <span 
                    key={i}
                    className="px-2 py-1 bg-purple-500/20 rounded text-xs font-['Share_Tech_Mono'] text-purple-300"
                  >
                    {header}
                  </span>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto">
              <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50 mb-2">
                PREVIEW (FIRST 10 ROWS)
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cyan-500/20">
                    {parsedCSV.headers.slice(0, 6).map((header, i) => (
                      <th 
                        key={i} 
                        className="text-left p-2 font-['Orbitron'] text-xs text-cyan-400"
                      >
                        {header.substring(0, 15)}{header.length > 15 ? '...' : ''}
                      </th>
                    ))}
                    {parsedCSV.headers.length > 6 && (
                      <th className="text-left p-2 font-['Orbitron'] text-xs text-cyan-400/50">
                        +{parsedCSV.headers.length - 6} more
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsedCSV.rows.map((row, i) => (
                    <tr key={i} className="border-b border-cyan-500/10">
                      {row.slice(0, 6).map((cell, j) => (
                        <td 
                          key={j} 
                          className="p-2 font-['Rajdhani'] text-white/80 max-w-[150px] truncate"
                        >
                          {cell || <span className="text-cyan-400/30">—</span>}
                        </td>
                      ))}
                      {parsedCSV.headers.length > 6 && (
                        <td className="p-2 text-cyan-400/30">...</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Import info */}
            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="font-['Orbitron'] text-sm text-green-400 mb-2">
                IMPORT WILL CREATE:
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <Building2 className="h-6 w-6 mx-auto text-green-400 mb-1" />
                  <div className="font-['Share_Tech_Mono'] text-xs text-green-400/70">COMPANIES</div>
                </div>
                <div>
                  <Users className="h-6 w-6 mx-auto text-green-400 mb-1" />
                  <div className="font-['Share_Tech_Mono'] text-xs text-green-400/70">LEADS</div>
                </div>
                <div>
                  <Target className="h-6 w-6 mx-auto text-green-400 mb-1" />
                  <div className="font-['Share_Tech_Mono'] text-xs text-green-400/70">DEALS</div>
                </div>
              </div>
              <div className="font-['Share_Tech_Mono'] text-xs text-green-400/50 text-center mt-3">
                DUPLICATES WILL BE UPDATED // NO DATA LOSS
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="font-['Share_Tech_Mono'] text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 rounded border border-cyan-500/30 text-cyan-400 font-['Orbitron'] text-sm hover:bg-cyan-500/10 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleImport}
                className="flex-1 cyber-btn py-3"
              >
                <Upload className="h-4 w-4 mr-2 inline" />
                IMPORT {getTotalRowCount()} RECORDS
              </button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="text-center py-12">
            <Loader2 className="h-16 w-16 mx-auto text-cyan-400 animate-spin mb-6" />
            <div className="font-['Orbitron'] text-xl text-cyan-400 mb-2">
              IMPORTING DATA
            </div>
            <div className="font-['Share_Tech_Mono'] text-sm text-cyan-400/50">
              PROCESSING {getTotalRowCount()} RECORDS...
            </div>
            <div className="mt-4 h-2 bg-cyan-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-cyan-400 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && result && (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-400 mb-4" />
              <div className="font-['Orbitron'] text-xl text-green-400 mb-2">
                IMPORT SUCCESSFUL
              </div>
            </div>

            {/* Results grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-center">
                <div className="font-['Orbitron'] text-3xl text-cyan-400">
                  {result.companies_created}
                </div>
                <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
                  COMPANIES CREATED
                </div>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20 text-center">
                <div className="font-['Orbitron'] text-3xl text-purple-400">
                  {result.companies_updated}
                </div>
                <div className="font-['Share_Tech_Mono'] text-xs text-purple-400/50">
                  COMPANIES UPDATED
                </div>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20 text-center">
                <div className="font-['Orbitron'] text-3xl text-green-400">
                  {result.leads_created}
                </div>
                <div className="font-['Share_Tech_Mono'] text-xs text-green-400/50">
                  LEADS CREATED
                </div>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20 text-center">
                <div className="font-['Orbitron'] text-3xl text-yellow-400">
                  {result.deals_created}
                </div>
                <div className="font-['Share_Tech_Mono'] text-xs text-yellow-400/50">
                  DEALS CREATED
                </div>
              </div>
            </div>

            {/* Skipped/Errors */}
            {(result.skipped > 0 || result.errors.length > 0) && (
              <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <div className="flex items-center gap-2 text-orange-400 font-['Orbitron'] text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  {result.skipped} ROWS SKIPPED
                </div>
                {result.errors.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <div key={i} className="font-['Share_Tech_Mono'] text-xs text-orange-400/70">
                        {err}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="font-['Share_Tech_Mono'] text-xs text-orange-400/50">
                        +{result.errors.length - 10} more errors
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Done button */}
            <button
              onClick={handleReset}
              className="w-full cyber-btn py-3"
            >
              IMPORT MORE DATA
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CSVUpload;
