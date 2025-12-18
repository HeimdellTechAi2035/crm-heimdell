import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Target, Plus, DollarSign, TrendingUp, Clock, User, Building2, ChevronRight, Zap } from 'lucide-react';

interface Deal {
  id: string;
  title: string;
  value: number;
  stage: string;
  probability?: number;
  expectedCloseDate?: string;
  lead?: { firstName: string; lastName: string; };
  company?: { name: string; };
}

const mockDeals: Deal[] = [
  { id: '1', title: 'QUANTUM-DEAL-001', value: 150000, stage: 'QUALIFIED', probability: 30, lead: { firstName: 'Sarah', lastName: 'Connor' }, company: { name: 'Cyberdyne Systems' } },
  { id: '2', title: 'PROJECT-NEXUS', value: 250000, stage: 'PROPOSAL', probability: 50, lead: { firstName: 'Neo', lastName: 'Anderson' }, company: { name: 'Metacortex' } },
  { id: '3', title: 'OPERATION-REPLICANT', value: 500000, stage: 'NEGOTIATION', probability: 70, lead: { firstName: 'Rick', lastName: 'Deckard' }, company: { name: 'Tyrell Corporation' } },
  { id: '4', title: 'INITIATIVE-ALPHA', value: 75000, stage: 'NEW', probability: 10, lead: { firstName: 'Ellen', lastName: 'Ripley' }, company: { name: 'Weyland-Yutani' } },
  { id: '5', title: 'DEAL-OMICRON', value: 320000, stage: 'WON', probability: 100, lead: { firstName: 'Dave', lastName: 'Bowman' }, company: { name: 'NASA' } },
  { id: '6', title: 'VENTURE-PRIME', value: 180000, stage: 'QUALIFIED', probability: 40, lead: { firstName: 'John', lastName: 'Spartan' }, company: { name: 'OCP' } },
];

const stages = [
  { id: 'NEW', label: 'NEW', color: 'cyan' },
  { id: 'QUALIFIED', label: 'QUALIFIED', color: 'blue' },
  { id: 'PROPOSAL', label: 'PROPOSAL', color: 'purple' },
  { id: 'NEGOTIATION', label: 'NEGOTIATION', color: 'orange' },
  { id: 'WON', label: 'WON', color: 'green' },
  { id: 'LOST', label: 'LOST', color: 'red' },
];

