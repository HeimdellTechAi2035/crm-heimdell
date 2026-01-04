import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { 
  Mail, Plus, Play, Pause, Users, Clock, Zap, ChevronRight, 
  Send, Phone, MessageSquare, Edit2, Trash2, Save, X, 
  ChevronDown, ChevronUp
} from 'lucide-react';

// Sequence Types
type SequenceType = 'email' | 'dm' | 'call';
type SequenceStatus = 'active' | 'paused' | 'draft';

interface SequenceStep {
  id: string;
  type: 'message' | 'wait' | 'task';
  title: string;
  content: string;
  waitDays?: number;
  order: number;
}

interface Sequence {
  id: string;
  name: string;
  type: SequenceType;
  description: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  enrolledCount: number;
  completedCount: number;
  replyRate: number;
  createdAt: string;
  updatedAt: string;
}

// Demo data for sequences
const defaultSequences: Sequence[] = [
  {
    id: 'seq-email-1',
    name: 'New Lead Welcome',
    type: 'email',
    description: 'Initial outreach sequence for new leads',
    status: 'active',
    steps: [
      { id: 'step-1', type: 'message', title: 'Introduction Email', content: 'Hi {{name}},\n\nI noticed your business {{company}} and wanted to reach out...', order: 1 },
      { id: 'step-2', type: 'wait', title: 'Wait Period', content: '', waitDays: 3, order: 2 },
      { id: 'step-3', type: 'message', title: 'Follow Up', content: 'Hi {{name}},\n\nJust following up on my previous email...', order: 3 },
      { id: 'step-4', type: 'wait', title: 'Wait Period', content: '', waitDays: 5, order: 4 },
      { id: 'step-5', type: 'message', title: 'Final Touch', content: 'Hi {{name}},\n\nI wanted to reach out one more time...', order: 5 },
    ],
    enrolledCount: 45,
    completedCount: 32,
    replyRate: 18,
    createdAt: '2025-12-01',
    updatedAt: '2026-01-02',
  },
  {
    id: 'seq-dm-1',
    name: 'LinkedIn Outreach',
    type: 'dm',
    description: 'Direct message sequence for LinkedIn connections',
    status: 'active',
    steps: [
      { id: 'step-1', type: 'message', title: 'Connection Request', content: 'Hi {{name}}, I came across your profile and would love to connect...', order: 1 },
      { id: 'step-2', type: 'wait', title: 'Wait Period', content: '', waitDays: 2, order: 2 },
      { id: 'step-3', type: 'message', title: 'Value Message', content: 'Thanks for connecting! I wanted to share something that might help your business...', order: 3 },
    ],
    enrolledCount: 28,
    completedCount: 20,
    replyRate: 25,
    createdAt: '2025-12-15',
    updatedAt: '2026-01-01',
  },
  {
    id: 'seq-call-1',
    name: 'Phone Follow-up',
    type: 'call',
    description: 'Call sequence for warm leads',
    status: 'paused',
    steps: [
      { id: 'step-1', type: 'message', title: 'Initial Call', content: 'Script: Introduce yourself, ask about their current situation, listen for pain points...', order: 1 },
      { id: 'step-2', type: 'wait', title: 'Wait Period', content: '', waitDays: 1, order: 2 },
      { id: 'step-3', type: 'task', title: 'Send Quote', content: 'Prepare and send a custom quote based on the call discussion', order: 3 },
      { id: 'step-4', type: 'wait', title: 'Wait Period', content: '', waitDays: 2, order: 4 },
      { id: 'step-5', type: 'message', title: 'Follow-up Call', content: 'Script: Check if they received the quote, address any questions...', order: 5 },
    ],
    enrolledCount: 12,
    completedCount: 8,
    replyRate: 42,
    createdAt: '2025-12-20',
    updatedAt: '2025-12-28',
  },
];

// Get stored sequences from localStorage or use defaults
function getStoredSequences(): Sequence[] {
  const stored = localStorage.getItem('heimdell-sequences');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return defaultSequences;
    }
  }
  return defaultSequences;
}

function saveSequences(sequences: Sequence[]) {
  localStorage.setItem('heimdell-sequences', JSON.stringify(sequences));
}

