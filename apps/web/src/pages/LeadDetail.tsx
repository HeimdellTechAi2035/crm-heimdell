import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MessageCircle,
  Globe,
  Linkedin,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Save,
  X,
} from 'lucide-react';

// ─── Status Colors ──────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  NEW:            'text-cyan-400 bg-cyan-400/10 border-cyan-400/40',
  CONTACTED_1:    'text-blue-400 bg-blue-400/10 border-blue-400/40',
  WAITING_D2:     'text-yellow-400 bg-yellow-400/10 border-yellow-400/40',
  CALL_DUE:       'text-orange-400 bg-orange-400/10 border-orange-400/40',
  CALLED:         'text-purple-400 bg-purple-400/10 border-purple-400/40',
  WAITING_D1:     'text-yellow-400 bg-yellow-400/10 border-yellow-400/40',
  CONTACTED_2:    'text-indigo-400 bg-indigo-400/10 border-indigo-400/40',
  WA_VOICE_DUE:   'text-green-400 bg-green-400/10 border-green-400/40',
  REPLIED:        'text-emerald-400 bg-emerald-400/10 border-emerald-400/40',
  QUALIFIED:      'text-green-500 bg-green-500/10 border-green-500/40',
  NOT_INTERESTED: 'text-red-400 bg-red-400/10 border-red-400/40',
  COMPLETED:      'text-gray-400 bg-gray-400/10 border-gray-400/40',
};

// ─── Action Configs ─────────────────────────────────────────

const ACTIONS = [
  { key: 'send_email_1',  label: 'Email 1 Sent',     icon: Mail,           flag: 'emailSent1' },
  { key: 'send_dm_li_1',  label: 'LinkedIn DM 1',    icon: Linkedin,       flag: 'dmLiSent1' },
  { key: 'send_dm_fb_1',  label: 'Facebook DM 1',    icon: MessageCircle,  flag: 'dmFbSent1' },
  { key: 'send_dm_ig_1',  label: 'Instagram DM 1',   icon: MessageCircle,  flag: 'dmIgSent1' },
  { key: 'call_done',     label: 'Call Completed',    icon: Phone,          flag: 'callDone' },
  { key: 'send_email_2',  label: 'Email 2 Sent',     icon: Mail,           flag: 'emailSent2' },
  { key: 'send_dm_2',     label: 'DM Round 2',       icon: MessageCircle,  flag: 'dmSent2' },
  { key: 'send_wa_voice', label: 'WA Voice Sent',    icon: Phone,          flag: 'waVoiceSent' },
  { key: 'mark_replied',  label: 'Mark Replied',      icon: CheckCircle,    flag: 'repliedAtUtc' },
];

// ─── Component ──────────────────────────────────────────────

