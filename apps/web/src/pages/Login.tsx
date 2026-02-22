import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Shield, LogIn, AlertTriangle } from 'lucide-react';

export function Login() {
  const setUser = useAuthStore((s) => s.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => api.login(email, password),
    onSuccess: (data) => {
      setUser(data.user);
    },
    onError: (err: any) => {
      setError(err.message || 'Authentication failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Credentials required');
      return;
    }
    loginMutation.mutate();
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-black overflow-hidden scan-lines">
      {/* Background effects */}
      <div className="grid-bg" />
      <div className="hex-pattern absolute inset-0 opacity-30" />

      {/* Glowing border card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Top line accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent mb-6" />

        <div className="holo-card rounded-lg p-8 backdrop-blur-xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <Shield className="h-14 w-14 text-cyan-400 glow-icon" />
              <div className="absolute inset-0 h-14 w-14 bg-cyan-400/20 blur-xl animate-pulse" />
            </div>
            <h1 className="text-2xl font-['Orbitron'] font-bold tracking-wider text-cyan-400 neon-text">
              HEIMDELL
            </h1>
            <span className="text-[10px] font-['Share_Tech_Mono'] text-cyan-400/50 tracking-[0.4em] mt-1">
              OUTREACH ENGINE
            </span>
          </div>

          {/* Divider */}
          <div className="energy-bar mb-6" />

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded border border-red-400/30 bg-red-400/5">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-xs font-['Share_Tech_Mono'] text-red-400">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-['Share_Tech_Mono'] text-cyan-400/50 tracking-wider mb-1.5">
                OPERATOR ID
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cyber-input w-full px-4 py-3 rounded font-['Rajdhani'] text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-['Share_Tech_Mono'] text-cyan-400/50 tracking-wider mb-1.5">
                ACCESS KEY
              </label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cyber-input w-full px-4 py-3 rounded font-['Rajdhani'] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="cyber-btn w-full py-3 flex items-center justify-center gap-2 text-sm font-['Orbitron'] tracking-wider"
            >
              {loginMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  AUTHENTICATE
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-cyan-500/10">
            <div className="flex items-center justify-between text-[9px] font-['Share_Tech_Mono'] text-cyan-400/30">
              <span>SECURE TERMINAL</span>
              <span>AES-256-GCM</span>
            </div>
          </div>
        </div>

        {/* Bottom line accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent mt-6" />
      </div>
    </div>
  );
}
