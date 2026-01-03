import { useState, memo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Plus, Search, Phone, Globe, MapPin, Star, TrendingUp, Filter, ExternalLink, Trash2 } from 'lucide-react';

export const Leads = memo(function Leads() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['leads', search],
    queryFn: () => api.getLeads({ search }),
    staleTime: 0, // Always refetch
  });
  
  const allLeads = data?.leads || [];
  
  // Filter by category
  const leads = categoryFilter === 'all' 
    ? allLeads 
    : allLeads.filter((lead: any) => lead.profileJson?.category === categoryFilter);

  // Get unique categories
  const categories: string[] = ['all', ...new Set(allLeads.map((l: any) => l.profileJson?.category).filter(Boolean) as string[])];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteLead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete "${name}" from LEADS, COMPANIES, and DEALS?`)) {
      deleteMutation.mutate(id);
    }
  };

  const getCategoryColor = useCallback((category: string) => {
    const colors: Record<string, string> = {
      'Electrician': 'border-yellow-400 text-yellow-400 bg-yellow-400/10',
      'Plumber': 'border-blue-400 text-blue-400 bg-blue-400/10',
      'Roofer': 'border-orange-400 text-orange-400 bg-orange-400/10',
      'Joiner': 'border-green-400 text-green-400 bg-green-400/10',
    };
    return colors[category] || 'border-cyan-400 text-cyan-400 bg-cyan-400/10';
  }, []);

  const getRatingStars = (rating: number) => {
    return '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            BUSINESS DATABASE
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            TOTAL: <span className="text-cyan-400">{allLeads.length}</span> // SHOWING: <span className="text-cyan-400">{leads.length}</span>
          </p>
        </div>
        <button 
          onClick={() => navigate('/imports')}
          className="cyber-btn px-6 py-3 flex items-center gap-3"
        >
          <Plus className="h-5 w-5" />
          <span>IMPORT MORE</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="holo-card rounded-lg p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/50" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="cyber-input w-full pl-12 pr-4 py-3 rounded font-['Rajdhani'] text-lg"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 rounded font-['Orbitron'] text-xs tracking-wider transition-all ${
                  categoryFilter === cat
                    ? 'bg-cyan-400 text-black'
                    : 'border border-cyan-500/30 text-cyan-400 hover:bg-cyan-400/10'
                }`}
              >
                {cat === 'all' ? 'ALL' : cat.toUpperCase()}
                {cat !== 'all' && (
                  <span className="ml-2 opacity-60">
                    ({allLeads.filter((l: any) => l.profileJson?.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">LOADING...</div>
          </div>
        </div>
      ) : (
        /* Leads Grid */
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead: any) => {
            const profile = lead.profileJson || {};
            const rating = profile.rating || 0;
            const reviews = profile.reviewCount || 0;
            const marketShare = profile.marketShare || 0;
            const position = profile.averagePosition || profile.ranking || 0;
            const category = profile.category || lead.title || 'Business';
            const mapsUrl = profile.googleMapsUrl || profile.mapUrl || '';
            const website = profile.website || lead.website || lead.company?.website || '';
            // Multiple fallbacks for business name
            const businessName = profile.businessName || lead.name || lead.firstName || 'Unknown Business';
            
            return (
              <div
                key={lead.id}
                className="holo-card rounded-lg p-5 cyber-card group hover:border-cyan-400/50 transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-['Orbitron'] text-lg text-cyan-400 group-hover:neon-text transition-all truncate">
                      {businessName}
                    </h3>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-['Share_Tech_Mono'] ${getCategoryColor(category)}`}>
                      {category}
                    </span>
                  </div>
                  {rating > 0 && (
                    <div className="text-right ml-2">
                      <div className="text-yellow-400 font-bold text-lg">{rating}</div>
                      <div className="text-yellow-400/60 text-xs">{getRatingStars(rating)}</div>
                    </div>
                  )}
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-black/30 rounded p-2 text-center">
                    <div className="text-cyan-400 font-bold text-lg">{reviews}</div>
                    <div className="text-cyan-400/50 text-[10px] font-['Share_Tech_Mono']">REVIEWS</div>
                  </div>
                  <div className="bg-black/30 rounded p-2 text-center">
                    <div className="text-green-400 font-bold text-lg">#{position || '-'}</div>
                    <div className="text-green-400/50 text-[10px] font-['Share_Tech_Mono']">RANK</div>
                  </div>
                  <div className="bg-black/30 rounded p-2 text-center">
                    <div className="text-purple-400 font-bold text-lg">{marketShare}%</div>
                    <div className="text-purple-400/50 text-[10px] font-['Share_Tech_Mono']">MARKET</div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2 mb-4">
                  {profile.address && (
                    <div className="flex items-start gap-2 text-cyan-400/70">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span className="font-['Rajdhani'] text-sm line-clamp-2">{profile.address}</span>
                    </div>
                  )}
                  
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-cyan-400/70">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <a href={`tel:${lead.phone}`} className="font-['Rajdhani'] text-sm hover:text-cyan-400">
                        {lead.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-cyan-500/10">
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all text-xs font-['Share_Tech_Mono']"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MapPin className="h-3 w-3" />
                      MAPS
                    </a>
                  )}
                  {website && (
                    <a
                      href={website.startsWith('http') ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all text-xs font-['Share_Tech_Mono']"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Globe className="h-3 w-3" />
                      WEBSITE
                    </a>
                  )}
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all text-xs font-['Share_Tech_Mono']"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3" />
                      CALL
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(lead.id, profile.businessName || lead.firstName || 'this record');
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all text-xs font-['Share_Tech_Mono']"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && leads.length === 0 && (
        <div className="text-center py-20">
          <div className="text-cyan-400/50 font-['Orbitron'] text-lg">NO BUSINESSES FOUND</div>
          <p className="text-cyan-400/30 font-['Share_Tech_Mono'] mt-2">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
});
