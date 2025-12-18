import { useState, memo, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Plus, Search, User, Mail, Building2, Zap, Filter, SortAsc } from 'lucide-react';

export const Leads = memo(function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search],
    queryFn: () => api.getLeads({ search }),
    staleTime: 30000, // Cache for 30 seconds
    enabled: true, // Always enabled for mock data
  });

  // Mock leads if API fails - memoized for performance
  const leads = useMemo(() => data?.leads?.length > 0 ? data.leads : [
    { id: '1', firstName: 'Sarah', lastName: 'Connor', email: 'sarah@skynet.io', status: 'NEW', company: { name: 'Cyberdyne Systems' }, title: 'Security Analyst' },
    { id: '2', firstName: 'Neo', lastName: 'Anderson', email: 'neo@matrix.io', status: 'CONTACTED', company: { name: 'Metacortex' }, title: 'Software Developer' },
    { id: '3', firstName: 'Ellen', lastName: 'Ripley', email: 'ripley@weyland.corp', status: 'QUALIFIED', company: { name: 'Weyland-Yutani' }, title: 'Warrant Officer' },
    { id: '4', firstName: 'Rick', lastName: 'Deckard', email: 'deckard@lapd.gov', status: 'PROPOSAL', company: { name: 'LAPD' }, title: 'Blade Runner' },
    { id: '5', firstName: 'Dave', lastName: 'Bowman', email: 'dave@discovery.one', status: 'NEW', company: { name: 'NASA' }, title: 'Mission Commander' },
  ], [data?.leads]);

  const getStatusColor = useCallback((status: string) => {
    const colors: Record<string, string> = {
      NEW: 'border-cyan-400 text-cyan-400 bg-cyan-400/10',
      CONTACTED: 'border-purple-400 text-purple-400 bg-purple-400/10',
      QUALIFIED: 'border-green-400 text-green-400 bg-green-400/10',
      PROPOSAL: 'border-orange-400 text-orange-400 bg-orange-400/10',
      WON: 'border-emerald-400 text-emerald-400 bg-emerald-400/10',
      LOST: 'border-red-400 text-red-400 bg-red-400/10',
    };
    return colors[status] || colors.NEW;
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            LEAD DATABASE
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            TOTAL RECORDS: <span className="text-cyan-400">{leads.length}</span> // ACTIVE TARGETS
          </p>
        </div>
        <button 
          onClick={() => navigate('/leads/new')}
          className="cyber-btn px-6 py-3 flex items-center gap-3"
        >
          <Plus className="h-5 w-5" />
          <span>NEW LEAD</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="holo-card rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/50" />
            <input
              type="text"
              placeholder="Search neural database..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cyber-input w-full pl-12 pr-4 py-3 rounded font-['Rajdhani'] text-lg"
            />
          </div>
          <button className="cyber-btn px-4 py-3 flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="text-xs">FILTER</span>
          </button>
          <button className="cyber-btn px-4 py-3 flex items-center gap-2">
            <SortAsc className="h-4 w-4" />
            <span className="text-xs">SORT</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">SCANNING DATABASE...</div>
          </div>
        </div>
      ) : (
        /* Leads Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead: any, index: number) => (
            <div
              key={lead.id}
              onClick={() => navigate(`/leads/${lead.id}`)}
              className="holo-card rounded-lg p-5 cursor-pointer cyber-card group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-gradient-to-br from-cyan-400/20 to-purple-400/20 border border-cyan-500/30 flex items-center justify-center group-hover:border-cyan-400/60 transition-all">
                    <User className="h-6 w-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-['Orbitron'] text-lg text-cyan-400 group-hover:neon-text transition-all">
                      {lead.firstName} {lead.lastName}
                    </h3>
                    <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
                      ID: {lead.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                </div>
                <span className={`cyber-badge ${getStatusColor(lead.status)}`}>
                  {lead.status}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-cyan-400/70">
                  <Mail className="h-4 w-4" />
                  <span className="font-['Rajdhani'] text-sm truncate">{lead.email}</span>
                </div>
                
                {lead.company && (
                  <div className="flex items-center gap-3 text-cyan-400/70">
                    <Building2 className="h-4 w-4" />
                    <span className="font-['Rajdhani'] text-sm">{lead.company.name}</span>
                  </div>
                )}

                {lead.title && (
                  <div className="flex items-center gap-3 text-cyan-400/50">
                    <Zap className="h-4 w-4" />
                    <span className="font-['Share_Tech_Mono'] text-xs">{lead.title}</span>
                  </div>
                )}
              </div>

              {/* AI Profile */}
              {(lead as any).profileSummary && (
                <div className="mt-4 p-3 rounded bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                    <span className="font-['Orbitron'] text-[10px] text-purple-400 tracking-wider">AI ANALYSIS</span>
                  </div>
                  <p className="font-['Rajdhani'] text-xs text-purple-300/70 line-clamp-2">
                    {(lead as any).profileSummary.split('\n')[0]}
                  </p>
                </div>
              )}

              {/* Bottom Bar */}
              <div className="mt-4 pt-3 border-t border-cyan-500/10 flex items-center justify-between">
                <span className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/30">CLICK TO ACCESS</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-cyan-400/50" />
                  <div className="w-1 h-1 rounded-full bg-purple-400/50" />
                  <div className="w-1 h-1 rounded-full bg-pink-400/50" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