export function Sequences() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<SequenceType | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);

  // Fetch sequences
  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => Promise.resolve(getStoredSequences()),
  });

  // Create sequence mutation
  const createMutation = useMutation({
    mutationFn: (newSeq: Partial<Sequence>) => {
      const all = getStoredSequences();
      const seq: Sequence = {
        id: `seq-${Date.now()}`,
        name: newSeq.name || 'New Sequence',
        type: newSeq.type || 'email',
        description: newSeq.description || '',
        status: 'draft',
        steps: [],
        enrolledCount: 0,
        completedCount: 0,
        replyRate: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      all.push(seq);
      saveSequences(all);
      return Promise.resolve(seq);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setShowCreateModal(false);
    },
  });

  // Update sequence mutation
  const updateMutation = useMutation({
    mutationFn: (updated: Sequence) => {
      const all = getStoredSequences();
      const idx = all.findIndex(s => s.id === updated.id);
      if (idx >= 0) {
        all[idx] = { ...updated, updatedAt: new Date().toISOString() };
        saveSequences(all);
      }
      return Promise.resolve(updated);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setEditingSequence(null);
    },
  });

  // Delete sequence mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      const all = getStoredSequences().filter(s => s.id !== id);
      saveSequences(all);
      return Promise.resolve(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
  });

  // Toggle sequence status
  const toggleStatus = (seq: Sequence) => {
    const newStatus: SequenceStatus = seq.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ ...seq, status: newStatus });
  };

  // Filter sequences by type
  const filteredSequences = selectedType === 'all' 
    ? sequences 
    : sequences.filter(s => s.type === selectedType);

  // Stats
  const totalSequences = sequences.length;
  const activeSequences = sequences.filter(s => s.status === 'active').length;
  const totalEnrolled = sequences.reduce((sum, s) => sum + s.enrolledCount, 0);
  const avgReplyRate = sequences.length > 0 
    ? Math.round(sequences.reduce((sum, s) => sum + s.replyRate, 0) / sequences.length) 
    : 0;

  // Type config
  const typeConfig: Record<SequenceType, { icon: typeof Mail; color: string; label: string; bgColor: string }> = {
    email: { icon: Mail, color: 'text-cyan-400', label: 'Email', bgColor: 'bg-cyan-500/10' },
    dm: { icon: MessageSquare, color: 'text-purple-400', label: 'DM', bgColor: 'bg-purple-500/10' },
    call: { icon: Phone, color: 'text-green-400', label: 'Call', bgColor: 'bg-green-500/10' },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Sequences</h1>
          <p className="text-gray-400 text-sm mt-1">
            Automated outreach campaigns for Email, DMs, and Calls
          </p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Sequence
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-cyan-500/20 flex items-center justify-center">
              <Mail className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-cyan-400">{totalSequences}</div>
              <div className="text-xs text-gray-500">Total Sequences</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-green-500/20 flex items-center justify-center">
              <Play className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-green-400">{activeSequences}</div>
              <div className="text-xs text-gray-500">Active</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-purple-500/20 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-purple-400">{totalEnrolled}</div>
              <div className="text-xs text-gray-500">Enrolled Leads</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-orange-500/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <div className="text-xl font-bold text-orange-400">{avgReplyRate}%</div>
              <div className="text-xs text-gray-500">Avg Reply Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectedType === 'all' 
              ? 'bg-gray-700 text-white' 
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All ({sequences.length})
        </button>
        {(Object.keys(typeConfig) as SequenceType[]).map((type) => {
          const config = typeConfig[type];
          const count = sequences.filter(s => s.type === type).length;
          const Icon = config.icon;
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                selectedType === type 
                  ? `${config.bgColor} ${config.color}` 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {config.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Sequences List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading sequences...</div>
      ) : filteredSequences.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No sequences yet</h3>
          <p className="text-gray-500 mb-4">Create your first outreach sequence to get started</p>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-2 rounded-lg font-medium"
          >
            Create Sequence
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSequences.map((sequence) => {
            const config = typeConfig[sequence.type];
            const Icon = config.icon;
            const isExpanded = expandedSequence === sequence.id;
            
            return (
              <div 
                key={sequence.id}
                className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
              >
                {/* Sequence Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-800/70 transition-colors"
                  onClick={() => setExpandedSequence(isExpanded ? null : sequence.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">{sequence.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            sequence.status === 'active' ? 'bg-green-500/20 text-green-400' :
                            sequence.status === 'paused' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-gray-600 text-gray-300'
                          }`}>
                            {sequence.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400">{sequence.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-lg font-bold text-white">{sequence.steps.length}</div>
                        <div className="text-xs text-gray-500">Steps</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-400">{sequence.enrolledCount}</div>
                        <div className="text-xs text-gray-500">Enrolled</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-400">{sequence.replyRate}%</div>
                        <div className="text-xs text-gray-500">Reply Rate</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleStatus(sequence); }}
                          className={`p-2 rounded-lg transition-colors ${
                            sequence.status === 'active'
                              ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          }`}
                          title={sequence.status === 'active' ? 'Pause' : 'Activate'}
                        >
                          {sequence.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingSequence(sequence); }}
                          className="p-2 rounded-lg bg-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (confirm('Delete this sequence?')) {
                              deleteMutation.mutate(sequence.id);
                            }
                          }}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Steps View */}
                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 bg-gray-900/50">
                    <div className="text-sm text-gray-400 mb-4">Sequence Steps:</div>
                    <div className="space-y-3">
                      {sequence.steps.map((step, idx) => (
                        <div key={step.id} className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-white">{idx + 1}</span>
                          </div>
                          <div className={`flex-1 p-3 rounded-lg border-l-2 ${
                            step.type === 'message' ? 'bg-cyan-500/10 border-cyan-400' :
                            step.type === 'wait' ? 'bg-orange-500/10 border-orange-400' :
                            'bg-purple-500/10 border-purple-400'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              {step.type === 'message' && <Send className="h-4 w-4 text-cyan-400" />}
                              {step.type === 'wait' && <Clock className="h-4 w-4 text-orange-400" />}
                              {step.type === 'task' && <Zap className="h-4 w-4 text-purple-400" />}
                              <span className="font-medium text-white">{step.title}</span>
                            </div>
                            {step.type === 'wait' ? (
                              <p className="text-sm text-orange-400">Wait {step.waitDays} days</p>
                            ) : (
                              <p className="text-sm text-gray-400 line-clamp-2">{step.content}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {sequence.steps.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No steps yet. Edit to add steps.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Sequence Modal */}
      {showCreateModal && (
        <CreateSequenceModal 
          onClose={() => setShowCreateModal(false)}
          onCreate={(data) => createMutation.mutate(data)}
        />
      )}

      {/* Edit Sequence Modal */}
      {editingSequence && (
        <EditSequenceModal 
          sequence={editingSequence}
          onClose={() => setEditingSequence(null)}
          onSave={(updated) => updateMutation.mutate(updated)}
        />
      )}
    </div>
  );
}

// Create Sequence Modal Component
function CreateSequenceModal({ onClose, onCreate }: { 
  onClose: () => void; 
  onCreate: (data: Partial<Sequence>) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<SequenceType>('email');
  const [description, setDescription] = useState('');

  const typeConfig: Record<SequenceType, { icon: typeof Mail; color: string; label: string }> = {
    email: { icon: Mail, color: 'text-cyan-400', label: 'Email Sequence' },
    dm: { icon: MessageSquare, color: 'text-purple-400', label: 'DM Sequence' },
    call: { icon: Phone, color: 'text-green-400', label: 'Call Sequence' },
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Create New Sequence</h2>
          <p className="text-sm text-gray-400 mt-1">Set up an automated outreach campaign</p>
        </div>
        
        <div className="p-4 space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sequence Type</label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(typeConfig) as SequenceType[]).map((t) => {
                const config = typeConfig[t];
                const Icon = config.icon;
                return (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`p-3 rounded-lg border transition-all ${
                      type === t 
                        ? 'border-cyan-500 bg-cyan-500/10' 
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mx-auto mb-2 ${config.color}`} />
                    <div className="text-sm text-white">{config.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sequence Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Lead Welcome"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this sequence for?"
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate({ name, type, description })}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-medium disabled:opacity-50"
          >
            Create Sequence
          </button>
        </div>
      </div>
    </div>
  );
}

// Edit Sequence Modal Component
function EditSequenceModal({ sequence, onClose, onSave }: {
  sequence: Sequence;
  onClose: () => void;
  onSave: (updated: Sequence) => void;
}) {
  const [name, setName] = useState(sequence.name);
  const [description, setDescription] = useState(sequence.description);
  const [steps, setSteps] = useState<SequenceStep[]>(sequence.steps);

  const addStep = (type: 'message' | 'wait' | 'task') => {
    const newStep: SequenceStep = {
      id: `step-${Date.now()}`,
      type,
      title: type === 'message' ? 'New Message' : type === 'wait' ? 'Wait Period' : 'New Task',
      content: '',
      waitDays: type === 'wait' ? 3 : undefined,
      order: steps.length + 1,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id: string, updates: Partial<SequenceStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })));
  };

  const moveStep = (id: string, direction: 'up' | 'down') => {
    const idx = steps.findIndex(s => s.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === steps.length - 1)) return;
    
    const newSteps = [...steps];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newSteps[idx], newSteps[swapIdx]] = [newSteps[swapIdx], newSteps[idx]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleSave = () => {
    onSave({ ...sequence, name, description, steps });
  };

  const typeConfig = {
    email: { label: 'Email', placeholder: 'Email content...' },
    dm: { label: 'DM', placeholder: 'Direct message content...' },
    call: { label: 'Call', placeholder: 'Call script or notes...' },
  };
  const config = typeConfig[sequence.type];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Edit Sequence</h2>
              <p className="text-sm text-gray-400 mt-1">Configure your {config.label.toLowerCase()} sequence</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Sequence Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm text-gray-400">Sequence Steps</label>
              <div className="flex gap-2">
                <button
                  onClick={() => addStep('message')}
                  className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/30 flex items-center gap-1"
                >
                  <Send className="h-3 w-3" /> Add {config.label}
                </button>
                <button
                  onClick={() => addStep('wait')}
                  className="px-3 py-1 rounded bg-orange-500/20 text-orange-400 text-xs hover:bg-orange-500/30 flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" /> Add Wait
                </button>
                <button
                  onClick={() => addStep('task')}
                  className="px-3 py-1 rounded bg-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/30 flex items-center gap-1"
                >
                  <Zap className="h-3 w-3" /> Add Task
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div 
                  key={step.id}
                  className={`p-4 rounded-lg border ${
                    step.type === 'message' ? 'border-cyan-500/30 bg-cyan-500/5' :
                    step.type === 'wait' ? 'border-orange-500/30 bg-orange-500/5' :
                    'border-purple-500/30 bg-purple-500/5'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => moveStep(step.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveStep(step.id, 'down')}
                        disabled={idx === steps.length - 1}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      step.type === 'message' ? 'bg-cyan-500/20' :
                      step.type === 'wait' ? 'bg-orange-500/20' : 'bg-purple-500/20'
                    }`}>
                      {step.type === 'message' && <Send className="h-3 w-3 text-cyan-400" />}
                      {step.type === 'wait' && <Clock className="h-3 w-3 text-orange-400" />}
                      {step.type === 'task' && <Zap className="h-3 w-3 text-purple-400" />}
                    </div>
                    <span className="text-xs text-gray-400 uppercase">{step.type}</span>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) => updateStep(step.id, { title: e.target.value })}
                      className="flex-1 px-2 py-1 bg-transparent border-b border-gray-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => removeStep(step.id)}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {step.type === 'wait' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Wait</span>
                      <input
                        type="number"
                        value={step.waitDays || 1}
                        onChange={(e) => updateStep(step.id, { waitDays: parseInt(e.target.value) || 1 })}
                        min={1}
                        className="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-orange-500"
                      />
                      <span className="text-sm text-gray-400">days before next step</span>
                    </div>
                  ) : (
                    <textarea
                      value={step.content}
                      onChange={(e) => updateStep(step.id, { content: e.target.value })}
                      placeholder={step.type === 'message' ? config.placeholder : 'Task description...'}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  )}
                </div>
              ))}

              {steps.length === 0 && (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-700 rounded-lg">
                  No steps yet. Add a message, wait period, or task to get started.
                </div>
              )}
            </div>
          </div>

          {/* Variable Help */}
          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="text-xs text-gray-400 mb-2">Available Variables:</div>
            <div className="flex flex-wrap gap-2">
              {['{{name}}', '{{company}}', '{{email}}', '{{phone}}', '{{website}}'].map((v) => (
                <code key={v} className="px-2 py-1 bg-gray-900 rounded text-xs text-cyan-400">{v}</code>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-medium flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save Sequence
          </button>
        </div>
      </div>
    </div>
  );
}

export default Sequences;