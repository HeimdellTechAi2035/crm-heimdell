import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Mail, Plus, Play, Pause, Users, Clock, Zap, ChevronRight, ArrowRight, Send } from 'lucide-react';

interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT';
  steps: SequenceStep[];
  enrolledCount: number;
  completedCount: number;
  replyRate?: number;
}

interface SequenceStep {
  id: string;
  type: 'EMAIL' | 'WAIT' | 'TASK';
  subject?: string;
  waitDays?: number;
  order: number;
}

const mockSequences: Sequence[] = [
  {
    id: '1',
    name: 'NEURAL OUTREACH ALPHA',
    description: 'Initial contact sequence for quantum computing leads',
    status: 'ACTIVE',
    enrolledCount: 127,
    completedCount: 45,
    replyRate: 32,
    steps: [
      { id: '1a', type: 'EMAIL', subject: 'Introduction to Quantum Solutions', order: 1 },
      { id: '1b', type: 'WAIT', waitDays: 3, order: 2 },
      { id: '1c', type: 'EMAIL', subject: 'Follow-up: Product Demo Invitation', order: 3 },
      { id: '1d', type: 'WAIT', waitDays: 5, order: 4 },
      { id: '1e', type: 'EMAIL', subject: 'Last Chance: Exclusive Offer', order: 5 },
    ],
  },
  {
    id: '2',
    name: 'REPLICANT NURTURE',
    description: 'Long-term nurture for biotech prospects',
    status: 'ACTIVE',
    enrolledCount: 89,
    completedCount: 23,
    replyRate: 28,
    steps: [
      { id: '2a', type: 'EMAIL', subject: 'Welcome to Tyrell Newsletter', order: 1 },
      { id: '2b', type: 'WAIT', waitDays: 7, order: 2 },
      { id: '2c', type: 'EMAIL', subject: 'Case Study: Nexus Project Success', order: 3 },
    ],
  },
  {
    id: '3',
    name: 'CYBERDYNE RE-ENGAGEMENT',
    description: 'Win-back sequence for dormant accounts',
    status: 'PAUSED',
    enrolledCount: 56,
    completedCount: 12,
    replyRate: 15,
    steps: [
      { id: '3a', type: 'EMAIL', subject: 'We Miss You at Cyberdyne', order: 1 },
      { id: '3b', type: 'WAIT', waitDays: 4, order: 2 },
      { id: '3c', type: 'EMAIL', subject: 'Special Offer Just for You', order: 3 },
    ],
  },
  {
    id: '4',
    name: 'APERTURE ONBOARDING',
    description: 'Welcome sequence for new customers',
    status: 'DRAFT',
    enrolledCount: 0,
    completedCount: 0,
    steps: [
      { id: '4a', type: 'EMAIL', subject: 'Welcome to Aperture Science', order: 1 },
      { id: '4b', type: 'WAIT', waitDays: 2, order: 2 },
      { id: '4c', type: 'TASK', order: 3 },
    ],
  },
];

