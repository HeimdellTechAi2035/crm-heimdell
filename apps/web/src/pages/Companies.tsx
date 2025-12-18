import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Search, Building2, Globe, MapPin, Users, Phone, Mail, ExternalLink, X, Hexagon, Activity } from 'lucide-react';

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
  createdAt: string;
  _count?: {
    leads: number;
    deals: number;
  };
}

// Mock data for dev mode
const mockCompanies: Company[] = [
  {
    id: '1',
    name: 'Cyberdyne Systems',
    website: 'https://cyberdyne.corp',
    industry: 'Neural Networks',
    location: 'Neo Tokyo, Sector 7',
    size: '5000-10000',
    phone: '+81 3 SKYNET',
    email: 'contact@cyberdyne.corp',
    createdAt: new Date().toISOString(),
    _count: { leads: 127, deals: 23 },
  },
  {
    id: '2',
    name: 'Tyrell Corporation',
    website: 'https://tyrell.replicant',
    industry: 'Bioengineering',
    location: 'Los Angeles, 2049',
    size: '10000+',
    phone: '+1 800 NEXUS-6',
    email: 'rachael@tyrell.replicant',
    createdAt: new Date().toISOString(),
    _count: { leads: 89, deals: 15 },
  },
  {
    id: '3',
    name: 'Weyland-Yutani',
    website: 'https://weyland-yutani.corp',
    industry: 'Space Colonization',
    location: 'Earth Orbital Station',
    size: '50000+',
    phone: '+1 BUILDING-WORLDS',
    email: 'corporate@wy.corp',
    createdAt: new Date().toISOString(),
    _count: { leads: 234, deals: 45 },
  },
  {
    id: '4',
    name: 'OCP - Omni Consumer',
    website: 'https://ocp.detroit',
    industry: 'Defense & Security',
    location: 'Delta City',
    size: '20000+',
    phone: '+1 ROBO-COP',
    email: 'directives@ocp.detroit',
    createdAt: new Date().toISOString(),
    _count: { leads: 156, deals: 31 },
  },
  {
    id: '5',
    name: 'Massive Dynamic',
    website: 'https://massive-dynamic.io',
    industry: 'Quantum Research',
    location: 'Boston, MA',
    size: '2000-5000',
    phone: '+1 555 FRINGE',
    email: 'nina@massive-dynamic.io',
    createdAt: new Date().toISOString(),
    _count: { leads: 67, deals: 12 },
  },
  {
    id: '6',
    name: 'Aperture Science',
    website: 'https://aperture.labs',
    industry: 'Portal Technology',
    location: 'Upper Michigan',
    size: '500-1000',
    phone: '+1 GLaDOS',
    email: 'testing@aperture.labs',
    createdAt: new Date().toISOString(),
    _count: { leads: 42, deals: 8 },
  },
];

