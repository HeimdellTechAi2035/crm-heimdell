import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  ArrowRight,
  Clock,
  Phone,
  Mail,
  MessageCircle,
  CheckCircle,
  AlertTriangle,
  Filter,
  RefreshCw,
  Zap,
} from 'lucide-react';

// ─── Status Config ──────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  NEW:            { label: 'NEW',           color: 'text-cyan-400',    bgColor: 'bg-cyan-400/10 border-cyan-400/30',    icon: Zap },
  CONTACTED_1:    { label: 'CONTACTED 1',   color: 'text-blue-400',    bgColor: 'bg-blue-400/10 border-blue-400/30',    icon: Mail },
  WAITING_D2:     { label: 'WAIT +2D',      color: 'text-yellow-400',  bgColor: 'bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  CALL_DUE:       { label: 'CALL DUE',      color: 'text-orange-400',  bgColor: 'bg-orange-400/10 border-orange-400/30', icon: Phone },
  CALLED:         { label: 'CALLED',         color: 'text-purple-400',  bgColor: 'bg-purple-400/10 border-purple-400/30', icon: Phone },
  WAITING_D1:     { label: 'WAIT +1D',      color: 'text-yellow-400',  bgColor: 'bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  CONTACTED_2:    { label: 'CONTACTED 2',   color: 'text-indigo-400',  bgColor: 'bg-indigo-400/10 border-indigo-400/30', icon: Mail },
  WA_VOICE_DUE:   { label: 'WA VOICE',     color: 'text-green-400',   bgColor: 'bg-green-400/10 border-green-400/30',   icon: MessageCircle },
  REPLIED:        { label: 'REPLIED',        color: 'text-emerald-400', bgColor: 'bg-emerald-400/10 border-emerald-400/30', icon: CheckCircle },
  QUALIFIED:      { label: 'QUALIFIED',      color: 'text-green-500',   bgColor: 'bg-green-500/10 border-green-500/30',   icon: CheckCircle },
  NOT_INTERESTED: { label: 'NOT INTERESTED', color: 'text-red-400',     bgColor: 'bg-red-400/10 border-red-400/30',       icon: AlertTriangle },
  COMPLETED:      { label: 'COMPLETED',      color: 'text-gray-400',    bgColor: 'bg-gray-400/10 border-gray-400/30',     icon: CheckCircle },
};

const KANBAN_COLUMNS = [
  'NEW', 'CONTACTED_1', 'WAITING_D2', 'CALL_DUE', 'CALLED',
  'WAITING_D1', 'CONTACTED_2', 'WA_VOICE_DUE',
];

const TERMINAL_STATUSES = ['REPLIED', 'QUALIFIED', 'NOT_INTERESTED', 'COMPLETED'];

// ─── Component ──────────────────────────────────────────────

export function PipelineKanban() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ['leads', 'all'],
    queryFn: () => api.get('/leads?limit=200'),
  });

  const { data: statsData } = useQuery({
    queryKey: ['leads', 'stats'],
    queryFn: () => api.get('/leads/stats'),
  });

  const { data: dueData } = useQuery({
    queryKey: ['pipeline', 'due'],
    queryFn: () => api.get('/pipeline/due'),
  });

  const leads = leadsData?.leads ?? [];
  const stats = statsData ?? { total: 0, dueNow: 0, byStatus: {} };
  const dueLeads = dueData?.leads ?? [];

  // Group leads by status for Kanban columns
  const columns = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    for (const status of [...KANBAN_COLUMNS, ...TERMINAL_STATUSES]) {
      grouped[status] = [];
    }
    for (const lead of leads) {
      if (grouped[lead.status]) {
        grouped[lead.status].push(lead);
      }
    }
    return grouped;
  }, [leads]);

  // Due lead IDs for highlighting
  const dueLeadIds = useMemo(() => new Set(dueLeads.map((l: any) => l.id)), [dueLeads]);

  const schedulerTick = useMutation({
    mutationFn: () => api.post('/pipeline/scheduler-tick'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            OUTREACH PIPELINE
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            TOTAL: <span className="text-cyan-400">{stats.total}</span> //
            DUE NOW: <span className={stats.dueNow > 0 ? 'text-orange-400' : 'text-green-400'}>{stats.dueNow}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => schedulerTick.mutate()}
            disabled={schedulerTick.isPending}
            className="cyber-btn px-4 py-2 flex items-center gap-2 text-xs"
          >
            <RefreshCw className={`h-4 w-4 ${schedulerTick.isPending ? 'animate-spin' : ''}`} />
            RUN SCHEDULER
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 lg:grid-cols-6 gap-3">
        {KANBAN_COLUMNS.slice(0, 6).map((status) => {
          const cfg = STATUS_CONFIG[status];
          const count = (stats.byStatus as any)?.[status] ?? 0;
          return (
            <div
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? null : status)}
              className={`holo-card rounded-lg p-3 cursor-pointer transition-all ${
                statusFilter === status ? 'ring-1 ring-cyan-400' : ''
              }`}
            >
              <div className={`text-[10px] font-['Orbitron'] ${cfg.color} tracking-wider`}>
                {cfg.label}
              </div>
              <div className={`text-2xl font-['Orbitron'] font-bold ${cfg.color} mt-1`}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban Board — horizontal scroll */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4" style={{ minWidth: `${KANBAN_COLUMNS.length * 280}px` }}>
          {KANBAN_COLUMNS.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const Icon = cfg.icon;
            const colLeads = columns[status] ?? [];

            if (statusFilter && statusFilter !== status) return null;

            return (
              <div
                key={status}
                className="w-[260px] flex-shrink-0"
              >
                {/* Column Header */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t border-b-2 ${cfg.bgColor}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className={`text-xs font-['Orbitron'] tracking-wider ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className={`ml-auto text-xs font-['Share_Tech_Mono'] ${cfg.color}`}>
                    {colLeads.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto pr-1">
                  {colLeads.length === 0 ? (
                    <div className="text-center py-4 text-cyan-400/20 font-['Share_Tech_Mono'] text-xs">
                      EMPTY
                    </div>
                  ) : (
                    colLeads.map((lead: any) => (
                      <div
                        key={lead.id}
                        onClick={() => navigate(`/leads/${lead.id}`)}
                        className={`holo-card rounded p-3 cursor-pointer hover:border-cyan-400/40 transition-all group ${
                          dueLeadIds.has(lead.id) ? 'ring-1 ring-orange-400/60' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="font-['Rajdhani'] text-sm text-cyan-400 font-semibold truncate max-w-[180px]">
                            {lead.company}
                          </div>
                          {dueLeadIds.has(lead.id) && (
                            <Clock className="h-3 w-3 text-orange-400 flex-shrink-0" />
                          )}
                        </div>
                        <div className="text-xs text-cyan-400/60 font-['Share_Tech_Mono'] mt-1 truncate">
                          {lead.keyDecisionMaker}
                        </div>
                        {lead.nextAction && (
                          <div className="flex items-center gap-1 mt-2">
                            <ArrowRight className="h-3 w-3 text-cyan-400/40" />
                            <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
                              {lead.nextAction}
                            </span>
                          </div>
                        )}
                        {/* Action flag indicators */}
                        <div className="flex gap-1 mt-2">
                          {lead.emailSent1 && <div className="w-2 h-2 rounded-full bg-blue-400" title="Email 1" />}
                          {lead.callDone && <div className="w-2 h-2 rounded-full bg-purple-400" title="Called" />}
                          {lead.emailSent2 && <div className="w-2 h-2 rounded-full bg-indigo-400" title="Email 2" />}
                          {lead.waVoiceSent && <div className="w-2 h-2 rounded-full bg-green-400" title="WA Voice" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal statuses — collapsed section */}
      <div className="holo-card rounded-lg p-4">
        <h2 className="text-sm font-['Orbitron'] text-cyan-400/60 tracking-wider mb-3">
          TERMINAL STATUS
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {TERMINAL_STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const count = (stats.byStatus as any)?.[status] ?? 0;
            return (
              <div key={status} className={`rounded p-3 border ${cfg.bgColor}`}>
                <div className={`text-xs font-['Orbitron'] ${cfg.color}`}>{cfg.label}</div>
                <div className={`text-xl font-bold font-['Orbitron'] ${cfg.color} mt-1`}>{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
