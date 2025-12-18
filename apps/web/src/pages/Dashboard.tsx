import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, Users, Target, CheckCircle, Activity, Zap, Shield, Database, Cpu, Radio } from 'lucide-react';
import { memo, useMemo } from 'react';

export const Dashboard = memo(function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    retry: false,
  });

  // Use mock data if API fails (no database)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="cyber-spinner mx-auto mb-4" />
          <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">LOADING NEURAL INTERFACE...</div>
        </div>
      </div>
    );
  }

  const statCards = useMemo(() => [
    { 
      title: 'NEURAL LEADS', 
      value: metrics.newLeads || 0, 
      subtitle: `${metrics.contactedLeads || 0} neural links established`,
      icon: Users,
      color: 'cyan',
      trend: '+12.5%'
    },
    { 
      title: 'PIPELINE VALUE', 
      value: formatCurrency(metrics.totalPipelineValue || 0), 
      subtitle: `${metrics.dealsCreated || 0} active deals`,
      icon: Target,
      color: 'magenta',
      trend: '+8.2%'
    },
    { 
      title: 'DEALS WON', 
      value: metrics.dealsWon || 0, 
      subtitle: formatCurrency(metrics.wonValue || 0),
      icon: CheckCircle,
      color: 'green',
      trend: '+23.1%'
    },
    { 
      title: 'WIN RATE', 
      value: `${metrics.winRate?.toFixed(1) || 0}%`, 
      subtitle: `Avg close: ${metrics.avgTimeToClose?.toFixed(0) || 0} cycles`,
      icon: TrendingUp,
      color: 'purple',
      trend: '+5.4%'
    },
  ], [metrics]);

  const getColorClasses = (color: string) => {
    const colors: Record<string, { border: string; glow: string; text: string; bg: string }> = {
      cyan: { border: 'border-cyan-500/30', glow: 'shadow-[0_0_30px_rgba(0,255,255,0.15)]', text: 'text-cyan-400', bg: 'bg-cyan-500/10' },
      magenta: { border: 'border-pink-500/30', glow: 'shadow-[0_0_30px_rgba(255,0,255,0.15)]', text: 'text-pink-400', bg: 'bg-pink-500/10' },
      green: { border: 'border-green-500/30', glow: 'shadow-[0_0_30px_rgba(0,255,136,0.15)]', text: 'text-green-400', bg: 'bg-green-500/10' },
      purple: { border: 'border-purple-500/30', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.15)]', text: 'text-purple-400', bg: 'bg-purple-500/10' },
    };
    return colors[color] || colors.cyan;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="hud-corner">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
              COMMAND CENTER
            </h1>
            <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
              SYSTEM STATUS: <span className="text-green-400 status-online">OPERATIONAL</span> // SECTOR: ALPHA-7
            </p>
          </div>
          <div className="flex items-center gap-2 data-panel rounded px-4 py-2">
            <Radio className="h-4 w-4 text-green-400 animate-pulse" />
            <span className="font-['Share_Tech_Mono'] text-xs text-green-400">LIVE DATA FEED</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, index) => {
          const colors = getColorClasses(stat.color);
          const Icon = stat.icon;
          return (
            <div 
              key={stat.title}
              className={`holo-card rounded-lg p-6 ${colors.border} ${colors.glow} cyber-card relative group`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Corner Decoration */}
              <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-current opacity-30" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
              
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded ${colors.bg}`}>
                  <Icon className={`h-6 w-6 ${colors.text} glow-icon`} />
                </div>
                <span className={`font-['Share_Tech_Mono'] text-xs ${stat.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                  {stat.trend}
                </span>
              </div>
              
              <div className={`stat-value text-3xl mb-1 ${colors.text}`} style={{ textShadow: `0 0 20px currentColor` }}>
                {stat.value}
              </div>
              
              <div className="font-['Orbitron'] text-[10px] tracking-[0.2em] text-cyan-400/60 mb-1">
                {stat.title}
              </div>
              
              <div className="font-['Share_Tech_Mono'] text-xs text-cyan-400/40">
                {stat.subtitle}
              </div>
              
              {/* Bottom progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                <div className={`h-full ${colors.bg} transition-all duration-500`} style={{ width: `${(index + 1) * 25}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* System Panels */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Activity Feed */}
        <div className="lg:col-span-2 holo-card rounded-lg overflow-hidden">
          <div className="border-b border-cyan-500/20 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-cyan-400 glow-icon" />
              <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">NEURAL ACTIVITY LOG</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="font-['Share_Tech_Mono'] text-[10px] text-green-400">STREAMING</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {[
              { time: '00:12:34', event: 'New lead acquired from SECTOR-9', type: 'lead' },
              { time: '00:08:21', event: 'Deal pipeline updated: QUANTUM-DEAL', type: 'deal' },
              { time: '00:05:17', event: 'Neural sync completed with 3 contacts', type: 'sync' },
              { time: '00:02:44', event: 'Task completed: Follow-up sequence', type: 'task' },
              { time: '00:01:02', event: 'Email sequence initiated for LEAD-X42', type: 'email' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-4 p-3 rounded bg-cyan-500/5 border border-cyan-500/10 hover:border-cyan-500/30 transition-all radar-scan">
                <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">{activity.time}</span>
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'lead' ? 'bg-cyan-400' :
                  activity.type === 'deal' ? 'bg-pink-400' :
                  activity.type === 'sync' ? 'bg-green-400' :
                  activity.type === 'task' ? 'bg-purple-400' : 'bg-orange-400'
                }`} />
                <span className="font-['Rajdhani'] text-sm text-cyan-400/80">{activity.event}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Status Panel */}
        <div className="holo-card rounded-lg overflow-hidden">
          <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
            <Cpu className="h-5 w-5 text-cyan-400 glow-icon" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">SYSTEM METRICS</span>
          </div>
          <div className="p-4 space-y-4">
            {[
              { label: 'CPU CORE', value: 73, color: 'cyan' },
              { label: 'MEMORY', value: 62, color: 'magenta' },
              { label: 'NETWORK', value: 94, color: 'green' },
              { label: 'STORAGE', value: 45, color: 'purple' },
            ].map((metric) => (
              <div key={metric.label} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/60">{metric.label}</span>
                  <span className="font-['Orbitron'] text-sm text-cyan-400">{metric.value}%</span>
                </div>
                <div className="cyber-progress h-2 rounded-full">
                  <div 
                    className="cyber-progress-bar h-full rounded-full"
                    style={{ width: `${metric.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Quick Actions */}
          <div className="border-t border-cyan-500/20 p-4">
            <div className="font-['Orbitron'] text-[10px] tracking-[0.2em] text-cyan-400/40 mb-3">QUICK ACTIONS</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Shield, label: 'SCAN' },
                { icon: Database, label: 'SYNC' },
                { icon: Zap, label: 'BOOST' },
                { icon: Radio, label: 'PING' },
              ].map((action) => (
                <button 
                  key={action.label}
                  className="cyber-btn px-3 py-2 text-[10px] flex items-center justify-center gap-2"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tasks Section */}
      <div className="holo-card rounded-lg overflow-hidden">
        <div className="border-b border-cyan-500/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-cyan-400 glow-icon" />
            <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">MISSION OBJECTIVES</span>
          </div>
          <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">
            {data?.metrics?.taskStats?.todo || 3} PENDING
          </span>
        </div>
        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { task: 'Contact lead ALPHA-7', priority: 'HIGH', due: '2h', status: 'active' },
              { task: 'Review quarterly metrics', priority: 'MEDIUM', due: '4h', status: 'pending' },
              { task: 'Send follow-up sequence', priority: 'LOW', due: '1d', status: 'pending' },
            ].map((task, i) => (
              <div key={i} className={`p-4 rounded border ${
                task.priority === 'HIGH' ? 'border-red-500/30 bg-red-500/5' :
                task.priority === 'MEDIUM' ? 'border-orange-500/30 bg-orange-500/5' :
                'border-cyan-500/20 bg-cyan-500/5'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`cyber-badge ${
                    task.priority === 'HIGH' ? 'text-red-400' :
                    task.priority === 'MEDIUM' ? 'text-orange-400' : 'text-cyan-400'
                  }`}>
                    {task.priority}
                  </span>
                  <span className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/40">{task.due}</span>
                </div>
                <div className="font-['Rajdhani'] text-sm text-cyan-400/80">{task.task}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
