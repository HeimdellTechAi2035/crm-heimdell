import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Target, Plus, DollarSign, TrendingUp, Zap, Building2, 
  ChevronRight, ChevronLeft, Star, Phone, MapPin, Globe, 
  X, Search, Check, ArrowRight, Trash2, Mail, MessageSquare, PhoneCall, Download
} from 'lucide-react';

// Sequence types for deals
type SequenceType = 'email' | 'dm' | 'call';

interface DealSequences {
  [dealId: string]: {
    email?: string;
    dm?: string;
    call?: string;
  };
}

// Get/save deal sequences from localStorage
function getDealSequences(): DealSequences {
  try {
    return JSON.parse(localStorage.getItem('heimdell-deal-sequences') || '{}');
  } catch {
    return {};
  }
}

function saveDealSequences(sequences: DealSequences) {
  localStorage.setItem('heimdell-deal-sequences', JSON.stringify(sequences));
}

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
    address?: string;
    website?: string;
    phone?: string;
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
  const [showValueModal, setShowValueModal] = useState(false);
  const [showBulkValueModal, setShowBulkValueModal] = useState(false);
  const [showNewPipelineModal, setShowNewPipelineModal] = useState(false);
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [selectedDealForSequence, setSelectedDealForSequence] = useState<Deal | null>(null);
  const [dealSequences, setDealSequences] = useState<DealSequences>(getDealSequences());
  const [newPipelineName, setNewPipelineName] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('default');
  const [selectedDealForValue, setSelectedDealForValue] = useState<Deal | null>(null);
  const [dealValue, setDealValue] = useState('');
  const [bulkValue, setBulkValue] = useState('750');
  const [bulkStage, setBulkStage] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Sequence viewer modal state: { sequence, type }
  const [viewingSequence, setViewingSequence] = useState<{ sequence: any; type: 'email' | 'dm' | 'call' } | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [stageVisibleCounts, setStageVisibleCounts] = useState<Record<string, number>>({});

  // Fetch sequences for assignment
  const { data: sequencesData } = useQuery({
    queryKey: ['sequences'],
    queryFn: async () => {
      const stored = localStorage.getItem('heimdell-sequences');
      return stored ? JSON.parse(stored) : [];
    },
  });
  const allSequences = sequencesData || [];

  const getVisibleCount = (stageId: string) => stageVisibleCounts[stageId] || DEALS_PER_STAGE;
  
  const showMoreInStage = (stageId: string) => {
    setStageVisibleCounts(prev => ({
      ...prev,
      [stageId]: (prev[stageId] || DEALS_PER_STAGE) + DEALS_PER_STAGE
    }));
  };

  const handleAssignSequence = (dealId: string, type: SequenceType, sequenceId: string | null) => {
    const updated = { ...dealSequences };
    if (!updated[dealId]) updated[dealId] = {};
    if (sequenceId) {
      updated[dealId][type] = sequenceId;
    } else {
      delete updated[dealId][type];
    }
    setDealSequences(updated);
    saveDealSequences(updated);
  };

  const getDealSequenceStatus = (dealId: string) => {
    const seqs = dealSequences[dealId] || {};
    return {
      email: seqs.email ? allSequences.find((s: any) => s.id === seqs.email) : null,
      dm: seqs.dm ? allSequences.find((s: any) => s.id === seqs.dm) : null,
      call: seqs.call ? allSequences.find((s: any) => s.id === seqs.call) : null,
    };
  };

  // Fetch all pipelines
  const { data: pipelinesData } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api.get('/pipelines'),
  });

  const allPipelines = pipelinesData?.pipelines || [];
  const selectedPipeline = allPipelines.find((p: any) => p.id === selectedPipelineId) || allPipelines[0];
  const stages = selectedPipeline?.stages || [];

  // Fetch deals for selected pipeline
  const { data: dealsData, isLoading } = useQuery({
    queryKey: ['deals', selectedPipelineId],
    queryFn: () => api.get(`/deals?limit=1000&pipeline_id=${selectedPipelineId}`),
    staleTime: 0, // Always refetch to ensure fresh data
    refetchOnWindowFocus: true,
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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      console.error('Move deal failed:', err);
    },
  });

  // Update deal value mutation
  const updateValueMutation = useMutation({
    mutationFn: ({ dealId, value }: { dealId: string; value: number }) => 
      api.patch(`/deals/${dealId}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowValueModal(false);
      setSelectedDealForValue(null);
      setDealValue('');
    },
  });

  // Bulk update values mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ value, stage }: { value: number; stage?: string }) => 
      api.bulkUpdateValues(value, stage === 'all' ? undefined : stage),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowBulkValueModal(false);
      alert(`Updated ${data.updatedCount} deals with value £${bulkValue}`);
    },
  });

  // Create pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: (name: string) => api.createPipeline(name),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setSelectedPipelineId(data.pipeline.id);
      setShowNewPipelineModal(false);
      setNewPipelineName('');
    },
  });

  // Delete deal mutation (kept for reference but replaced with Lost functionality)
  const deleteDealMutation = useMutation({
    mutationFn: (id: string) => api.deleteDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals', selectedPipelineId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.refetchQueries({ queryKey: ['deals', selectedPipelineId] });
    },
    onError: (err) => {
      console.error('Delete failed:', err);
      alert('Failed to delete. Please try again.');
    },
  });

  // Mark deal as Lost mutation
  const markLostMutation = useMutation({
    mutationFn: ({ dealId }: { dealId: string }) => 
      api.patch(`/deals/${dealId}`, { stageId: 'lost' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals', selectedPipelineId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.refetchQueries({ queryKey: ['deals', selectedPipelineId] });
    },
    onError: (err) => {
      console.error('Mark as Lost failed:', err);
      alert('Failed to mark as lost. Please try again.');
    },
  });

  const handleMarkLost = (deal: Deal) => {
    if (window.confirm(`Mark "${deal.title}" as Lost?`)) {
      markLostMutation.mutate({ dealId: deal.id });
    }
  };

  const handleDeleteDeal = (deal: Deal) => {
    if (window.confirm(`Delete deal "${deal.title}" from the pipeline?`)) {
      const profileId = deal.id.replace('deal-', '');
      console.log('Deleting deal:', deal.id, 'profileId:', profileId);
      deleteDealMutation.mutate(deal.id);
    }
  };

  const handleEditValue = (deal: Deal) => {
    setSelectedDealForValue(deal);
    setDealValue(deal.value?.toString() || '');
    setShowValueModal(true);
  };

  const handleSaveValue = () => {
    if (selectedDealForValue) {
      const value = parseFloat(dealValue) || 0;
      updateValueMutation.mutate({ dealId: selectedDealForValue.id, value });
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

  // Stats - count by stageId
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);
  const closedDeals = deals.filter(d => d.stageId === 'closed');
  const wonValue = closedDeals.reduce((sum, d) => sum + (d.value || 0), 0);
  const qualifiedDeals = deals.filter(d => d.stageId === 'qualified');
  const proposalDeals = deals.filter(d => d.stageId === 'proposal');
  const negotiationDeals = deals.filter(d => d.stageId === 'negotiation');
  const leadDeals = deals.filter(d => d.stageId === 'lead');
  const activeDeals = deals.filter(d => d.stageId !== 'closed');
  const winRate = deals.length > 0 ? Math.round((closedDeals.length / deals.length) * 100) : 0;

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const grouped: Record<string, Deal[]> = {};
    stages.forEach((stage: Stage) => {
      grouped[stage.id] = deals.filter(d => d.stageId === stage.id);
    });
    return grouped;
  }, [deals, stages]);

  // Export deals to CSV
  const exportToCSV = () => {
    // CSV headers
    const headers = [
      'Company Name',
      'Stage',
      'Value (£)',
      'Phone',
      'Email',
      'Website',
      'Address',
      'Rating',
      'Reviews',
      'Added Date'
    ];

    // Build rows from all deals
    const rows = deals.map(deal => {
      const profile = getProfile(deal.company) || getProfile(deal.lead?.company) || {};
      const stageName = stages.find((s: Stage) => s.id === deal.stageId)?.name || deal.stageId;
      
      return [
        deal.title || deal.company?.name || 'Unknown',
        stageName,
        deal.value || 0,
        profile.phone || deal.company?.phone || deal.lead?.phone || '',
        profile.email || deal.lead?.email || '',
        profile.website || deal.company?.website || deal.lead?.company?.website || '',
        profile.address || deal.company?.address || deal.company?.location || '',
        profile.rating || '',
        profile.reviews || '',
        deal.lead?.profileJson?.importedAt ? new Date(deal.lead.profileJson.importedAt).toLocaleDateString() : ''
      ];
    });

    // Sort by stage for better organization
    const stageOrder: Record<string, number> = {};
    stages.forEach((s: Stage, idx: number) => { stageOrder[s.name] = idx; });
    rows.sort((a, b) => (stageOrder[a[1] as string] || 99) - (stageOrder[b[1] as string] || 99));

    // Convert to CSV string
    const escapeCSV = (val: any) => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // Download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const pipelineName = selectedPipeline?.name || 'deals';
    const date = new Date().toISOString().split('T')[0];
    link.download = `${pipelineName.toLowerCase().replace(/\s+/g, '-')}-export-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const moveDeal = (deal: Deal, direction: 'forward' | 'backward') => {
    const currentIndex = stages.findIndex((s: Stage) => s.id === deal.stageId);
    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < stages.length) {
      moveDealMutation.mutate({
        dealId: deal.id,
        stageId: stages[newIndex].id,
      });
    }
  };

  const handleAddDeal = () => {
    if (!selectedLead || !selectedPipeline) return;
    
    const profile = getProfile(selectedLead) || getProfile(selectedLead.company);
    const businessName = profile?.businessName || selectedLead.company?.name || `${selectedLead.firstName} ${selectedLead.lastName}`;
    
    createDealMutation.mutate({
      title: businessName,
      value: 0,
      pipelineId: selectedPipeline.id,
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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">Deal Pipeline</h1>
            {/* Pipeline Selector */}
            <select
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
            >
              {allPipelines.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.profile_count || 0})
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowNewPipelineModal(true)}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-cyan-500 text-gray-400 hover:text-cyan-400 transition-colors"
              title="Create new pipeline"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            {activeDeals.length} active deals • {formatCurrency(totalValue)} total value
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors border border-gray-600"
            title="Export all deals to CSV"
          >
            <Download className="h-5 w-5" />
            Export CSV
          </button>
          <button 
            onClick={() => setShowBulkValueModal(true)}
            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <DollarSign className="h-5 w-5" />
            Set All Values
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Business
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-cyan-500/20 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-cyan-400">{leadDeals.length}</div>
              <div className="text-xs text-gray-500">New Leads</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-blue-400">{qualifiedDeals.length}</div>
              <div className="text-xs text-gray-500">Qualified</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-purple-400">{proposalDeals.length + negotiationDeals.length}</div>
              <div className="text-xs text-gray-500">In Progress</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-green-400">{closedDeals.length}</div>
              <div className="text-xs text-gray-500">Closed Won</div>
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
          {stages.map((stage: Stage) => {
            const stageDeals = dealsByStage[stage.id] || [];
            const stageValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0);
            const colors = getStageColor(stage.name);
            const stageIndex = stages.findIndex((s: Stage) => s.id === stage.id);
            
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
                        {(profile?.address || deal.company?.address) && (
                          <div className="flex items-start gap-2 text-gray-400 text-xs mb-1">
                            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-1">{profile?.address || deal.company?.address}</span>
                          </div>
                        )}
                        
                        {(deal.company?.phone || deal.lead?.phone) && (
                          <div className="flex items-center gap-2 text-gray-400 text-xs mb-2">
                            <Phone className="h-3 w-3 flex-shrink-0" />
                            <a 
                              href={`tel:${deal.company?.phone || deal.lead?.phone}`}
                              className="hover:text-cyan-400 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {deal.company?.phone || deal.lead?.phone}
                            </a>
                          </div>
                        )}

                        {/* Value - Click to edit */}
                        <button
                          onClick={() => handleEditValue(deal)}
                          className={`w-full text-left mt-2 p-2 rounded border border-dashed ${
                            deal.value > 0 
                              ? `${colors.border} ${colors.bg}` 
                              : 'border-gray-600 bg-gray-800/50'
                          } hover:border-cyan-500/50 transition-colors`}
                        >
                          {deal.value > 0 ? (
                            <div className={`text-lg font-bold ${colors.text}`}>
                              {formatCurrency(deal.value)}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Click to set value
                            </div>
                          )}
                        </button>

                        {/* Sequence Buttons - Click to view, long press to assign */}
                        {(() => {
                          const seqStatus = getDealSequenceStatus(deal.id);
                          
                          return (
                            <div className="flex gap-1 mt-2">
                              {/* Email Sequence Button */}
                              <button
                                onClick={() => {
                                  if (seqStatus.email) {
                                    // Has sequence - view it
                                    setViewingSequence({ sequence: seqStatus.email, type: 'email' });
                                  } else {
                                    // No sequence - assign one
                                    setSelectedDealForSequence(deal); 
                                    setShowSequenceModal(true);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setSelectedDealForSequence(deal); 
                                  setShowSequenceModal(true);
                                }}
                                title={seqStatus.email ? 'Click to view • Right-click to change' : 'Click to assign'}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                                  seqStatus.email
                                    ? 'bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/40'
                                    : 'bg-gray-700/50 text-gray-500 hover:text-cyan-400 hover:bg-gray-700'
                                }`}
                              >
                                <Mail className="h-3 w-3" />
                                {seqStatus.email && <Check className="h-2.5 w-2.5" />}
                              </button>

                              {/* DM Sequence Button */}
                              <button
                                onClick={() => {
                                  if (seqStatus.dm) {
                                    setViewingSequence({ sequence: seqStatus.dm, type: 'dm' });
                                  } else {
                                    setSelectedDealForSequence(deal); 
                                    setShowSequenceModal(true);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setSelectedDealForSequence(deal); 
                                  setShowSequenceModal(true);
                                }}
                                title={seqStatus.dm ? 'Click to view • Right-click to change' : 'Click to assign'}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                                  seqStatus.dm
                                    ? 'bg-purple-500/30 text-purple-400 border border-purple-500/50 hover:bg-purple-500/40'
                                    : 'bg-gray-700/50 text-gray-500 hover:text-purple-400 hover:bg-gray-700'
                                }`}
                              >
                                <MessageSquare className="h-3 w-3" />
                                {seqStatus.dm && <Check className="h-2.5 w-2.5" />}
                              </button>

                              {/* Call Sequence Button */}
                              <button
                                onClick={() => {
                                  if (seqStatus.call) {
                                    setViewingSequence({ sequence: seqStatus.call, type: 'call' });
                                  } else {
                                    setSelectedDealForSequence(deal); 
                                    setShowSequenceModal(true);
                                  }
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setSelectedDealForSequence(deal); 
                                  setShowSequenceModal(true);
                                }}
                                title={seqStatus.call ? 'Click to view • Right-click to change' : 'Click to assign'}
                                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors ${
                                  seqStatus.call
                                    ? 'bg-green-500/30 text-green-400 border border-green-500/50 hover:bg-green-500/40'
                                    : 'bg-gray-700/50 text-gray-500 hover:text-green-400 hover:bg-gray-700'
                                }`}
                              >
                                <PhoneCall className="h-3 w-3" />
                                {seqStatus.call && <Check className="h-2.5 w-2.5" />}
                              </button>
                            </div>
                          );
                        })()}

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
                          {/* Mark as Lost button - hide if already in Lost column */}
                          {stage.id !== 'lost' && (
                            <button
                              onClick={() => handleMarkLost(deal)}
                              title="Mark as Lost"
                              className="flex items-center justify-center gap-1 py-1.5 px-2 rounded text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
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

      {/* Value Edit Modal */}
      {showValueModal && selectedDealForValue && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowValueModal(false)}>
          <div 
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Set Deal Value</h3>
              <p className="text-sm text-gray-400 mt-1">{selectedDealForValue.title}</p>
            </div>
            <div className="p-4">
              <label className="block text-sm text-gray-400 mb-2">Deal Value (£)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="750"
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setDealValue('750')}
                  className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600"
                >
                  £750
                </button>
                <button
                  onClick={() => setDealValue('1000')}
                  className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600"
                >
                  £1,000
                </button>
                <button
                  onClick={() => setDealValue('1500')}
                  className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600"
                >
                  £1,500
                </button>
                <button
                  onClick={() => setDealValue('2500')}
                  className="px-3 py-1.5 rounded bg-gray-700 text-gray-300 text-sm hover:bg-gray-600"
                >
                  £2,500
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowValueModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveValue}
                disabled={updateValueMutation.isPending}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-medium"
              >
                {updateValueMutation.isPending ? 'Saving...' : 'Save Value'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Value Update Modal */}
      {showBulkValueModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowBulkValueModal(false)}>
          <div 
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Bulk Update Deal Values</h3>
              <p className="text-sm text-gray-400 mt-1">Set the same value for multiple deals at once</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Apply to</label>
                <select
                  value={bulkStage}
                  onChange={(e) => setBulkStage(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Deals ({deals.length})</option>
                  <option value="lead">Lead Stage ({leadDeals.length})</option>
                  <option value="qualified">Qualified Stage ({qualifiedDeals.length})</option>
                  <option value="negotiation">Negotiation Stage ({negotiationDeals.length})</option>
                  <option value="closed">Closed/Won Stage ({closedDeals.length})</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Deal Value (£)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">£</span>
                  <input
                    type="number"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder="750"
                    className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setBulkValue('750')}
                    className={`px-3 py-1.5 rounded text-sm ${bulkValue === '750' ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    £750
                  </button>
                  <button
                    onClick={() => setBulkValue('1000')}
                    className={`px-3 py-1.5 rounded text-sm ${bulkValue === '1000' ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    £1,000
                  </button>
                  <button
                    onClick={() => setBulkValue('1500')}
                    className={`px-3 py-1.5 rounded text-sm ${bulkValue === '1500' ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    £1,500
                  </button>
                  <button
                    onClick={() => setBulkValue('2500')}
                    className={`px-3 py-1.5 rounded text-sm ${bulkValue === '2500' ? 'bg-cyan-500 text-black' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    £2,500
                  </button>
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-400">
                  ⚠️ This will update {bulkStage === 'all' ? deals.length : bulkStage === 'lead' ? leadDeals.length : bulkStage === 'qualified' ? qualifiedDeals.length : bulkStage === 'negotiation' ? negotiationDeals.length : closedDeals.length} deals to £{bulkValue} each
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowBulkValueModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkUpdateMutation.mutate({ value: Number(bulkValue), stage: bulkStage })}
                disabled={bulkUpdateMutation.isPending || !bulkValue}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50"
              >
                {bulkUpdateMutation.isPending ? 'Updating...' : `Update ${bulkStage === 'all' ? 'All' : bulkStage.charAt(0).toUpperCase() + bulkStage.slice(1)} Deals`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Pipeline Modal */}
      {showNewPipelineModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowNewPipelineModal(false)}>
          <div 
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Create New Pipeline</h3>
              <p className="text-sm text-gray-400 mt-1">Create a separate pipeline for a new campaign</p>
            </div>
            <div className="p-4">
              <label className="block text-sm text-gray-400 mb-2">Pipeline Name</label>
              <input
                type="text"
                value={newPipelineName}
                onChange={(e) => setNewPipelineName(e.target.value)}
                placeholder="e.g., Electricians Preston, Plumbers Leeds"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                autoFocus
              />
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowNewPipelineModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => createPipelineMutation.mutate(newPipelineName)}
                disabled={createPipelineMutation.isPending || !newPipelineName.trim()}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-medium disabled:opacity-50"
              >
                {createPipelineMutation.isPending ? 'Creating...' : 'Create Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sequence Viewer Modal - Full Screen */}
      {viewingSequence && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4" onClick={() => setViewingSequence(null)}>
          <div 
            className={`bg-gray-900 border-2 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col ${
              viewingSequence.type === 'email' ? 'border-cyan-500' :
              viewingSequence.type === 'dm' ? 'border-purple-500' : 'border-green-500'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`p-5 border-b border-gray-700 flex items-center justify-between ${
              viewingSequence.type === 'email' ? 'bg-cyan-500/10' :
              viewingSequence.type === 'dm' ? 'bg-purple-500/10' : 'bg-green-500/10'
            }`}>
              <div className="flex items-center gap-3">
                {viewingSequence.type === 'email' && <Mail className="h-7 w-7 text-cyan-400" />}
                {viewingSequence.type === 'dm' && <MessageSquare className="h-7 w-7 text-purple-400" />}
                {viewingSequence.type === 'call' && <PhoneCall className="h-7 w-7 text-green-400" />}
                <div>
                  <h2 className="text-xl font-bold text-white">{viewingSequence.sequence.name}</h2>
                  <p className="text-sm text-gray-400 capitalize">{viewingSequence.type} Sequence • {viewingSequence.sequence.steps?.length || 0} steps</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingSequence(null)} 
                className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            {/* Steps Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {viewingSequence.sequence.steps?.map((step: any, idx: number) => (
                <div key={step.id} className={`p-4 rounded-xl border ${
                  viewingSequence.type === 'email' ? 'bg-gray-800/50 border-cyan-500/30' :
                  viewingSequence.type === 'dm' ? 'bg-gray-800/50 border-purple-500/30' : 'bg-gray-800/50 border-green-500/30'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      viewingSequence.type === 'email' ? 'bg-cyan-500/20' :
                      viewingSequence.type === 'dm' ? 'bg-purple-500/20' : 'bg-green-500/20'
                    }`}>
                      <span className={`text-lg font-bold ${
                        viewingSequence.type === 'email' ? 'text-cyan-400' :
                        viewingSequence.type === 'dm' ? 'text-purple-400' : 'text-green-400'
                      }`}>{idx + 1}</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-semibold text-white mb-2">{step.title}</div>
                      {step.type === 'wait' ? (
                        <div className="text-base text-orange-400 font-medium flex items-center gap-2">
                          <span className="text-xl">⏱</span> Wait {step.waitDays} days
                        </div>
                      ) : (
                        <div className="text-base text-gray-300 whitespace-pre-wrap select-text leading-relaxed bg-gray-900/50 p-3 rounded-lg">
                          {step.content}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-gray-700 bg-gray-800/50">
              <p className="text-sm text-gray-500 text-center">💡 You can select and copy any text from the steps above</p>
            </div>
          </div>
        </div>
      )}

      {/* Sequence Assignment Modal */}
      {showSequenceModal && selectedDealForSequence && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowSequenceModal(false)}>
          <div 
            className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Assign Sequences</h3>
              <p className="text-sm text-gray-400 mt-1">
                {selectedDealForSequence.title}
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Email Sequence */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-cyan-400" />
                  <label className="text-sm font-medium text-white">Email Sequence</label>
                </div>
                <select
                  value={dealSequences[selectedDealForSequence.id]?.email || ''}
                  onChange={(e) => handleAssignSequence(selectedDealForSequence.id, 'email', e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- No Email Sequence --</option>
                  {allSequences.filter((s: any) => s.type === 'email').map((seq: any) => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>
              </div>

              {/* DM Sequence */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-purple-400" />
                  <label className="text-sm font-medium text-white">DM Sequence</label>
                </div>
                <select
                  value={dealSequences[selectedDealForSequence.id]?.dm || ''}
                  onChange={(e) => handleAssignSequence(selectedDealForSequence.id, 'dm', e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- No DM Sequence --</option>
                  {allSequences.filter((s: any) => s.type === 'dm').map((seq: any) => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>
              </div>

              {/* Call Sequence */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PhoneCall className="h-4 w-4 text-green-400" />
                  <label className="text-sm font-medium text-white">Call Sequence</label>
                </div>
                <select
                  value={dealSequences[selectedDealForSequence.id]?.call || ''}
                  onChange={(e) => handleAssignSequence(selectedDealForSequence.id, 'call', e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-green-500"
                >
                  <option value="">-- No Call Sequence --</option>
                  {allSequences.filter((s: any) => s.type === 'call').map((seq: any) => (
                    <option key={seq.id} value={seq.id}>{seq.name}</option>
                  ))}
                </select>
              </div>

              {/* Quick tip */}
              <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 mt-4">
                <p className="text-xs text-gray-400">
                  💡 Go to <span className="text-cyan-400">Sequences</span> page to create and edit your Email, DM, and Call sequences.
                </p>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setShowSequenceModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-medium"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Deals;
