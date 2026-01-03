/**
 * Netlify DB Imports Page
 * 
 * This page provides CSV import functionality using Netlify Functions.
 * All data operations go through serverless functions, NOT direct to DB.
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CSVUpload } from '../components/CSVUpload';
import { netlifyApi, type ImportResult } from '../lib/netlify-api';
import { 
  Upload, 
  Database, 
  Building2, 
  Users, 
  Target,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export function NetlifyImports() {
  const queryClient = useQueryClient();
  const [showUploader, setShowUploader] = useState(true);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);

  // Fetch current counts
  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies'],
    queryFn: () => netlifyApi.listCompanies({ limit: 1 }),
  });

  const { data: leadsData, isLoading: loadingLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: () => netlifyApi.listLeads({ limit: 1 }),
  });

  const { data: dealsData, isLoading: loadingDeals } = useQuery({
    queryKey: ['deals'],
    queryFn: () => netlifyApi.listDeals({ limit: 1 }),
  });

  const isLoading = loadingCompanies || loadingLeads || loadingDeals;

  const handleImportComplete = (result: ImportResult) => {
    setLastResult(result);
    // Refresh all data
    queryClient.invalidateQueries();
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            DATA UPLINK
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            NETLIFY DB IMPORT // SERVERLESS DATA TRANSFER
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="cyber-btn px-6 py-3 flex items-center gap-3"
        >
          <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>REFRESH</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-cyan-500/20 border border-cyan-500/30">
              <Building2 className="h-7 w-7 text-cyan-400" />
            </div>
            <div>
              <div className="font-['Orbitron'] text-3xl text-cyan-400">
                {isLoading ? '...' : companiesData?.total || 0}
              </div>
              <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50 tracking-wider">
                COMPANIES
              </div>
            </div>
          </div>
        </div>

        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-purple-500/20 border border-purple-500/30">
              <Users className="h-7 w-7 text-purple-400" />
            </div>
            <div>
              <div className="font-['Orbitron'] text-3xl text-purple-400">
                {isLoading ? '...' : leadsData?.total || 0}
              </div>
              <div className="font-['Share_Tech_Mono'] text-xs text-purple-400/50 tracking-wider">
                LEADS
              </div>
            </div>
          </div>
        </div>

        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-green-500/20 border border-green-500/30">
              <Target className="h-7 w-7 text-green-400" />
            </div>
            <div>
              <div className="font-['Orbitron'] text-3xl text-green-400">
                {isLoading ? '...' : dealsData?.total || 0}
              </div>
              <div className="font-['Share_Tech_Mono'] text-xs text-green-400/50 tracking-wider">
                DEALS
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Last Import Result Banner */}
      {lastResult && (
        <div className="holo-card rounded-lg p-4 border-green-500/30 bg-green-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="font-['Orbitron'] text-sm text-green-400">
                LAST IMPORT: {lastResult.companies_created} companies, {lastResult.leads_created} leads, {lastResult.deals_created} deals
              </span>
              {lastResult.skipped > 0 && (
                <span className="font-['Share_Tech_Mono'] text-xs text-orange-400">
                  ({lastResult.skipped} skipped)
                </span>
              )}
            </div>
            <button
              onClick={() => setLastResult(null)}
              className="text-green-400/50 hover:text-green-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* CSV Uploader */}
      <CSVUpload onComplete={handleImportComplete} />

      {/* Info Panel */}
      <div className="holo-card rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-5 w-5 text-cyan-400" />
          <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">
            HOW IT WORKS
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-['Share_Tech_Mono'] text-sm text-cyan-400/70">
          <div className="space-y-2">
            <div className="text-cyan-400 font-['Orbitron'] text-xs">1. UPLOAD CSV</div>
            <p>Select or drag a CSV file with company data. Supported columns: company name, website, phone, address, ranking, market, category, reviews.</p>
          </div>
          <div className="space-y-2">
            <div className="text-cyan-400 font-['Orbitron'] text-xs">2. SMART PROCESSING</div>
            <p>Each row creates a COMPANY, LEAD, and DEAL linked together. Duplicate companies (same name) are updated, not duplicated.</p>
          </div>
          <div className="space-y-2">
            <div className="text-cyan-400 font-['Orbitron'] text-xs">3. NO DATA LOSS</div>
            <p>Unknown CSV columns are stored in a "meta" field. Your data is preserved even if the column isn't recognized.</p>
          </div>
        </div>
      </div>

      {/* Technical Info */}
      <div className="holo-card rounded-lg p-4 bg-cyan-500/5 border-cyan-500/20">
        <div className="flex items-center gap-2 text-cyan-400/50 font-['Share_Tech_Mono'] text-xs">
          <TrendingUp className="h-4 w-4" />
          <span>
            DATA STORED IN NETLIFY DB (NEON POSTGRES) VIA SERVERLESS FUNCTIONS // 
            FRONTEND HAS NO DATABASE SECRETS // MULTI-USER ISOLATED
          </span>
        </div>
      </div>
    </div>
  );
}

export default NetlifyImports;
