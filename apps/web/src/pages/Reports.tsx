import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BarChart3, TrendingUp, DollarSign, Users, Target, Zap, ArrowUp, ArrowDown, Activity, Cpu, Building2, Star, MapPin } from 'lucide-react';

export function Reports() {
  // Fetch real deals/profiles data
  const { data: dealsData, isLoading: dealsLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => api.getDeals(),
    retry: false,
  });

  const { data: leadsData, isLoading: leadsLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.getLeads(),
    retry: false,
  });

  const isLoading = dealsLoading || leadsLoading;
  
  // Calculate real metrics from deals/profiles
  const deals = dealsData?.deals || [];
  const leads = leadsData?.leads || [];
  
  // Group deals by stage
  const dealsByStage = deals.reduce((acc: Record<string, any[]>, deal: any) => {
    const stage = deal.stageId || 'lead';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(deal);
    return acc;
  }, {});

  // Calculate stage counts
  const stageStats = {
    lead: dealsByStage['lead']?.length || 0,
    qualified: dealsByStage['qualified']?.length || 0,
    proposal: dealsByStage['proposal']?.length || 0,
    negotiation: dealsByStage['negotiation']?.length || 0,
    closed: (dealsByStage['won']?.length || 0) + (dealsByStage['closed']?.length || 0),
  };

  // Calculate category breakdown
  const categoryBreakdown = deals.reduce((acc: Record<string, number>, deal: any) => {
    const category = deal.profileJson?.category || deal.company?.industry || 'Other';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  // Get top categories
  const topCategories = Object.entries(categoryBreakdown)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 5);

  // Calculate average rating
  const ratingsData = deals
    .map((d: any) => d.profileJson?.rating)
    .filter((r: any) => r && !isNaN(r));
  const avgRating = ratingsData.length > 0 
    ? (ratingsData.reduce((a: number, b: number) => a + b, 0) / ratingsData.length).toFixed(1)
    : '0.0';

  // Calculate total reviews
  const totalReviews = deals.reduce((sum: number, d: any) => {
    return sum + (d.profileJson?.reviewCount || 0);
  }, 0);

  // Top ranked businesses
  const topRanked = [...deals]
    .filter((d: any) => d.profileJson?.ranking)
    .sort((a: any, b: any) => {
      const rankA = parseInt(a.profileJson?.ranking?.replace('#', '')) || 999;
      const rankB = parseInt(b.profileJson?.ranking?.replace('#', '')) || 999;
      return rankA - rankB;
    })
    .slice(0, 4);

  // Metrics object
  const metrics = {
    totalProfiles: deals.length,
    totalLeads: leads.length,
    avgRating: parseFloat(avgRating),
    totalReviews,
    qualified: stageStats.qualified,
    proposals: stageStats.proposal,
    negotiations: stageStats.negotiation,
    closed: stageStats.closed,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Real KPI cards based on actual data
  const kpiCards = [
    { 
      title: 'TOTAL PROFILES', 
      value: metrics.totalProfiles.toString(), 
      target: '500',
      progress: Math.min(100, Math.round((metrics.totalProfiles / 500) * 100)),
      icon: Building2, 
      color: 'cyan',
      trend: { value: metrics.totalProfiles > 0 ? `+${metrics.totalProfiles}` : '--', direction: 'up' }
    },
    { 
      title: 'AVG RATING', 
      value: `${metrics.avgRating}★`, 
      target: '5.0★',
      progress: Math.round((metrics.avgRating / 5) * 100),
      icon: Star, 
      color: 'yellow',
      trend: { value: metrics.avgRating > 0 ? `${metrics.avgRating}/5` : '--', direction: 'up' }
    },
    { 
      title: 'TOTAL REVIEWS', 
      value: totalReviews.toLocaleString(), 
      target: '10,000',
      progress: Math.min(100, Math.round((totalReviews / 10000) * 100)),
      icon: Users, 
      color: 'purple',
      trend: { value: totalReviews > 0 ? `+${totalReviews}` : '--', direction: 'up' }
    },
    { 
      title: 'IN PIPELINE', 
      value: (stageStats.qualified + stageStats.proposal + stageStats.negotiation).toString(), 
      target: '100',
      progress: Math.min(100, Math.round(((stageStats.qualified + stageStats.proposal + stageStats.negotiation) / 100) * 100)),
      icon: Target, 
      color: 'green',
      trend: { value: stageStats.qualified > 0 ? `${stageStats.qualified} qualified` : '--', direction: 'up' }
    },
  ];

  // Category data for charts
  const categoryData = topCategories.map(([name, count]) => ({
    category: name,
    count: count as number,
  }));
  
  const maxCategoryCount = Math.max(...categoryData.map(d => d.count), 1);

  // Stage data for pipeline breakdown
  const stageData = [
    { stage: 'LEAD', count: stageStats.lead, color: 'cyan' },
    { stage: 'QUALIFIED', count: stageStats.qualified, color: 'blue' },
    { stage: 'PROPOSAL', count: stageStats.proposal, color: 'purple' },
    { stage: 'NEGOTIATION', count: stageStats.negotiation, color: 'orange' },
    { stage: 'CLOSED', count: stageStats.closed, color: 'green' },
  ];
  
  const maxStageCount = Math.max(...stageData.map(d => d.count), 1);

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
            {/* Category Breakdown Chart */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Building2 className="h-5 w-5 text-cyan-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">CATEGORY BREAKDOWN</span>
              </div>
              <div className="p-6">
                {categoryData.length > 0 ? (
                  <div className="flex items-end justify-between h-48 gap-4">
                    {categoryData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full relative" style={{ height: '160px' }}>
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500/30 to-cyan-400/10 rounded-t transition-all hover:from-cyan-500/50 hover:to-cyan-400/20"
                            style={{ height: `${(d.count / maxCategoryCount) * 100}%` }}
                          >
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-['Orbitron'] text-[10px] text-cyan-400 whitespace-nowrap">
                              {d.count}
                            </div>
                          </div>
                        </div>
                        <span className="font-['Share_Tech_Mono'] text-[8px] text-cyan-400/50 text-center truncate w-full" title={d.category}>
                          {d.category.length > 12 ? d.category.slice(0, 10) + '...' : d.category}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-cyan-400/40 font-['Share_Tech_Mono']">
                    No category data available
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline Stage Distribution */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-purple-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-purple-400">PIPELINE STAGES</span>
              </div>
              <div className="p-6">
                {stageData.some(s => s.count > 0) ? (
                  <div className="flex items-end justify-between h-48 gap-4">
                    {stageData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full relative" style={{ height: '160px' }}>
                          <div 
                            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-${d.color}-500/30 to-${d.color}-400/10 rounded-t transition-all hover:from-${d.color}-500/50 hover:to-${d.color}-400/20`}
                            style={{ height: `${(d.count / maxStageCount) * 100}%` }}
                          >
                            <div className={`absolute -top-6 left-1/2 -translate-x-1/2 font-['Orbitron'] text-[10px] text-${d.color}-400 whitespace-nowrap`}>
                              {d.count}
                            </div>
                          </div>
                        </div>
                        <span className="font-['Share_Tech_Mono'] text-[8px] text-purple-400/50">{d.stage}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-purple-400/40 font-['Share_Tech_Mono']">
                    No pipeline data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-3 gap-6">
            {/* Top Ranked Businesses */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Zap className="h-5 w-5 text-orange-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-orange-400">TOP RANKED</span>
              </div>
              <div className="p-4 space-y-3">
                {topRanked.length > 0 ? topRanked.map((deal: any, i: number) => (
                  <div key={i} className="data-panel rounded p-3 flex items-center justify-between radar-scan">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        i === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                        i === 1 ? 'bg-gray-400/20 border border-gray-400/50' :
                        i === 2 ? 'bg-orange-600/20 border border-orange-600/50' :
                        'bg-cyan-500/10 border border-cyan-500/30'
                      }`}>
                        <span className="font-['Orbitron'] text-xs">{deal.profileJson?.ranking || `#${i+1}`}</span>
                      </div>
                      <div>
                        <div className="font-['Rajdhani'] text-sm text-cyan-400 truncate max-w-[140px]">{deal.title || deal.companyName}</div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/40">
                          {deal.profileJson?.rating ? `${deal.profileJson.rating}★` : ''} 
                          {deal.profileJson?.reviewCount ? ` · ${deal.profileJson.reviewCount} reviews` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="font-['Orbitron'] text-xs text-green-400">{deal.profileJson?.category?.slice(0, 12) || 'Business'}</div>
                  </div>
                )) : (
                  <div className="text-center text-cyan-400/40 font-['Share_Tech_Mono'] py-8">
                    No ranked businesses yet
                  </div>
                )}
              </div>
            </div>

            {/* Pipeline Breakdown */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Target className="h-5 w-5 text-cyan-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-cyan-400">PIPELINE BREAKDOWN</span>
              </div>
              <div className="p-4 space-y-3">
                {stageData.map((stage, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`font-['Orbitron'] text-xs text-${stage.color}-400`}>{stage.stage}</span>
                      <span className="font-['Share_Tech_Mono'] text-xs text-cyan-400/50">{stage.count} profiles</span>
                    </div>
                    <div className="cyber-progress h-6 rounded relative overflow-hidden">
                      <div 
                        className={`h-full bg-gradient-to-r from-${stage.color}-500/50 to-${stage.color}-400/30`}
                        style={{ width: `${maxStageCount > 0 ? (stage.count / maxStageCount) * 100 : 0}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="font-['Orbitron'] text-xs text-white/80">{stage.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Summary */}
            <div className="holo-card rounded-lg overflow-hidden">
              <div className="border-b border-cyan-500/20 p-4 flex items-center gap-3">
                <Cpu className="h-5 w-5 text-green-400 glow-icon" />
                <span className="font-['Orbitron'] text-sm tracking-wider text-green-400">DATA SUMMARY</span>
              </div>
              <div className="p-4 space-y-4">
                {[
                  { metric: 'TOTAL PROFILES', value: deals.length.toString(), status: deals.length > 0 ? 'optimal' : 'warning' },
                  { metric: 'CATEGORIES', value: Object.keys(categoryBreakdown).length.toString(), status: 'optimal' },
                  { metric: 'AVG RATING', value: `${avgRating}★`, status: parseFloat(avgRating) >= 4 ? 'optimal' : 'good' },
                  { metric: 'TOTAL REVIEWS', value: totalReviews.toLocaleString(), status: 'optimal' },
                  { metric: 'IN PIPELINE', value: (stageStats.qualified + stageStats.proposal + stageStats.negotiation).toString(), status: 'good' },
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
                    <span className="font-['Orbitron'] text-xs text-green-400">
                      {deals.length > 0 ? 'DATA LOADED FROM DATABASE' : 'NO DATA - IMPORT CSV TO START'}
                    </span>
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
