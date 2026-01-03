/**
 * Admin Panel Page
 * 
 * Only accessible to admin users (andrew@heimdell.tech).
 * Shows admin-only features and system controls.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import { runIntegrityAudit, AuditReport, printAuditReport } from '@/lib/data-integrity-audit';
import { Shield, Users, Database, Settings, AlertTriangle, CheckCircle, XCircle, RefreshCw, Bug } from 'lucide-react';

export function AdminPage() {
  const navigate = useNavigate();
  const { isAdmin, isLoading, user } = useAuth();
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  const handleRunAudit = () => {
    setIsAuditing(true);
    setTimeout(() => {
      const report = runIntegrityAudit();
      setAuditReport(report);
      printAuditReport(report); // Also print to console
      setIsAuditing(false);
    }, 100);
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-cyan-400 font-['Share_Tech_Mono']">
          VERIFYING ACCESS...
        </div>
      </div>
    );
  }

  // Don't render for non-admin (redirect will happen)
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Shield className="h-10 w-10 text-yellow-400 glow-icon" />
          <div className="absolute inset-0 h-10 w-10 bg-yellow-400/20 blur-lg animate-pulse" />
        </div>
        <div>
          <h1 className="text-2xl font-['Orbitron'] font-bold text-yellow-400 neon-text tracking-wider">
            ADMIN PANEL
          </h1>
          <p className="text-yellow-400/60 font-['Share_Tech_Mono'] text-xs tracking-wider">
            SYSTEM ADMINISTRATOR: {user?.email}
          </p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="holo-card rounded-lg p-4 border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400" />
          <p className="text-yellow-400/80 font-['Share_Tech_Mono'] text-sm">
            Admin actions affect all system data. Proceed with caution.
          </p>
        </div>
      </div>

      {/* Data Integrity Audit Section */}
      <div className="holo-card rounded-lg p-6 border-purple-500/30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bug className="h-6 w-6 text-purple-400" />
            <h2 className="font-['Orbitron'] text-lg text-purple-400">
              DATA INTEGRITY AUDIT
            </h2>
          </div>
          <button
            onClick={handleRunAudit}
            disabled={isAuditing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded text-purple-400 hover:bg-purple-500/30 transition-all font-['Share_Tech_Mono'] text-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isAuditing ? 'animate-spin' : ''}`} />
            {isAuditing ? 'SCANNING...' : 'RUN INTEGRITY AUDIT'}
          </button>
        </div>

        {auditReport && (
          <div className="space-y-6">
            {/* Summary */}
            <div className={`p-4 rounded-lg ${auditReport.passed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex items-center gap-3">
                {auditReport.passed ? (
                  <CheckCircle className="h-6 w-6 text-green-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-400" />
                )}
                <div>
                  <div className={`font-['Orbitron'] text-lg ${auditReport.passed ? 'text-green-400' : 'text-red-400'}`}>
                    {auditReport.passed ? 'AUDIT PASSED' : 'AUDIT FAILED'}
                  </div>
                  <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60">
                    {auditReport.totalViolations} violations found
                  </div>
                </div>
              </div>
            </div>

            {/* Counts Table */}
            <div className="grid grid-cols-3 gap-4">
              <div className="data-panel rounded p-4 text-center">
                <div className="text-3xl font-['Orbitron'] text-cyan-400">{auditReport.companyCount}</div>
                <div className="text-xs font-['Share_Tech_Mono'] text-cyan-400/60">COMPANIES</div>
              </div>
              <div className="data-panel rounded p-4 text-center">
                <div className="text-3xl font-['Orbitron'] text-cyan-400">{auditReport.leadCount}</div>
                <div className="text-xs font-['Share_Tech_Mono'] text-cyan-400/60">LEADS</div>
              </div>
              <div className="data-panel rounded p-4 text-center">
                <div className="text-3xl font-['Orbitron'] text-cyan-400">{auditReport.dealCount}</div>
                <div className="text-xs font-['Share_Tech_Mono'] text-cyan-400/60">DEALS</div>
              </div>
            </div>

            {/* Violation Summary */}
            <div className="overflow-x-auto">
              <table className="w-full font-['Share_Tech_Mono'] text-xs">
                <thead>
                  <tr className="border-b border-cyan-500/20">
                    <th className="text-left py-2 text-cyan-400/60">CHECK</th>
                    <th className="text-right py-2 text-cyan-400/60">COUNT</th>
                    <th className="text-right py-2 text-cyan-400/60">STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-cyan-500/10">
                    <td className="py-2 text-cyan-400">Orphan Leads</td>
                    <td className="py-2 text-right text-cyan-400">{auditReport.orphanLeads.length}</td>
                    <td className="py-2 text-right">
                      {auditReport.orphanLeads.length === 0 ? (
                        <span className="text-green-400">✓ PASS</span>
                      ) : (
                        <span className="text-red-400">✗ FAIL</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-cyan-500/10">
                    <td className="py-2 text-cyan-400">Orphan Deals</td>
                    <td className="py-2 text-right text-cyan-400">{auditReport.orphanDeals.length}</td>
                    <td className="py-2 text-right">
                      {auditReport.orphanDeals.filter(v => v.severity === 'error').length === 0 ? (
                        <span className="text-green-400">✓ PASS</span>
                      ) : (
                        <span className="text-red-400">✗ FAIL</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-cyan-500/10">
                    <td className="py-2 text-cyan-400">Duplicate Companies</td>
                    <td className="py-2 text-right text-cyan-400">{auditReport.duplicateCompanies.length}</td>
                    <td className="py-2 text-right">
                      {auditReport.duplicateCompanies.length === 0 ? (
                        <span className="text-green-400">✓ PASS</span>
                      ) : (
                        <span className="text-red-400">✗ FAIL</span>
                      )}
                    </td>
                  </tr>
                  <tr className="border-b border-cyan-500/10">
                    <td className="py-2 text-cyan-400">Broken Links</td>
                    <td className="py-2 text-right text-cyan-400">{auditReport.brokenLinks.length}</td>
                    <td className="py-2 text-right">
                      {auditReport.brokenLinks.filter(v => v.severity === 'error').length === 0 ? (
                        <span className="text-green-400">✓ PASS</span>
                      ) : (
                        <span className="text-red-400">✗ FAIL</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-cyan-400">Missing Fields</td>
                    <td className="py-2 text-right text-cyan-400">{auditReport.missingFields.length}</td>
                    <td className="py-2 text-right">
                      {auditReport.missingFields.length === 0 ? (
                        <span className="text-green-400">✓ PASS</span>
                      ) : (
                        <span className="text-yellow-400">⚠ WARN</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-['Share_Tech_Mono'] text-xs">
              <div className="data-panel rounded p-3">
                <div className="text-cyan-400/50">COMPANIES W/ MULTI LEADS</div>
                <div className="text-cyan-400">{auditReport.stats.companiesWithMultipleLeads}</div>
              </div>
              <div className="data-panel rounded p-3">
                <div className="text-cyan-400/50">COMPANIES W/ MULTI DEALS</div>
                <div className="text-cyan-400">{auditReport.stats.companiesWithMultipleDeals}</div>
              </div>
              <div className="data-panel rounded p-3">
                <div className="text-cyan-400/50">LEADS WITHOUT DEALS</div>
                <div className="text-cyan-400">{auditReport.stats.leadsWithoutDeals}</div>
              </div>
              <div className="data-panel rounded p-3">
                <div className="text-cyan-400/50">DEALS WITHOUT LEADS</div>
                <div className="text-cyan-400">{auditReport.stats.dealsWithoutLeads}</div>
              </div>
              <div className="data-panel rounded p-3">
                <div className="text-cyan-400/50">RECORDS W/ BATCH ID</div>
                <div className="text-cyan-400">{auditReport.stats.recordsWithImportBatchId}</div>
              </div>
              <div className="data-panel rounded p-3">
                <div className="text-cyan-400/50">RECORDS W/ SOURCE</div>
                <div className="text-cyan-400">{auditReport.stats.recordsWithSource}</div>
              </div>
            </div>

            {/* Detailed Violations (if any) */}
            {auditReport.totalViolations > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-['Orbitron'] text-red-400">VIOLATIONS DETAIL</div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {[
                    ...auditReport.orphanLeads,
                    ...auditReport.orphanDeals,
                    ...auditReport.duplicateCompanies,
                    ...auditReport.brokenLinks,
                    ...auditReport.missingFields,
                  ].slice(0, 20).map((v, i) => (
                    <div key={i} className={`p-2 rounded text-xs font-['Share_Tech_Mono'] ${v.severity === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                      <span className="font-bold">[{v.type}]</span> {v.entityName} ({v.entityId.substring(0, 20)}...)
                      <div className="text-[10px] opacity-70 mt-1">{v.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!auditReport && (
          <p className="text-cyan-400/60 font-['Rajdhani'] text-sm">
            Click "Run Integrity Audit" to scan for data consistency issues like orphan records,
            duplicate companies, and broken relationships between Leads, Companies, and Deals.
          </p>
        )}
      </div>

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* User Management Card */}
        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-6 w-6 text-cyan-400" />
            <h2 className="font-['Orbitron'] text-lg text-cyan-400">
              USER MANAGEMENT
            </h2>
          </div>
          <p className="text-cyan-400/60 font-['Rajdhani'] text-sm mb-4">
            Manage user accounts, permissions, and access controls.
          </p>
          <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
            STATUS: FEATURE PLANNED
          </div>
        </div>

        {/* Database Management Card */}
        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-cyan-400" />
            <h2 className="font-['Orbitron'] text-lg text-cyan-400">
              DATA MANAGEMENT
            </h2>
          </div>
          <p className="text-cyan-400/60 font-['Rajdhani'] text-sm mb-4">
            View system statistics, export data, and manage backups.
          </p>
          <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
            STATUS: FEATURE PLANNED
          </div>
        </div>

        {/* System Settings Card */}
        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Settings className="h-6 w-6 text-cyan-400" />
            <h2 className="font-['Orbitron'] text-lg text-cyan-400">
              SYSTEM SETTINGS
            </h2>
          </div>
          <p className="text-cyan-400/60 font-['Rajdhani'] text-sm mb-4">
            Configure system-wide settings and preferences.
          </p>
          <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
            STATUS: FEATURE PLANNED
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="holo-card rounded-lg p-6">
        <h2 className="font-['Orbitron'] text-lg text-cyan-400 mb-4">
          SYSTEM INFORMATION
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-['Share_Tech_Mono'] text-xs">
          <div className="data-panel rounded p-3">
            <div className="text-cyan-400/50">VERSION</div>
            <div className="text-cyan-400">v3.0.0</div>
          </div>
          <div className="data-panel rounded p-3">
            <div className="text-cyan-400/50">AUTH PROVIDER</div>
            <div className="text-cyan-400">SUPABASE</div>
          </div>
          <div className="data-panel rounded p-3">
            <div className="text-cyan-400/50">STORAGE</div>
            <div className="text-cyan-400">LOCAL</div>
          </div>
          <div className="data-panel rounded p-3">
            <div className="text-cyan-400/50">ENVIRONMENT</div>
            <div className="text-green-400">PRODUCTION</div>
          </div>
        </div>
      </div>
    </div>
  );
}