export function Sequences() {
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: async () => {
      try {
        return await api.get('/sequences');
      } catch (e) {
        return { sequences: mockSequences };
      }
    },
    retry: false,
  });

  const sequences = data?.sequences || mockSequences;

  const getStatusColor = (status: string) => {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      ACTIVE: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
      PAUSED: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
      DRAFT: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
    };
    return colors[status] || colors.DRAFT;
  };

  const totalEnrolled = sequences.reduce((sum: number, s: Sequence) => sum + s.enrolledCount, 0);
  const activeSequences = sequences.filter((s: Sequence) => s.status === 'ACTIVE').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="hud-corner">
          <h1 className="text-4xl font-['Orbitron'] font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400">
            SEQUENCE MATRIX
          </h1>
          <p className="text-cyan-400/60 font-['Share_Tech_Mono'] text-sm mt-1 tracking-wider">
            AUTOMATED OUTREACH PROTOCOLS // NEURAL EMAIL SYSTEM
          </p>
        </div>
        <button className="cyber-btn px-6 py-3 flex items-center gap-3">
          <Plus className="h-5 w-5" />
          <span>NEW SEQUENCE</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'TOTAL SEQUENCES', value: sequences.length, icon: Mail, color: 'cyan' },
          { label: 'ACTIVE', value: activeSequences, icon: Play, color: 'green' },
          { label: 'ENROLLED LEADS', value: totalEnrolled, icon: Users, color: 'purple' },
          { label: 'AVG REPLY RATE', value: '28%', icon: Zap, color: 'orange' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="holo-card rounded-lg p-4">
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

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="cyber-spinner mx-auto mb-4" />
            <div className="font-['Orbitron'] text-cyan-400 text-sm tracking-widest">LOADING SEQUENCES...</div>
          </div>
        </div>
      ) : (
        /* Sequences Grid */
        <div className="grid gap-6 md:grid-cols-2">
          {sequences.map((sequence: Sequence) => {
            const statusColors = getStatusColor(sequence.status);
            return (
              <div
                key={sequence.id}
                onClick={() => setSelectedSequence(sequence)}
                className="holo-card rounded-lg overflow-hidden cursor-pointer cyber-card group"
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-['Orbitron'] text-lg text-cyan-400 group-hover:neon-text transition-all">
                          {sequence.name}
                        </h3>
                        <span className={`cyber-badge ${statusColors.text}`}>
                          {sequence.status === 'ACTIVE' && <span className="mr-1">●</span>}
                          {sequence.status}
                        </span>
                      </div>
                      {sequence.description && (
                        <p className="font-['Rajdhani'] text-sm text-cyan-400/50">{sequence.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-cyan-400/30 group-hover:text-cyan-400 transition-colors" />
                  </div>

                  {/* Steps Preview */}
                  <div className="flex items-center gap-2 mb-4 overflow-x-auto py-2">
                    {sequence.steps.map((step, i) => (
                      <div key={step.id} className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${
                          step.type === 'EMAIL' ? 'bg-cyan-500/10 border border-cyan-500/30' :
                          step.type === 'WAIT' ? 'bg-orange-500/10 border border-orange-500/30' :
                          'bg-purple-500/10 border border-purple-500/30'
                        }`}>
                          {step.type === 'EMAIL' ? <Send className="h-4 w-4 text-cyan-400" /> :
                           step.type === 'WAIT' ? <Clock className="h-4 w-4 text-orange-400" /> :
                           <Zap className="h-4 w-4 text-purple-400" />}
                        </div>
                        {i < sequence.steps.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-cyan-500/30" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 pt-4 border-t border-cyan-500/20">
                    <div className="text-center">
                      <div className="font-['Orbitron'] text-lg text-cyan-400">{sequence.steps.length}</div>
                      <div className="font-['Share_Tech_Mono'] text-[9px] text-cyan-400/40">STEPS</div>
                    </div>
                    <div className="text-center">
                      <div className="font-['Orbitron'] text-lg text-purple-400">{sequence.enrolledCount}</div>
                      <div className="font-['Share_Tech_Mono'] text-[9px] text-purple-400/40">ENROLLED</div>
                    </div>
                    <div className="text-center">
                      <div className="font-['Orbitron'] text-lg text-green-400">{sequence.replyRate || 0}%</div>
                      <div className="font-['Share_Tech_Mono'] text-[9px] text-green-400/40">REPLY RATE</div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {sequence.enrolledCount > 0 && (
                  <div className="px-5 pb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-['Share_Tech_Mono'] text-[10px] text-cyan-400/40">COMPLETION</span>
                      <span className="font-['Orbitron'] text-xs text-cyan-400">
                        {Math.round((sequence.completedCount / sequence.enrolledCount) * 100)}%
                      </span>
                    </div>
                    <div className="cyber-progress h-2 rounded-full">
                      <div 
                        className="cyber-progress-bar h-full rounded-full" 
                        style={{ width: `${(sequence.completedCount / sequence.enrolledCount) * 100}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sequence Detail Modal */}
      {selectedSequence && (
        <div className="fixed inset-0 cyber-modal-backdrop flex items-center justify-center z-50 p-4" onClick={() => setSelectedSequence(null)}>
          <div 
            className="holo-card rounded-lg w-full max-w-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="energy-bar" />
            
            <div className="p-6 border-b border-cyan-500/20 sticky top-0 bg-black/80 backdrop-blur-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-['Orbitron'] text-xl text-cyan-400 neon-text">
                      {selectedSequence.name}
                    </h2>
                    <span className={`cyber-badge ${getStatusColor(selectedSequence.status).text}`}>
                      {selectedSequence.status}
                    </span>
                  </div>
                  {selectedSequence.description && (
                    <p className="font-['Rajdhani'] text-cyan-400/60">{selectedSequence.description}</p>
                  )}
                </div>
                <button onClick={() => setSelectedSequence(null)} className="text-cyan-400/50 hover:text-cyan-400">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="data-panel rounded p-4 text-center">
                  <div className="stat-value text-2xl text-purple-400">{selectedSequence.enrolledCount}</div>
                  <div className="font-['Share_Tech_Mono'] text-[10px] text-purple-400/50">ENROLLED</div>
                </div>
                <div className="data-panel rounded p-4 text-center">
                  <div className="stat-value text-2xl text-green-400">{selectedSequence.completedCount}</div>
                  <div className="font-['Share_Tech_Mono'] text-[10px] text-green-400/50">COMPLETED</div>
                </div>
                <div className="data-panel rounded p-4 text-center">
                  <div className="stat-value text-2xl text-orange-400">{selectedSequence.replyRate || 0}%</div>
                  <div className="font-['Share_Tech_Mono'] text-[10px] text-orange-400/50">REPLY RATE</div>
                </div>
              </div>

              {/* Steps */}
              <div>
                <div className="font-['Orbitron'] text-xs text-cyan-400/50 mb-4 tracking-wider">SEQUENCE STEPS</div>
                <div className="space-y-3">
                  {selectedSequence.steps.map((step, i) => (
                    <div key={step.id} className="flex items-start gap-4">
                      {/* Step Number */}
                      <div className="w-8 h-8 rounded-full border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                        <span className="font-['Orbitron'] text-xs text-cyan-400">{i + 1}</span>
                      </div>
                      
                      {/* Step Content */}
                      <div className={`flex-1 data-panel rounded p-4 ${
                        step.type === 'EMAIL' ? 'border-l-2 border-l-cyan-400' :
                        step.type === 'WAIT' ? 'border-l-2 border-l-orange-400' :
                        'border-l-2 border-l-purple-400'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {step.type === 'EMAIL' && <Send className="h-4 w-4 text-cyan-400" />}
                          {step.type === 'WAIT' && <Clock className="h-4 w-4 text-orange-400" />}
                          {step.type === 'TASK' && <Zap className="h-4 w-4 text-purple-400" />}
                          <span className={`font-['Orbitron'] text-xs ${
                            step.type === 'EMAIL' ? 'text-cyan-400' :
                            step.type === 'WAIT' ? 'text-orange-400' : 'text-purple-400'
                          }`}>
                            {step.type}
                          </span>
                        </div>
                        {step.subject && (
                          <div className="font-['Rajdhani'] text-cyan-400/80">{step.subject}</div>
                        )}
                        {step.waitDays && (
                          <div className="font-['Share_Tech_Mono'] text-sm text-orange-400/80">
                            Wait {step.waitDays} days
                          </div>
                        )}
                        {step.type === 'TASK' && (
                          <div className="font-['Share_Tech_Mono'] text-sm text-purple-400/80">
                            Create follow-up task
                          </div>
                        )}
                      </div>

                      {/* Connector Line */}
                      {i < selectedSequence.steps.length - 1 && (
                        <div className="absolute left-[26px] top-8 w-0.5 h-full bg-cyan-500/20" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button className="cyber-btn flex-1 py-2 text-xs">EDIT SEQUENCE</button>
                {selectedSequence.status === 'ACTIVE' ? (
                  <button className="cyber-btn flex-1 py-2 text-xs" style={{ borderColor: 'rgb(249, 115, 22)', color: 'rgb(249, 115, 22)' }}>
                    <Pause className="h-3 w-3 mr-2 inline" />
                    PAUSE
                  </button>
                ) : (
                  <button className="cyber-btn flex-1 py-2 text-xs" style={{ borderColor: 'rgb(34, 197, 94)', color: 'rgb(34, 197, 94)' }}>
                    <Play className="h-3 w-3 mr-2 inline" />
                    ACTIVATE
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sequences;
