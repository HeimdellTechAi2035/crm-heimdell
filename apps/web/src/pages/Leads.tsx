import { useState, memo, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Plus, Search, User, Mail, Globe, Phone, Filter, ArrowRight } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  NEW:            'border-cyan-400 text-cyan-400 bg-cyan-400/10',
  CONTACTED_1:    'border-blue-400 text-blue-400 bg-blue-400/10',
  WAITING_D2:     'border-yellow-400 text-yellow-400 bg-yellow-400/10',
  CALL_DUE:       'border-orange-400 text-orange-400 bg-orange-400/10',
  CALLED:         'border-purple-400 text-purple-400 bg-purple-400/10',
  WAITING_D1:     'border-yellow-400 text-yellow-400 bg-yellow-400/10',
  CONTACTED_2:    'border-indigo-400 text-indigo-400 bg-indigo-400/10',
  WA_VOICE_DUE:   'border-green-400 text-green-400 bg-green-400/10',
  REPLIED:        'border-emerald-400 text-emerald-400 bg-emerald-400/10',
  QUALIFIED:      'border-green-500 text-green-500 bg-green-500/10',
  NOT_INTERESTED: 'border-red-400 text-red-400 bg-red-400/10',
  COMPLETED:      'border-gray-400 text-gray-400 bg-gray-400/10',
};

export const Leads = memo(function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const params: Record<string, string> = {};
  if (search) params.search = search;
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => api.getLeads(Object.keys(params).length ? params : undefined),
    staleTime: 15000,
  });

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const total = data?.total ?? leads.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            LEAD DATABASE
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            TOTAL: <span className="text-cyan-400">{total}</span> RECORDS
          </p>
        </div>
        <button className="cyber-btn px-5 py-3 flex items-center gap-2">
          <Plus className="h-4 w-4" />
          <span>NEW LEAD</span>
        </button>
      </div>

      {/* Search + Filter */}
      <div className="holo-card rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-400/50" />
            <input
              type="text"
              placeholder="Search company, contact, website..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cyber-input w-full pl-10 pr-4 py-2.5 rounded font-['Rajdhani'] text-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cyber-input px-3 py-2.5 rounded text-xs font-['Share_Tech_Mono']"
          >
            <option value="">ALL STATUS</option>
            {Object.keys(STATUS_COLORS).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-3" />
            <div className="font-['Orbitron'] text-cyan-400 text-xs tracking-widest">SCANNING...</div>
          </div>
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-cyan-400/30 font-['Share_Tech_Mono'] text-sm">
          No leads found. Import from Google Sheets or create one manually.
        </div>
      ) : (
        /* Leads Grid */
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead: any, i: number) => (
            <div
              key={lead.id}
              onClick={() => navigate(`/leads/${lead.id}`)}
              className="holo-card rounded-lg p-4 cursor-pointer group hover:border-cyan-400/40 transition-all"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded bg-gradient-to-br from-cyan-400/20 to-purple-400/20 border border-cyan-500/30 flex items-center justify-center">
                    <User className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-['Orbitron'] text-sm text-cyan-400 truncate group-hover:neon-text">
                      {lead.company}
                    </h3>
                    <span className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50 truncate block">
                      {lead.keyDecisionMaker} {lead.role ? `· ${lead.role}` : ''}
                    </span>
                  </div>
                </div>
                <span className={`cyber-badge text-[9px] px-2 py-0.5 shrink-0 ${STATUS_COLORS[lead.status] ?? STATUS_COLORS.NEW}`}>
                  {lead.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                {lead.emails?.[0] && (
                  <div className="flex items-center gap-2 text-cyan-400/60">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="font-['Rajdhani'] truncate">{lead.emails[0]}</span>
                  </div>
                )}
                {lead.website && (
                  <div className="flex items-center gap-2 text-cyan-400/60">
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="font-['Rajdhani'] truncate">{lead.website}</span>
                  </div>
                )}
                {lead.number && (
                  <div className="flex items-center gap-2 text-cyan-400/60">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="font-['Rajdhani']">{lead.number}</span>
                  </div>
                )}
              </div>

              {lead.nextAction && (
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-['Share_Tech_Mono'] text-orange-400/70">
                  <ArrowRight className="h-3 w-3" />
                  <span className="truncate">{lead.nextAction}</span>
                </div>
              )}

              <div className="mt-3 pt-2 border-t border-cyan-500/10 flex items-center justify-between">
                <span className="font-['Share_Tech_Mono'] text-[9px] text-cyan-400/20">CLICK TO OPEN</span>
                <div className="flex gap-1">
                  {lead.emailSent1 && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" title="Email 1" />}
                  {lead.callDone && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" title="Called" />}
                  {lead.repliedAtUtc && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Replied" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