export function Companies() {
  const [search, setSearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['companies', search],
    queryFn: async () => {
      try {
        return await api.get(`/companies?search=${search}`);
      } catch (e) {
        return { companies: mockCompanies.filter(c => 
          c.name.toLowerCase().includes(search.toLowerCase())
        )};
      }
    },
    retry: false,
  });

  const companies = data?.companies || mockCompanies;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
            CORPORATE REGISTRY
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            ENTITIES: <span className="text-cyan-400">{companies.length}</span> // SECTORS: MULTI-DIMENSIONAL
          </p>
        </div>
        <button className="cyber-btn px-6 py-3 flex items-center gap-3">
          <Plus className="h-5 w-5" />
          <span>REGISTER ENTITY</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="holo-card rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/50" />
          <input
            type="text"
            placeholder="Search corporate database..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="cyber-input w-full pl-12 pr-4 py-3 rounded font-['Rajdhani'] text-lg"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">SCANNING CORPORATE ARCHIVES...</div>
          </div>
        </div>
      ) : (
        /* Companies Grid */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {companies.map((company: Company, index: number) => (
            <div
              key={company.id}
              onClick={() => setSelectedCompany(company)}
              className="holo-card rounded-lg p-6 cursor-pointer cyber-card group relative overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Hexagon Pattern Background */}
              <div className="absolute inset-0 opacity-5">
                <Hexagon className="absolute -right-10 -top-10 h-40 w-40 text-cyan-400" />
              </div>
              
              {/* Header */}
              <div className="flex items-start justify-between mb-4 relative">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center group-hover:border-cyan-400/60 transition-all relative">
                    <Building2 className="h-7 w-7 text-cyan-400" />
                    <div className="absolute inset-0 bg-cyan-400/10 blur-xl group-hover:bg-cyan-400/20 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-['Orbitron'] text-lg text-cyan-400 group-hover:neon-text transition-all">
                      {company.name}
                    </h3>
                    {company.industry && (
                      <span className="font-['Share_Tech_Mono'] text-xs text-purple-400/70">
                        {company.industry.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                {company.location && (
                  <div className="flex items-center gap-3 text-cyan-400/70">
                    <MapPin className="h-4 w-4" />
                    <span className="font-['Rajdhani'] text-sm">{company.location}</span>
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-3 text-cyan-400/70">
                    <Globe className="h-4 w-4" />
                    <span className="font-['Share_Tech_Mono'] text-xs truncate">
                      {company.website.replace(/^https?:\/\//, '')}
                    </span>
                  </div>
                )}
                {company.size && (
                  <div className="flex items-center gap-3 text-cyan-400/70">
                    <Users className="h-4 w-4" />
                    <span className="font-['Rajdhani'] text-sm">{company.size} units</span>
                  </div>
                )}
              </div>

              {/* Stats Bar */}
              <div className="pt-4 border-t border-cyan-500/20 flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <div className="font-['Orbitron'] text-lg text-cyan-400">{company._count?.leads || 0}</div>
                    <div className="font-['Share_Tech_Mono'] text-[9px] text-cyan-400/40">LEADS</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-purple-500/10 flex items-center justify-center">
                    <Activity className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-['Orbitron'] text-lg text-purple-400">{company._count?.deals || 0}</div>
                    <div className="font-['Share_Tech_Mono'] text-[9px] text-purple-400/40">DEALS</div>
                  </div>
                </div>
              </div>

              {/* Hover Indicator */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {companies.length === 0 && !isLoading && (
        <div className="holo-card rounded-lg p-12 text-center">
          <Building2 className="h-16 w-16 mx-auto text-cyan-400/30 mb-4" />
          <h3 className="font-['Orbitron'] text-xl text-cyan-400 mb-2">NO ENTITIES FOUND</h3>
          <p className="text-cyan-400/50 font-['Rajdhani'] mb-6">Import data or register new corporate entities</p>
          <button className="cyber-btn px-6 py-3">
            <Plus className="h-4 w-4 mr-2 inline" />
            REGISTER ENTITY
          </button>
        </div>
      )}

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 cyber-modal-backdrop flex items-center justify-center z-50 p-4" onClick={() => setSelectedCompany(null)}>
          <div 
            className="holo-card rounded-lg w-full max-w-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar */}
            <div className="energy-bar" />
            
            {/* Modal Header */}
            <div className="p-6 border-b border-cyan-500/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-cyan-400" />
                  </div>
                  <div>
                    <h2 className="font-['Orbitron'] text-2xl text-cyan-400 neon-text">
                      {selectedCompany.name}
                    </h2>
                    {selectedCompany.industry && (
                      <span className="font-['Share_Tech_Mono'] text-sm text-purple-400">
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
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {selectedCompany.location && (
                  <div className="data-panel rounded p-4">
                    <div className="flex items-center gap-3 text-cyan-400">
                      <MapPin className="h-5 w-5" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">LOCATION</div>
                        <div className="font-['Rajdhani']">{selectedCompany.location}</div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedCompany.website && (
                  <div className="data-panel rounded p-4">
                    <div className="flex items-center gap-3 text-cyan-400">
                      <Globe className="h-5 w-5" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">NETWORK</div>
                        <a 
                          href={selectedCompany.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-['Rajdhani'] hover:text-cyan-300 flex items-center gap-1"
                        >
                          {selectedCompany.website.replace(/^https?:\/\//, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {selectedCompany.phone && (
                  <div className="data-panel rounded p-4">
                    <div className="flex items-center gap-3 text-cyan-400">
                      <Phone className="h-5 w-5" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">COMM LINK</div>
                        <div className="font-['Rajdhani']">{selectedCompany.phone}</div>
                      </div>
                    </div>
                  </div>
                )}
                {selectedCompany.email && (
                  <div className="data-panel rounded p-4">
                    <div className="flex items-center gap-3 text-cyan-400">
                      <Mail className="h-5 w-5" />
                      <div>
                        <div className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/50">DATA LINK</div>
                        <a href={`mailto:${selectedCompany.email}`} className="font-['Rajdhani'] hover:text-cyan-300">
                          {selectedCompany.email}
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="holo-card rounded p-4 text-center">
                  <div className="stat-value text-3xl text-cyan-400">{selectedCompany._count?.leads || 0}</div>
                  <div className="font-['Orbitron'] text-[10px] text-cyan-400/50 tracking-wider">LEADS</div>
                </div>
                <div className="holo-card rounded p-4 text-center">
                  <div className="stat-value text-3xl text-purple-400">{selectedCompany._count?.deals || 0}</div>
                  <div className="font-['Orbitron'] text-[10px] text-purple-400/50 tracking-wider">DEALS</div>
                </div>
                <div className="holo-card rounded p-4 text-center">
                  <div className="stat-value text-3xl text-green-400">{selectedCompany.size || 'N/A'}</div>
                  <div className="font-['Orbitron'] text-[10px] text-green-400/50 tracking-wider">UNITS</div>
                </div>
              </div>

              {/* Notes */}
              {selectedCompany.notes && (
                <div className="data-panel rounded p-4">
                  <div className="font-['Orbitron'] text-xs text-cyan-400/50 mb-2 tracking-wider">INTEL NOTES</div>
                  <p className="font-['Rajdhani'] text-cyan-400/80">{selectedCompany.notes}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-cyan-500/20 flex justify-end gap-3">
              <button className="cyber-btn px-4 py-2 text-xs">VIEW LEADS</button>
              <button className="cyber-btn px-4 py-2 text-xs" style={{ borderColor: 'rgb(168, 85, 247)', color: 'rgb(168, 85, 247)' }}>VIEW DEALS</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Companies;
