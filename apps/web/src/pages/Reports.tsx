import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart3, TrendingUp, DollarSign, Users, Target, Zap, ArrowUp, ArrowDown, Activity, Cpu } from 'lucide-react';

export function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    retry: false,
  });

  const metrics = data?.metrics?.overview || {
    newLeads: 127,
    contactedLeads: 89,
    totalPipelineValue: 2850000,
    dealsCreated: 45,
    dealsWon: 12,
    wonValue: 892000,
    winRate: 26.7,
    avgTimeToClose: 18,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const kpiCards = [
    { 
      title: 'REVENUE TARGET', 
      value: formatCurrency(metrics.wonValue || 892000), 
      target: '$1,000,000',
      progress: 89,
      icon: DollarSign, 
      color: 'cyan',
      trend: { value: '+12.5%', direction: 'up' }
    },
    { 
      title: 'LEAD CONVERSION', 
      value: `${((metrics.dealsCreated / metrics.newLeads) * 100).toFixed(1)}%`, 
      target: '40%',
      progress: 75,
      icon: Users, 
      color: 'purple',
      trend: { value: '+5.2%', direction: 'up' }
    },
    { 
      title: 'WIN RATE', 
      value: `${metrics.winRate?.toFixed(1) || 26.7}%`, 
      target: '35%',
      progress: 76,
      icon: Target, 
      color: 'green',
      trend: { value: '+2.1%', direction: 'up' }
    },
    { 
      title: 'AVG DEAL SIZE', 
      value: formatCurrency((metrics.wonValue || 892000) / (metrics.dealsWon || 12)), 
      target: '$100,000',
      progress: 74,
      icon: TrendingUp, 
      color: 'orange',
      trend: { value: '-3.2%', direction: 'down' }
    },
  ];

  const monthlyData = [
    { month: 'JAN', leads: 85, deals: 8, revenue: 120000 },
    { month: 'FEB', leads: 92, deals: 10, revenue: 145000 },
    { month: 'MAR', leads: 78, deals: 7, revenue: 98000 },
    { month: 'APR', leads: 105, deals: 12, revenue: 178000 },
    { month: 'MAY', leads: 115, deals: 14, revenue: 195000 },
    { month: 'JUN', leads: 127, deals: 12, revenue: 156000 },
  ];

  const maxRevenue = Math.max(...monthlyData.map(d => d.revenue));
  const maxLeads = Math.max(...monthlyData.map(d => d.leads));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="hud-corner">
        <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
          ANALYTICS HUB
        </h1>
        <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
          PERFORMANCE METRICS // REAL-TIME DATA ANALYSIS
        </p>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">COMPILING METRICS...</div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-6">
            {kpiCards.map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="holo-card rounded-lg p-5 relative overflow-hidden">
                  {/* Background Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-${kpi.color}-500/5 to-transparent`} />
                  
                  <div className="relative">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded bg-${kpi.color}-500/10 border border-${kpi.color}-500/30 flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 text-${kpi.color}-400`} />
                      </div>
                      <div className={`flex items-center gap-1 ${kpi.trend.direction === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                        {kpi.trend.direction === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        <span className="font-['Share_Tech_Mono'] text-xs">{kpi.trend.value}</span>
                      </div>
                    </div>

                    {/* Value */}
                    <div className={`stat-value text-2xl text-${kpi.color}-400 mb-1`}>
                      {kpi.value}
                    </div>
                    <div className="font-['Orbitron'] text-[10px] text-cyan-400/40 tracking-wider mb-3">
                      {kpi.title}
                    </div>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/40">TARGET: {kpi.target}</span>
                        <span className={`font-['Orbitron'] text-xs text-${kpi.color}-400`}>{kpi.progress}%</span>
                      </div>
                      <div className="cyber-progress h-2 rounded-full">
                        <div 
                          className="cyber-progress-bar h-full rounded-full" 
                          style={{ width: `${kpi.progress}%` }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-cyan-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">REVENUE TREND</span>
              </div>
              <div className="p-6">
                <div className="flex items-end justify-between h-48 gap-4">
                  {monthlyData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full relative" style={{ height: '160px' }}>
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500/30 to-cyan-400/10 rounded-t transition-all hover:from-cyan-500/50 hover:to-cyan-400/20"
                          style={{ height: `${(d.revenue / maxRevenue) * 100}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-['Orbitron'] text-[10px] text-cyan-400 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                            ${(d.revenue / 1000).toFixed(0)}K
                          </div>
                        </div>
                      </div>
                      <span className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">{d.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Leads Chart */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-purple-400">LEAD ACQUISITION</span>
              </div>
              <div className="p-6">
                <div className="flex items-end justify-between h-48 gap-4">
                  {monthlyData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full relative" style={{ height: '160px' }}>
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-500/30 to-purple-400/10 rounded-t transition-all hover:from-purple-500/50 hover:to-purple-400/20"
                          style={{ height: `${(d.leads / maxLeads) * 100}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-['Orbitron'] text-[10px] text-purple-400 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                            {d.leads}
                          </div>
                        </div>
                      </div>
                      <span className="font-['Share_Tech_Mono'] text-[10px] text-purple-400/50">{d.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-3 gap-6">
            {/* Top Performers */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Zap className="h-5 w-5 text-orange-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-orange-400">TOP PERFORMERS</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: 'Sarah Connor', deals: 8, value: 245000 },
                  { name: 'Rick Deckard', deals: 6, value: 198000 },
                  { name: 'Ellen Ripley', deals: 5, value: 156000 },
                  { name: 'Neo Anderson', deals: 4, value: 134000 },
                ].map((user, i) => (
                  <div key={i} className="data-panel rounded p-3 flex items-center justify-between radar-scan">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        i === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                        i === 1 ? 'bg-gray-400/20 border border-gray-400/50' :
                        i === 2 ? 'bg-orange-600/20 border border-orange-600/50' :
                        'bg-cyan-500/10 border border-cyan-500/30'
                      }`}>
                        <span className="font-['Orbitron'] text-xs">{i + 1}</span>
                      </div>
                      <div>
                        <div className="font-['Rajdhani'] text-sm text-cyan-400">{user.name}</div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/40">{user.deals} deals</div>
                      </div>
                    </div>
                    <div className="font-['Orbitron'] text-sm text-green-400">{formatCurrency(user.value)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline Breakdown */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-cyan-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">PIPELINE BREAKDOWN</span>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { stage: 'QUALIFIED', count: 15, value: 450000, color: 'cyan' },
                  { stage: 'PROPOSAL', count: 8, value: 320000, color: 'purple' },
                  { stage: 'NEGOTIATION', count: 5, value: 280000, color: 'orange' },
                  { stage: 'CLOSING', count: 3, value: 180000, color: 'green' },
                ].map((stage, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-['Orbitron'] text-xs text-${stage.color}-400`}>{stage.stage}</span>
                      <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">{stage.count} deals</span>
                    </div>
                    <div className="cyber-progress h-6 rounded relative overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r from-${stage.color}-500/50 to-${stage.color}-400/30`}
                        style={{ width: `${(stage.value / 450000) * 100}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="font-['Orbitron'] text-xs text-white/80">{formatCurrency(stage.value)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Health */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Cpu className="h-5 w-5 text-green-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-green-400">SYSTEM HEALTH</span>
              </div>
              <div className="p-4 space-y-4">
                {[
                  { metric: 'API RESPONSE', value: '45ms', status: 'optimal' },
                  { metric: 'DATABASE', value: '99.9%', status: 'optimal' },
                  { metric: 'QUEUE PROCESSING', value: '1.2s', status: 'good' },
                  { metric: 'MEMORY USAGE', value: '62%', status: 'good' },
                  { metric: 'ERROR RATE', value: '0.01%', status: 'optimal' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        item.status === 'optimal' ? 'bg-green-400 status-online' :
                        item.status === 'good' ? 'bg-cyan-400' : 'bg-orange-400 status-warning'
                      }`} />
                      <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60">{item.metric}</span>
                    </div>
                    <span className={`font-['Orbitron'] text-sm ${
                      item.status === 'optimal' ? 'text-green-400' :
                      item.status === 'good' ? 'text-cyan-400' : 'text-orange-400'
                    }`}>{item.value}</span>
                  </div>
                ))}

                <div className="pt-4 border-t border-cyan-500/20">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-400" />
                    <span className="font-['Orbitron'] text-xs text-green-400">ALL SYSTEMS OPERATIONAL</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Reports;
