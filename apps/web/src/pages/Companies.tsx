import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Search, Building2, Globe, MapPin, Phone, Star, ExternalLink, X, TrendingUp, MessageSquare, Map, Trash2 } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  location?: string;
  size?: string;
  phone?: string;
  email?: string;
  notes?: string;
  profileJson?: any;
  createdAt: string;
  _count?: {
    leads: number;
    deals: number;
  };
}

const categoryColors: Record<string, string> = {
  ELECTRICIAN: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  PLUMBER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ROOFER: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  JOINER: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function Companies() {
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      return await api.get(`/companies?search=${search}`);
    },
  });

  const allCompanies = data?.companies || [];
  
  // Filter by category
  const companies = useMemo(() => {
    if (categoryFilter === 'ALL') return allCompanies;
    return allCompanies.filter((c: Company) => c.industry?.toUpperCase() === categoryFilter);
  }, [allCompanies, categoryFilter]);

  // Count by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allCompanies.length };
    allCompanies.forEach((c: Company) => {
      const cat = c.industry?.toUpperCase() || 'OTHER';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [allCompanies]);

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />);
      } else if (i === fullStars && hasHalf) {
        stars.push(<Star key={i} className="h-4 w-4 fill-yellow-400/50 text-yellow-400" />);
      } else {
        stars.push(<Star key={i} className="h-4 w-4 text-gray-600" />);
      }
    }
    return stars;
  };

  const getProfile = (company: Company) => {
    if (!company.profileJson) return null;
    try {
      return typeof company.profileJson === 'string' ? JSON.parse(company.profileJson) : company.profileJson;
    } catch { return null; }
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCompany(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedCompany(null);
    },
  });

  const handleDelete = (id: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Delete "${name}" from COMPANIES, LEADS, and DEALS?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Companies</h1>
          <p className="text-gray-400 text-sm mt-1">
            {companies.length} businesses {categoryFilter !== 'ALL' && `in ${categoryFilter.toLowerCase()}`}
          </p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {['ALL', 'ELECTRICIAN', 'PLUMBER', 'ROOFER', 'JOINER'].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              categoryFilter === cat
                ? 'bg-cyan-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search companies by name, location, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 text-white pl-12 pr-4 py-3 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4" />
            <div className="text-gray-400">Loading companies...</div>
          </div>
        </div>
      ) : (
        /* Companies Grid */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: Company) => {
            const profile = getProfile(company);
            const rating = profile?.rating || 0;
            const reviews = profile?.review_count || 0;
            const rank = profile?.average_position || null;
            const marketShare = profile?.market_share || null;
            const mapsUrl = profile?.google_maps_url;

            return (
              <div
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className="bg-gray-800/50 rounded-lg p-5 border border-gray-700 hover:border-cyan-500/50 cursor-pointer transition-all"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate text-lg">{company.name}</h3>
                    {company.industry && (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 border ${categoryColors[company.industry.toUpperCase()] || 'bg-gray-600 text-gray-300'}`}>
                        {company.industry.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {rating > 0 && (
                    <div className="flex items-center gap-1 bg-gray-900 px-2 py-1 rounded">
                      <span className="text-yellow-400 font-bold">{rating.toFixed(1)}</span>
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    </div>
                  )}
                </div>

                {/* Rating Stars */}
                {rating > 0 && (
                  <div className="flex items-center gap-1 mb-3">
                    {renderStars(rating)}
                    <span className="text-gray-400 text-sm ml-2">({reviews} reviews)</span>
                  </div>
                )}

                {/* Stats */}
                {(rank || marketShare) && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {rank && (
                      <div className="bg-gray-900 rounded p-2 text-center">
                        <div className="text-cyan-400 font-bold text-lg">#{Math.round(rank)}</div>
                        <div className="text-gray-500 text-xs">Rank</div>
                      </div>
                    )}
                    {marketShare && (
                      <div className="bg-gray-900 rounded p-2 text-center">
                        <div className="text-green-400 font-bold text-lg">{marketShare}%</div>
                        <div className="text-gray-500 text-xs">Market Share</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-2 text-sm mb-4">
                  {company.location && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{company.location}</span>
                    </div>
                  )}
                  {company.phone && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-3 border-t border-gray-700">
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Map className="h-3 w-3" /> MAPS
                    </a>
                  )}
                  {company.website && (
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Globe className="h-3 w-3" /> WEBSITE
                    </a>
                  )}
                  {company.phone && (
                    <a
                      href={`tel:${company.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
                    >
                      <Phone className="h-3 w-3" /> CALL
                    </a>
                  )}
                  <button
                    onClick={(e) => handleDelete(company.id, company.name, e)}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs py-2 px-3 rounded flex items-center justify-center gap-1 transition-colors"
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
      {companies.length === 0 && !isLoading && (
        <div className="bg-gray-800/50 rounded-lg p-12 text-center border border-gray-700">
          <Building2 className="h-16 w-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl text-white mb-2">No companies found</h3>
          <p className="text-gray-400">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedCompany(null)}>
          <div 
            className="bg-gray-900 rounded-lg w-full max-w-2xl relative overflow-hidden border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-gray-800 border border-gray-600 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {selectedCompany.name}
                    </h2>
                    {selectedCompany.industry && (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 border ${categoryColors[selectedCompany.industry.toUpperCase()] || 'bg-gray-600 text-gray-300'}`}>
                        {selectedCompany.industry.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedCompany(null)}
                  className="w-10 h-10 rounded border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-cyan-400/10 hover:border-cyan-400/50 transition-all"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {(() => {
                const profile = getProfile(selectedCompany);
                const rating = profile?.rating || 0;
                const reviews = profile?.review_count || 0;
                const rank = profile?.average_position || null;
                const marketShare = profile?.market_share || null;
                const mapsUrl = profile?.google_maps_url;
                
                return (
                  <>
                    {/* Rating Section */}
                    {rating > 0 && (
                      <div className="bg-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-3xl font-bold text-yellow-400">{rating.toFixed(1)}</div>
                            <div className="flex items-center gap-1 mt-1">
                              {renderStars(rating)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-gray-300">
                              <MessageSquare className="h-5 w-5" />
                              <span className="text-2xl font-bold">{reviews}</span>
                            </div>
                            <div className="text-gray-500 text-sm">reviews</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      {rank && (
                        <div className="bg-gray-800 rounded-lg p-4 text-center">
                          <TrendingUp className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-cyan-400">#{Math.round(rank)}</div>
                          <div className="text-gray-500 text-sm">Search Rank</div>
                        </div>
                      )}
                      {marketShare && (
                        <div className="bg-gray-800 rounded-lg p-4 text-center">
                          <Building2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                          <div className="text-2xl font-bold text-green-400">{marketShare}%</div>
                          <div className="text-gray-500 text-sm">Market Share</div>
                        </div>
                      )}
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-3">
                      {selectedCompany.location && (
                        <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                          <MapPin className="h-5 w-5 text-gray-400" />
                          <span className="text-white">{selectedCompany.location}</span>
                        </div>
                      )}
                      {selectedCompany.phone && (
                        <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                          <Phone className="h-5 w-5 text-gray-400" />
                          <a href={`tel:${selectedCompany.phone}`} className="text-cyan-400 hover:text-cyan-300">
                            {selectedCompany.phone}
                          </a>
                        </div>
                      )}
                      {selectedCompany.website && (
                        <div className="flex items-center gap-3 bg-gray-800 rounded-lg p-3">
                          <Globe className="h-5 w-5 text-gray-400" />
                          <a 
                            href={selectedCompany.website.startsWith('http') ? selectedCompany.website : `https://${selectedCompany.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                          >
                            {selectedCompany.website.replace(/^https?:\/\//, '')}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-700">
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                          <Map className="h-5 w-5" /> Open in Google Maps
                        </a>
                      )}
                      {selectedCompany.phone && (
                        <a
                          href={`tel:${selectedCompany.phone}`}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                          <Phone className="h-5 w-5" /> Call Now
                        </a>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Companies;
