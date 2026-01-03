import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Target, Plus, DollarSign, TrendingUp, Zap, Building2, 
  ChevronRight, ChevronLeft, Star, Phone, MapPin, Globe, 
  X, Search, Check, ArrowRight, Trash2
} from 'lucide-react';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  company?: {
    id: string;
    name: string;
    website?: string;
    location?: string;
    profileJson?: any;
  };
  profileJson?: any;
}

interface Deal {
  id: string;
  title: string;
  value: number;
  status: string;
  stage?: { id: string; name: string; };
  stageId: string;
  probability?: number;
  expectedCloseDate?: string;
  lead?: Lead;
  company?: { 
    id: string;
    name: string; 
    profileJson?: any;
    location?: string;
    website?: string;
  };
}

interface Stage {
  id: string;
  name: string;
  position: number;
}

interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

const stageColors: Record<string, { border: string; bg: string; text: string; header: string }> = {
  'New': { border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', text: 'text-cyan-400', header: 'bg-cyan-500/20' },
  'Qualified': { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', header: 'bg-blue-500/20' },
  'Proposal': { border: 'border-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', header: 'bg-purple-500/20' },
  'Negotiation': { border: 'border-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', header: 'bg-orange-500/20' },
  'Won': { border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-green-400', header: 'bg-green-500/20' },
  'Lost': { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400', header: 'bg-red-500/20' },
};

const DEALS_PER_STAGE = 20; // Show 20 at a time for performance

export function Deals() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [stageVisibleCounts, setStageVisibleCounts] = useState<Record<string, number>>({});

  const getVisibleCount = (stageId: string) => stageVisibleCounts[stageId] || DEALS_PER_STAGE;
  
  const showMoreInStage = (stageId: string) => {
    setStageVisibleCounts(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || DEALS_PER_STAGE) + DEALS_PER_STAGE
    }));
  };

  // Fetch pipeline with stages
  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines'),
  });

  const pipeline: Pipeline | null = pipelinesData?.pipelines?.[0] || null;
  const stages = pipeline?.stages || [];

  // Fetch deals
  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => api.get('/deals?limit=1000'),
  });

  const deals: Deal[] = dealsData?.deals || [];

  // Fetch leads for adding to deals
  const { data: leadsData } = useQuery({
    queryKey: ['leads', searchTerm],
    queryFn: () => api.get(`/leads?search=${searchTerm}&limit=100`),
    enabled: showAddModal,
  });

  const availableLeads = leadsData?.leads || [];

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: (data: any) => api.post('/deals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setShowAddModal(false);
      setSelectedLead(null);
    },
  });

  // Move deal mutation
  const moveDealMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) => 
      api.patch(`/deals/${dealId}`, { stageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: (err) => {
      console.error('Move deal failed:', err);
    },
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: (id: string) => api.deleteDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });

  const handleDeleteDeal = (deal: Deal) => {
    if (window.confirm(`Delete deal "${deal.title}" from the pipeline?`)) {
      deleteDealMutation.mutate(deal.id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStageColor = (stageName: string) => {
    return stageColors[stageName] || stageColors['New'];
  };

  const getProfile = (item: any) => {
    if (!item?.profileJson) return null;
    try {
      return typeof item.profileJson === 'string' ? JSON.parse(item.profileJson) : item.profileJson;
    } catch { return null; }
  };

  // Stats
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const wonDeals = deals.filter(d => d.stage?.name === 'Won' || d.status === 'won');
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const activeDeals = deals.filter(d => d.status === 'open');
  const winRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    stages.forEach(stage => {
      grouped[stage.id] = deals.filter(d => d.stageId === stage.id);
    });
    return grouped;
  }, [deals, stages]);

  const moveDeal = (deal: Deal, direction: 'forward' | 'backward') => {
    const currentIndex = stages.findIndex(s => s.id === deal.stageId);
    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < stages.length) {
      moveDealMutation.mutate({
        dealId: deal.id,
        stageId: stages[newIndex].id,
      });
    }
  };

  const handleAddDeal = () => {
    if (!selectedLead || !pipeline) return;
    
    const profile = getProfile(selectedLead) || getProfile(selectedLead.company);
    const businessName = profile?.businessName || selectedLead.company?.name || `${selectedLead.firstName} ${selectedLead.lastName}`;
    
    createDealMutation.mutate({
      title: businessName,
      value: 0,
      pipelineId: pipeline.id,
      stageId: stages[0]?.id,
      leadId: selectedLead.id,
      companyId: selectedLead.company?.id,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-gray-400 text-sm mt-1">
            {activeDeals.length} active deals • {formatCurrency(totalValue)} total value
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Business
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-cyan-500/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-cyan-400">{formatCurrency(totalValue)}</div>
              <div className="text-xs text-gray-500">Pipeline Value</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-green-400">{formatCurrency(wonValue)}</div>
              <div className="text-xs text-gray-500">Won Value</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-purple-400">{activeDeals.length}</div>
              <div className="text-xs text-gray-500">Active Deals</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-orange-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-orange-400">{winRate}%</div>
              <div className="text-xs text-gray-500">Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Board */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
            <div className="text-gray-400">Loading pipeline...</div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(200px, 1fr))` }}>
          {stages.map((stage) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
            const colors = getStageColor(stage.name);
            const stageIndex = stages.findIndex(s => s.id === stage.id);
            
            return (
              <div key={stage.id} className="flex flex-col">
                {/* Stage Header */}
                <div className={`rounded-t-lg p-3 ${colors.header} border ${colors.border} border-b-0`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-semibold text-sm ${colors.text}`}>
                      {stage.name.toUpperCase()}
                    </span>
                    <span className={`text-xs ${colors.text} opacity-60`}>
                      {stageDeals.length}
                    </span>
                  </div>
                  <div className={`text-sm font-bold ${colors.text}`}>
                    {formatCurrency(stageValue)}
                  </div>
                </div>

                {/* Stage Cards */}
                <div className={`flex-1 rounded-b-lg p-2 border ${colors.border} border-t-0 max-h-[600px] overflow-y-auto space-y-2 bg-gray-900/50`}>
                  {stageDeals.slice(0, getVisibleCount(stage.id)).map((deal) => {
                    const profile = getProfile(deal.lead) || getProfile(deal.company);
                    const rating = profile?.rating || 0;
                    const reviews = profile?.reviewCount || 0;
                    const category = profile?.category || deal.lead?.title || '';
                    const avgPosition = profile?.averagePosition || 0;
                    
                    return (
                      <div
                        key={deal.id}
                        className={`p-3 rounded border ${colors.border} ${colors.bg} group relative`}
                      >
                        {/* Business Name */}
                        <h4 className={`font-semibold text-sm ${colors.text} mb-2 pr-6`}>
                          {deal.title}
                        </h4>

                        {/* Category Badge & Rank */}
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {category && (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                              {category}
                            </span>
                          )}
                          {avgPosition > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
                              Rank #{Math.round(avgPosition)}
                            </span>
                          )}
                        </div>

                        {/* Rating */}
                        {rating > 0 && (
                          <div className="flex items-center gap-2 mb-2">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-yellow-400 font-medium">{rating.toFixed(1)}</span>
                            <span className="text-gray-500 text-xs">({reviews})</span>
                          </div>
                        )}

                        {/* Contact Info */}
                        {(profile?.address || deal.company?.location) && (
                          <div className="flex items-start gap-2 text-gray-400 text-xs mb-1">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{profile?.address || deal.company?.location}</span>
                          </div>
                        )}
                        
                        {deal.lead?.phone && (
                          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <span>{deal.lead.phone}</span>
                          </div>
                        )}

                        {/* Value */}
                        {deal.value > 0 && (
                          <div className={`text-lg font-bold ${colors.text} mt-2`}>
                            {formatCurrency(deal.value)}
                          </div>
                        )}

                        {/* Move Buttons */}
                        <div className="flex gap-1 mt-3 pt-2 border-t border-gray-700">
                          <button
                            onClick={() => moveDeal(deal, 'backward')}
                            disabled={stageIndex === 0}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                              stageIndex === 0 
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                                : 'bg-gray-700 hover:bg-gray-600 text-white'
                            }`}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteDeal(deal)}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => moveDeal(deal, 'forward')}
                            disabled={stageIndex === stages.length - 1}
                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                              stageIndex === stages.length - 1 
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed' 
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                            }`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {stageDeals.length > getVisibleCount(stage.id) && (
                    <button 
                      onClick={() => showMoreInStage(stage.id)}
                      className={`w-full py-2 rounded ${colors.bg} ${colors.border} border ${colors.text} text-xs hover:opacity-80 transition-opacity`}
                    >
                      Show more ({stageDeals.length - getVisibleCount(stage.id)} remaining)
                    </button>
                  )}

                  {stageDeals.length === 0 && (
                    <div className="h-32 flex items-center justify-center">
                      <span className={`text-sm ${colors.text} opacity-30`}>No deals</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Business Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div 
            className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden border border-gray-700 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Add Business to Pipeline</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search businesses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 text-white pl-10 pr-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Business List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {availableLeads.map((lead: Lead) => {
                const profile = getProfile(lead) || getProfile(lead.company);
                const businessName = profile?.businessName || lead.company?.name || `${lead.firstName} ${lead.lastName}`;
                const rating = profile?.rating || 0;
                const reviews = profile?.reviewCount || 0;
                const category = profile?.category || lead.title || '';
                const isSelected = selectedLead?.id === lead.id;
                
                // Check if already in pipeline
                const alreadyInPipeline = deals.some(d => d.lead?.id === lead.id);
                
                return (
                  <div
                    key={lead.id}
                    onClick={() => !alreadyInPipeline && setSelectedLead(lead)}
                    className={`p-3 rounded-lg border transition-all ${
                      alreadyInPipeline
                        ? 'bg-gray-800/30 border-gray-700 opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-cyan-500/10 border-cyan-500'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{businessName}</h3>
                          {alreadyInPipeline && (
                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">In Pipeline</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 mt-1">
                          {category && (
                            <span className="text-xs text-gray-400">{category}</span>
                          )}
                          {rating > 0 && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-yellow-400 text-xs">{rating.toFixed(1)}</span>
                              <span className="text-gray-500 text-xs">({reviews})</span>
                            </div>
                          )}
                        </div>
                        
                        {profile?.address && (
                          <div className="flex items-center gap-1 mt-1 text-gray-500 text-xs">
                            <MapPin className="h-3 w-3" />
                            <span className="line-clamp-1">{profile.address}</span>
                          </div>
                        )}
                      </div>
                      
                      {isSelected && !alreadyInPipeline && (
                        <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                          <Check className="h-4 w-4 text-black" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {availableLeads.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No businesses found' : 'Search for a business to add'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {selectedLead ? (
                  <span>Selected: <span className="text-white">{getProfile(selectedLead)?.businessName || selectedLead.company?.name || selectedLead.firstName}</span></span>
                ) : (
                  <span>Select a business to add</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDeal}
                  disabled={!selectedLead || createDealMutation.isPending}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    selectedLead
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {createDealMutation.isPending ? (
                    <span>Adding...</span>
                  ) : (
                    <>
                      <span>Add to Pipeline</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Deals;
