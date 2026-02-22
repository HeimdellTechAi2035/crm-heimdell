import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  Sheet,
  Key,
  RefreshCw,
  Plus,
  Trash2,
  Copy,
  AlertTriangle,
  CheckCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Mail,
  Send,
  Power,
  PowerOff,
} from 'lucide-react';

// ─── Sheets Config Section ──────────────────────────────────

function SheetsSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', spreadsheetId: '', sheetName: 'Sheet1', credentialsJson: '' });

  const { data: configs, isLoading } = useQuery({
    queryKey: ['sheets-configs'],
    queryFn: () => api.getSheetsConfigs(),
  });

  const createConfig = useMutation({
    mutationFn: () => api.createSheetsConfig({
      ...form,
      credentialsJson: JSON.parse(form.credentialsJson),
      columnMapping: {
        company: 'Company',
        keyDecisionMaker: 'Contact',
        role: 'Role',
        website: 'Website',
        emails: 'Emails',
        number: 'Phone',
        linkedinClean: 'LinkedIn',
      },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets-configs'] });
      setShowForm(false);
      setForm({ label: '', spreadsheetId: '', sheetName: 'Sheet1', credentialsJson: '' });
    },
  });

  const syncIn = useMutation({
    mutationFn: (configId: string) => api.triggerSyncIn(configId, false),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
  });

  const syncOut = useMutation({
    mutationFn: (configId: string) => api.triggerSyncOut(configId),
  });

  return (
    <div className="holo-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sheet className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider">GOOGLE SHEETS</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="cyber-btn px-3 py-1 text-xs flex items-center gap-1">
          <Plus className="h-3 w-3" /> ADD CONFIG
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 rounded border border-cyan-400/20 bg-cyan-400/5 space-y-3">
          <input
            placeholder="Label (e.g. Main Lead Sheet)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="cyber-input w-full px-3 py-2 text-sm rounded"
          />
          <input
            placeholder="Spreadsheet ID"
            value={form.spreadsheetId}
            onChange={(e) => setForm({ ...form, spreadsheetId: e.target.value })}
            className="cyber-input w-full px-3 py-2 text-sm rounded"
          />
          <input
            placeholder="Sheet Name (default: Sheet1)"
            value={form.sheetName}
            onChange={(e) => setForm({ ...form, sheetName: e.target.value })}
            className="cyber-input w-full px-3 py-2 text-sm rounded"
          />
          <textarea
            placeholder="Service Account JSON (paste full JSON)"
            value={form.credentialsJson}
            onChange={(e) => setForm({ ...form, credentialsJson: e.target.value })}
            className="cyber-input w-full px-3 py-2 text-sm rounded h-24 font-['Share_Tech_Mono']"
          />
          <div className="flex gap-2">
            <button onClick={() => createConfig.mutate()} className="cyber-btn px-4 py-2 text-xs">SAVE</button>
            <button onClick={() => setShowForm(false)} className="text-red-400 text-xs px-3">CANCEL</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-cyan-400/40 font-['Share_Tech_Mono']">Loading configs...</div>
      ) : (configs ?? []).length === 0 ? (
        <div className="text-xs text-cyan-400/30 font-['Share_Tech_Mono']">
          No Google Sheets connected. Add a config to start syncing leads.
        </div>
      ) : (
        <div className="space-y-3">
          {(configs ?? []).map((cfg: any) => (
            <div key={cfg.id} className="flex items-center justify-between p-3 rounded border border-cyan-400/10 bg-black/30">
              <div>
                <div className="text-sm font-['Orbitron'] text-cyan-400">{cfg.label}</div>
                <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
                  {cfg.spreadsheetId} / {cfg.sheetName}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => syncIn.mutate(cfg.id)}
                  disabled={syncIn.isPending}
                  className="cyber-btn px-3 py-1 text-[10px] flex items-center gap-1"
                >
                  <ArrowDownToLine className="h-3 w-3" /> SYNC IN
                </button>
                <button
                  onClick={() => syncOut.mutate(cfg.id)}
                  disabled={syncOut.isPending}
                  className="cyber-btn px-3 py-1 text-[10px] flex items-center gap-1"
                >
                  <ArrowUpFromLine className="h-3 w-3" /> SYNC OUT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Email Senders Section ──────────────────────────────────

function EmailSendersSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [testModal, setTestModal] = useState<string | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; messageId?: string; error?: string } | null>(null);
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    smtpHost: 'smtp.livemail.co.uk',
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: '',
    smtpPass: '',
    dailyLimit: 100,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['email-senders'],
    queryFn: () => api.getEmailSenders(),
  });
  const senders = data?.senders ?? [];

  const createSender = useMutation({
    mutationFn: () => api.createEmailSender(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-senders'] });
      setShowForm(false);
      setForm({ email: '', displayName: '', smtpHost: 'smtp.livemail.co.uk', smtpPort: 465, smtpSecure: true, smtpUser: '', smtpPass: '', dailyLimit: 100 });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.updateEmailSender(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-senders'] }),
  });

  const testSend = useMutation({
    mutationFn: (senderEmail: string) =>
      api.testSendEmail({
        senderEmail,
        to: testTo,
        subject: 'Heimdell CRM Test Email',
        text: `This is a test email from Heimdell CRM sent via ${senderEmail} at ${new Date().toISOString()}.`,
      }),
    onSuccess: (result: any) => setTestResult(result),
    onError: (err: any) => setTestResult({ ok: false, error: err.message }),
  });

  return (
    <div className="holo-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-orange-400" />
          <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider">EMAIL SENDERS</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="cyber-btn px-3 py-1 text-xs flex items-center gap-1">
          <Plus className="h-3 w-3" /> ADD SENDER
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 rounded border border-cyan-400/20 bg-cyan-400/5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Email (must be on allowlist)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="cyber-input px-3 py-2 text-sm rounded" />
            <input placeholder="Display Name (optional)" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="cyber-input px-3 py-2 text-sm rounded" />
            <input placeholder="SMTP Host" value={form.smtpHost} onChange={(e) => setForm({ ...form, smtpHost: e.target.value })} className="cyber-input px-3 py-2 text-sm rounded" />
            <input placeholder="SMTP Port" type="number" value={form.smtpPort} onChange={(e) => setForm({ ...form, smtpPort: parseInt(e.target.value) || 465 })} className="cyber-input px-3 py-2 text-sm rounded" />
            <input placeholder="SMTP User" value={form.smtpUser} onChange={(e) => setForm({ ...form, smtpUser: e.target.value })} className="cyber-input px-3 py-2 text-sm rounded" />
            <input placeholder="SMTP Password" type="password" value={form.smtpPass} onChange={(e) => setForm({ ...form, smtpPass: e.target.value })} className="cyber-input px-3 py-2 text-sm rounded" />
            <input placeholder="Daily Limit" type="number" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 100 })} className="cyber-input px-3 py-2 text-sm rounded" />
            <label className="flex items-center gap-2 text-xs font-['Share_Tech_Mono'] text-cyan-400">
              <input type="checkbox" checked={form.smtpSecure} onChange={(e) => setForm({ ...form, smtpSecure: e.target.checked })} className="accent-cyan-400" />
              SSL/TLS
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createSender.mutate()} className="cyber-btn px-4 py-2 text-xs">SAVE</button>
            <button onClick={() => setShowForm(false)} className="text-red-400 text-xs px-3">CANCEL</button>
          </div>
        </div>
      )}

      {/* Test send modal */}
      {testModal && (
        <div className="mb-4 p-4 rounded border border-orange-400/20 bg-orange-400/5 space-y-3">
          <div className="text-xs font-['Orbitron'] text-orange-400">TEST SEND FROM: {testModal}</div>
          <input placeholder="Recipient email" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="cyber-input w-full px-3 py-2 text-sm rounded" />
          <div className="flex gap-2 items-center">
            <button
              onClick={() => testSend.mutate(testModal)}
              disabled={!testTo || testSend.isPending}
              className="cyber-btn px-4 py-2 text-xs flex items-center gap-1"
            >
              <Send className="h-3 w-3" /> SEND TEST
            </button>
            <button onClick={() => { setTestModal(null); setTestResult(null); }} className="text-red-400 text-xs px-3">CLOSE</button>
          </div>
          {testResult && (
            <div className={`text-xs font-['Share_Tech_Mono'] p-2 rounded ${testResult.ok ? 'text-green-400 bg-green-400/10 border border-green-400/20' : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>
              {testResult.ok ? `✓ Sent! MessageID: ${testResult.messageId}` : `✗ Failed: ${testResult.error}`}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-cyan-400/40 font-['Share_Tech_Mono']">Loading senders...</div>
      ) : senders.length === 0 ? (
        <div className="text-xs text-cyan-400/30 font-['Share_Tech_Mono']">
          No email senders configured. Add a sender account to start sending outreach emails.
        </div>
      ) : (
        <div className="space-y-2">
          {senders.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded border border-cyan-400/10 bg-black/30">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full ${s.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
                <div className="min-w-0">
                  <div className="text-sm font-['Orbitron'] text-cyan-400 truncate">
                    {s.displayName ? `${s.displayName} <${s.email}>` : s.email}
                  </div>
                  <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
                    {s.smtpHost}:{s.smtpPort} · {s.sentToday}/{s.dailyLimit} today
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setTestModal(s.email); setTestResult(null); setTestTo(''); }}
                  className="cyber-btn px-2 py-1 text-[10px] flex items-center gap-1"
                >
                  <Send className="h-3 w-3" /> TEST
                </button>
                <button
                  onClick={() => toggleActive.mutate({ id: s.id, isActive: !s.isActive })}
                  className={`px-2 py-1 text-[10px] rounded border ${s.isActive ? 'border-red-400/30 text-red-400 hover:bg-red-400/10' : 'border-green-400/30 text-green-400 hover:bg-green-400/10'}`}
                >
                  {s.isActive ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── API Keys Section ───────────────────────────────────────

function ApiKeysSection() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>(['leads:read', 'leads:write', 'pipeline:advance']);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const AVAILABLE_PERMS = ['leads:read', 'leads:write', 'pipeline:advance', 'pipeline:read'];

  const { data: keys, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.getApiKeys(),
  });

  const createKey = useMutation({
    mutationFn: () => api.createApiKey(newKeyName, newKeyPerms),
    onSuccess: (data: any) => {
      setGeneratedKey(data.rawKey);
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setShowForm(false);
      setNewKeyName('');
    },
  });

  const revokeKey = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
    }
  };

  return (
    <div className="holo-card rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Key className="h-5 w-5 text-purple-400" />
          <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider">API KEYS</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="cyber-btn px-3 py-1 text-xs flex items-center gap-1">
          <Plus className="h-3 w-3" /> NEW KEY
        </button>
      </div>

      {/* Generated key banner */}
      {generatedKey && (
        <div className="mb-4 p-3 rounded border border-yellow-400/30 bg-yellow-400/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-['Orbitron'] text-yellow-400">COPY NOW — THIS WON'T BE SHOWN AGAIN</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs font-['Share_Tech_Mono'] text-cyan-400 bg-black/50 px-3 py-2 rounded break-all">
              {generatedKey}
            </code>
            <button onClick={copyKey} className="cyber-btn px-2 py-2">
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setGeneratedKey(null)}
            className="mt-2 text-[10px] text-cyan-400/40 hover:text-cyan-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <div className="mb-6 p-4 rounded border border-cyan-400/20 bg-cyan-400/5 space-y-3">
          <input
            placeholder="Key name (e.g. OpenClaw Agent)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="cyber-input w-full px-3 py-2 text-sm rounded"
          />
          <div>
            <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40 mb-2 block">PERMISSIONS</span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PERMS.map((perm) => (
                <label key={perm} className="flex items-center gap-1.5 text-xs font-['Share_Tech_Mono'] text-cyan-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newKeyPerms.includes(perm)}
                    onChange={(e) =>
                      setNewKeyPerms(
                        e.target.checked
                          ? [...newKeyPerms, perm]
                          : newKeyPerms.filter((p) => p !== perm)
                      )
                    }
                    className="accent-cyan-400"
                  />
                  {perm}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createKey.mutate()} className="cyber-btn px-4 py-2 text-xs">GENERATE</button>
            <button onClick={() => setShowForm(false)} className="text-red-400 text-xs px-3">CANCEL</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-cyan-400/40 font-['Share_Tech_Mono']">Loading keys...</div>
      ) : (keys ?? []).length === 0 ? (
        <div className="text-xs text-cyan-400/30 font-['Share_Tech_Mono']">
          No API keys. Create one to let the OpenClaw agent access leads.
        </div>
      ) : (
        <div className="space-y-2">
          {(keys ?? []).map((k: any) => (
            <div key={k.id} className="flex items-center justify-between p-3 rounded border border-cyan-400/10 bg-black/30">
              <div>
                <div className="text-sm font-['Orbitron'] text-cyan-400">{k.name}</div>
                <div className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/40">
                  {k.prefix}*** · {k.permissions?.join(', ')} · Last: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'never'}
                </div>
              </div>
              <button
                onClick={() => revokeKey.mutate(k.id)}
                className="text-red-400 hover:text-red-300 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-['Orbitron'] font-bold text-cyan-400 neon-text">SETTINGS</h1>
        <p className="text-sm font-['Share_Tech_Mono'] text-cyan-400/40">
          Integrations, API keys, and system config
        </p>
      </div>

      <SheetsSection />

      <EmailSendersSection />

      {user?.role === 'ADMIN' && <ApiKeysSection />}

      {/* System Info */}
      <div className="holo-card rounded-lg p-6">
        <h2 className="text-sm font-['Orbitron'] text-cyan-400 tracking-wider mb-4">SYSTEM</h2>
        <div className="grid grid-cols-2 gap-4 text-xs font-['Share_Tech_Mono']">
          <div className="flex justify-between">
            <span className="text-cyan-400/40">ENGINE</span>
            <span className="text-cyan-400">HEIMDELL OUTREACH v4.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-400/40">PIPELINE</span>
            <span className="text-green-400">12-STATUS DETERMINISTIC</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-400/40">AGENT API</span>
            <span className="text-green-400">ACTIVE</span>
          </div>
          <div className="flex justify-between">
            <span className="text-cyan-400/40">SHEETS SYNC</span>
            <span className="text-green-400">BI-DIRECTIONAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}