export function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`, false),
    enabled: !!id,
  });

  const { data: pipelineStatus } = useQuery({
    queryKey: ['pipeline-status', id],
    queryFn: () => api.get(`/pipeline/status/${id}`, false),
    enabled: !!id,
  });

  const logAction = useMutation({
    mutationFn: ({ action, notes }: { action: string; notes?: string }) =>
      api.post(`/leads/${id}/actions`, { action, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-status', id] });
    },
  });

  const advancePipeline = useMutation({
    mutationFn: (targetStatus: string) =>
      api.post(`/pipeline/advance/${id}`, { targetStatus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-status', id] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });

  const updateLead = useMutation({
    mutationFn: (data: any) => api.patch(`/leads/${id}`, data),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['lead', id] });
    },
  });

  if (isLoading || !lead) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="cyber-spinner mx-auto mb-4" />
          <div className="font-['Orbitron'] text-cyan-400 text-sm">LOADING LEAD...</div>
        </div>
      </div>
    );
  }

  const statusColor = STATUS_COLORS[lead.status] ?? STATUS_COLORS.NEW;
  const possibleTransitions = pipelineStatus?.possibleTransitions ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="text-cyan-400 hover:text-cyan-300 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-['Orbitron'] font-bold text-cyan-400">
            {lead.company}
          </h1>
          <p className="text-sm font-['Share_Tech_Mono'] text-cyan-400/60">
            {lead.keyDecisionMaker} {lead.role ? `· ${lead.role}` : ''}
          </p>
        </div>
        <span className={`cyber-badge px-3 py-1 text-xs font-['Orbitron'] border rounded ${statusColor}`}>
          {lead.status}
        </span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Lead Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact Info Card */}
          <div className="holo-card rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider">CONTACT INFO</h2>
              {!editing ? (
                <button onClick={() => { setEditing(true); setEditData({}); }} className="cyber-btn px-3 py-1 text-xs">
                  EDIT
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => updateLead.mutate(editData)} className="cyber-btn px-3 py-1 text-xs flex items-center gap-1">
                    <Save className="h-3 w-3" /> SAVE
                  </button>
                  <button onClick={() => setEditing(false)} className="text-red-400 hover:text-red-300 px-2">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <InfoField label="COMPANY" value={lead.company} editing={editing} field="company" editData={editData} setEditData={setEditData} />
              <InfoField label="DECISION MAKER" value={lead.keyDecisionMaker} editing={editing} field="keyDecisionMaker" editData={editData} setEditData={setEditData} />
              <InfoField label="ROLE" value={lead.role} editing={editing} field="role" editData={editData} setEditData={setEditData} />
              <InfoField label="WEBSITE" value={lead.website} editing={editing} field="website" editData={editData} setEditData={setEditData} icon={<Globe className="h-3 w-3" />} />
              <InfoField label="EMAILS" value={lead.emails?.join(', ')} editing={editing} field="emails" editData={editData} setEditData={setEditData} icon={<Mail className="h-3 w-3" />} />
              <InfoField label="PHONE" value={lead.number} editing={editing} field="number" editData={editData} setEditData={setEditData} icon={<Phone className="h-3 w-3" />} />
              <InfoField label="LINKEDIN" value={lead.linkedinClean} editing={editing} field="linkedinClean" editData={editData} setEditData={setEditData} icon={<Linkedin className="h-3 w-3" />} />
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">MOBILE VALID</span>
                <span className={`text-xs ${lead.mobileValid ? 'text-green-400' : 'text-red-400'}`}>
                  {lead.mobileValid ? 'YES' : 'NO'}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="holo-card rounded-lg p-5">
            <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider mb-3">NOTES</h2>
            <pre className="font-['Share_Tech_Mono'] text-xs text-cyan-400/70 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {lead.notes || 'No notes yet.'}
            </pre>
          </div>

          {/* Audit Trail */}
          <div className="holo-card rounded-lg p-5">
            <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider mb-3">AUDIT TRAIL</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(lead.auditLogs ?? []).length === 0 ? (
                <div className="text-xs text-cyan-400/30 font-['Share_Tech_Mono']">No audit entries.</div>
              ) : (
                (lead.auditLogs ?? []).map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 py-1 border-b border-cyan-400/10">
                    <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40 whitespace-nowrap">
                      {new Date(log.timestampUtc).toLocaleString()}
                    </div>
                    <div className="text-xs font-['Share_Tech_Mono'] text-cyan-400/70">
                      <span className="text-cyan-400">{log.action}</span>
                      {' by '}
                      <span className="text-purple-400">{log.actor}</span>
                      {' via '}
                      <span className="text-cyan-400/50">{log.source}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions + Pipeline */}
        <div className="space-y-4">
          {/* Pipeline Status */}
          <div className="holo-card rounded-lg p-5">
            <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider mb-3">PIPELINE</h2>

            {lead.nextAction && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded bg-orange-400/10 border border-orange-400/30">
                <ArrowRight className="h-4 w-4 text-orange-400" />
                <div>
                  <div className="text-xs font-['Orbitron'] text-orange-400">{lead.nextAction}</div>
                  {lead.nextActionDueUtc && (
                    <div className="text-[10px] text-orange-400/60 font-['Share_Tech_Mono']">
                      Due: {new Date(lead.nextActionDueUtc).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advance buttons */}
            <div className="space-y-2">
              <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">TRANSITIONS</span>
              {possibleTransitions.length === 0 ? (
                <div className="text-xs text-cyan-400/30 font-['Share_Tech_Mono']">
                  No transitions available.
                </div>
              ) : (
                possibleTransitions.map((t: any) => (
                  <button
                    key={t.to}
                    disabled={!t.allowed || advancePipeline.isPending}
                    onClick={() => advancePipeline.mutate(t.to)}
                    className={`w-full text-left px-3 py-2 rounded border text-xs font-['Share_Tech_Mono'] transition-all ${
                      t.allowed
                        ? 'border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10 cursor-pointer'
                        : 'border-gray-700 text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>→ {t.to}</span>
                      {!t.allowed && (
                        <span className="text-[9px] text-red-400/60 max-w-[120px] truncate">
                          {t.reason}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="holo-card rounded-lg p-5">
            <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider mb-3">LOG ACTIONS</h2>
            <div className="space-y-2">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                const isDone = action.flag === 'repliedAtUtc'
                  ? !!lead[action.flag]
                  : lead[action.flag] === true;

                return (
                  <button
                    key={action.key}
                    disabled={isDone || logAction.isPending}
                    onClick={() => logAction.mutate({ action: action.key })}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded border text-xs font-['Share_Tech_Mono'] transition-all ${
                      isDone
                        ? 'border-green-400/20 text-green-400/50 bg-green-400/5'
                        : 'border-cyan-400/20 text-cyan-400 hover:bg-cyan-400/10'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{action.label}</span>
                    {isDone && <CheckCircle className="h-3 w-3 text-green-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component ──────────────────────────────────────────

function InfoField({
  label,
  value,
  editing,
  field,
  editData,
  setEditData,
  icon,
}: {
  label: string;
  value?: string | null;
  editing: boolean;
  field: string;
  editData: any;
  setEditData: (d: any) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        {icon && <span className="text-cyan-400/40">{icon}</span>}
        <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">{label}</span>
      </div>
      {editing ? (
        <input
          type="text"
          defaultValue={value ?? ''}
          onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
          className="cyber-input w-full px-2 py-1 text-sm rounded"
        />
      ) : (
        <div className="text-sm font-['Rajdhani'] text-cyan-400">
          {value || <span className="text-cyan-400/20">—</span>}
        </div>
      )}
    </div>
  );
}