export function Deals() {
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      try {
        return await api.get('/deals');
      } catch (e) {
        return { deals: mockDeals };
      }
    },
    retry: false,
  });

  const deals = data?.deals || mockDeals;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stageId: string) => {
    const stage = stages.find(s => s.id === stageId);
    const colors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
      cyan: { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400', glow: 'shadow-[0_0_20px_rgba(0,255,255,0.2)]' },
      blue: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.2)]' },
      purple: { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.2)]' },
      orange: { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.2)]' },
      green: { border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-green-400', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.2)]' },
      red: { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.2)]' },
    };
    return colors[stage?.color || 'cyan'];
  };

  const totalValue = deals.reduce((sum: number, d: Deal) => sum + d.value, 0);
  const wonValue = deals.filter((d: Deal) => d.stage === 'WON').reduce((sum: number, d: Deal) => sum + d.value, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            DEAL PIPELINE
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            ACTIVE NEGOTIATIONS: <span className="text-cyan-400">{deals.length}</span> // VALUE TRACKING
          </p>
        </div>
        <button className="cyber-btn px-6 py-3 flex items-center gap-3">
          <Plus className="h-5 w-5" />
          <span>NEW DEAL</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'PIPELINE VALUE', value: formatCurrency(totalValue), icon: DollarSign, color: 'cyan' },
          { label: 'WON VALUE', value: formatCurrency(wonValue), icon: TrendingUp, color: 'green' },
          { label: 'ACTIVE DEALS', value: deals.filter((d: Deal) => !['WON', 'LOST'].includes(d.stage)).length, icon: Target, color: 'purple' },
          { label: 'WIN RATE', value: `${Math.round((deals.filter((d: Deal) => d.stage === 'WON').length / deals.length) * 100)}%`, icon: Zap, color: 'orange' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className={`holo-card rounded-lg p-4 border-${stat.color}-500/20`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded bg-${stat.color}-500/10 flex items-center justify-center`}>
                  <Icon className={`h-5 w-5 text-${stat.color}-400`} />
                </div>
                <div>
                  <div className={`stat-value text-xl text-${stat.color}-400`}>{stat.value}</div>
                  <div className="font-['Share_Tech_Mono'] text-[9px] text-cyan-400/40 tracking-wider">{stat.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">LOADING PIPELINE...</div>
          </div>
        </div>
      ) : (
        /* Kanban Board */
        <div className="grid grid-cols-6 gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageDeals = deals.filter((d: Deal) => d.stage === stage.id);
            const stageValue = stageDeals.reduce((sum: number, d: Deal) => sum + d.value, 0);
            const colors = getStageColor(stage.id);
            
            return (
              <div key={stage.id} className="min-w-[250px]">
                {/* Stage Header */}
                <div className={`holo-card rounded-t-lg p-3 ${colors.border} border-b-0`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-['Orbitron'] text-xs tracking-wider ${colors.text}`}>
                      {stage.label}
                    </span>
                    <span className={`font-['Share_Tech_Mono'] text-xs ${colors.text}/60`}>
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className={`font-['Orbitron'] text-sm ${colors.text}`}>
                    {formatCurrency(stageValue)}
                  </div>
                </div>

                {/* Stage Cards Container */}
                <div className={`holo-card rounded-b-lg p-2 ${colors.border} border-t-0 min-h-[400px] space-y-2`}>
                  {stageDeals.map((deal: Deal) => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      className={`p-3 rounded border ${colors.border} ${colors.bg} cursor-pointer hover:${colors.glow} transition-all group`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={`font-['Orbitron'] text-xs ${colors.text} group-hover:neon-text`}>
                          {deal.title}
                        </h4>
                        <ChevronRight className={`h-4 w-4 ${colors.text}/50 opacity-0 group-hover:opacity-100 transition-opacity`} />
                      </div>
                      
                      <div className={`stat-value text-lg ${colors.text} mb-2`}>
                        {formatCurrency(deal.value)}
                      </div>

                      {deal.company && (
                        <div className="flex items-center gap-2 text-cyan-400/50 mb-1">
                          <Building2 className="h-3 w-3" />
                          <span className="font-['Share_Tech_Mono'] text-[10px] truncate">{deal.company.name}</span>
                        </div>
                      )}

                      {deal.lead && (
                        <div className="flex items-center gap-2 text-cyan-400/50">
                          <User className="h-3 w-3" />
                          <span className="font-['Share_Tech_Mono'] text-[10px]">
                            {deal.lead.firstName} {deal.lead.lastName}
                          </span>
                        </div>
                      )}

                      {deal.probability && (
                        <div className="mt-2 pt-2 border-t border-cyan-500/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-['Share_Tech_Mono'] text-[9px] text-cyan-400/40">PROBABILITY</span>
                            <span className={`font-['Orbitron'] text-[10px] ${colors.text}`}>{deal.probability}%</span>
                          </div>
                          <div className="cyber-progress h-1 rounded-full">
                            <div 
                              className="cyber-progress-bar h-full rounded-full" 
                              style={{ width: `${deal.probability}%` }} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                      <div className={`font-['Share_Tech_Mono'] text-xs ${colors.text}/30`}>NO DEALS</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 cyber-modal-backdrop flex items-center justify-center z-50 p-4" onClick={() => setSelectedDeal(null)}>
          <div 
            className="holo-card rounded-lg w-full max-w-lg relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="energy-bar" />
            
            <div className="p-6 border-b border-cyan-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-['Orbitron'] text-xl text-cyan-400 neon-text">
                    {selectedDeal.title}
                  </h2>
                  <span className={`cyber-badge mt-2 inline-block ${getStageColor(selectedDeal.stage).text}`}>
                    {selectedDeal.stage}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedDeal(null)}
                  className="text-cyan-400/50 hover:text-cyan-400"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="data-panel rounded p-4 text-center">
                <div className="stat-value text-4xl text-cyan-400">{formatCurrency(selectedDeal.value)}</div>
                <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50 mt-1">DEAL VALUE</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedDeal.company && (
                  <div className="data-panel rounded p-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Building2 className="h-4 w-4" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">COMPANY</div>
                        <div className="font-['Rajdhani'] text-sm">{selectedDeal.company.name}</div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedDeal.lead && (
                  <div className="data-panel rounded p-3">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <User className="h-4 w-4" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">CONTACT</div>
                        <div className="font-['Rajdhani'] text-sm">{selectedDeal.lead.firstName} {selectedDeal.lead.lastName}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {selectedDeal.probability && (
                <div className="data-panel rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">WIN PROBABILITY</span>
                    <span className="font-['Orbitron'] text-sm text-cyan-400">{selectedDeal.probability}%</span>
                  </div>
                  <div className="cyber-progress h-2 rounded-full">
                    <div 
                      className="cyber-progress-bar h-full rounded-full" 
                      style={{ width: `${selectedDeal.probability}%` }} 
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button className="cyber-btn flex-1 py-2 text-xs">EDIT DEAL</button>
                <button className="cyber-btn flex-1 py-2 text-xs" style={{ borderColor: 'rgb(34, 197, 94)', color: 'rgb(34, 197, 94)' }}>MARK WON</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Deals;
