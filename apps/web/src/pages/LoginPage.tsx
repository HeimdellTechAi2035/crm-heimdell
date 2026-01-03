/**
 * Login Page
 * 
 * Supabase authentication login/signup page.
 * Supports both sign in and sign up modes.
 */

import { useState, FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/useAuth';
import { Shield, AlertTriangle, Mail, Lock, UserPlus, LogIn } from 'lucide-react';

type AuthMode = 'login' | 'signup';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the intended destination after login
  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validate inputs
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await login(email, password);
        
        if (result.success) {
          // Redirect to intended destination
          navigate(from, { replace: true });
        } else {
          setError(result.error || 'Login failed. Please try again.');
        }
      } else {
        const result = await register(email, password);
        
        if (result.success) {
          if (result.session) {
            // Signed up and logged in (email confirmation disabled)
            navigate(from, { replace: true });
          } else {
            // Email confirmation required
            setMessage('Please check your email to confirm your account.');
            setMode('login');
          }
        } else {
          setError(result.error || 'Sign up failed. Please try again.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setMessage(null);
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center scan-lines">
      <div className="grid-bg" />
      
      <div className="relative z-10 w-full max-w-md p-8">
        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Shield className="h-10 w-10 text-cyan-400 glow-icon" />
            </div>
            <div className="absolute inset-0 w-20 h-20 bg-cyan-400/20 blur-xl animate-pulse" />
          </div>
          <h1 className="mt-4 text-2xl font-['Orbitron'] font-bold text-cyan-400 neon-text tracking-wider">
            HEIMDELL
          </h1>
          <p className="text-cyan-400/50 font-['Share_Tech_Mono'] text-xs tracking-[0.3em] mt-1">
            CRM SYSTEM v3.0
          </p>
        </div>

        {/* Auth Form */}
        <div className="holo-card rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            {mode === 'login' ? (
              <LogIn className="h-5 w-5 text-cyan-400" />
            ) : (
              <UserPlus className="h-5 w-5 text-cyan-400" />
            )}
            <h2 className="font-['Orbitron'] text-lg text-cyan-400 tracking-wider">
              {mode === 'login' ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/50" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="cyber-input w-full pl-11 pr-4 py-3 rounded font-['Rajdhani']"
                placeholder="Email Address"
                disabled={isSubmitting}
              />
            </div>

            {/* Password Input */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/50" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="cyber-input w-full pl-11 pr-4 py-3 rounded font-['Rajdhani']"
                placeholder="Password"
                disabled={isSubmitting}
              />
            </div>

            {/* Confirm Password (signup only) */}
            {mode === 'signup' && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-cyan-400/50" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="cyber-input w-full pl-11 pr-4 py-3 rounded font-['Rajdhani']"
                  placeholder="Confirm Password"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm font-['Share_Tech_Mono'] bg-red-500/10 border border-red-500/30 rounded p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {message && (
              <div className="flex items-center gap-2 text-green-400 text-sm font-['Share_Tech_Mono'] bg-green-500/10 border border-green-500/30 rounded p-3">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="cyber-btn w-full py-3 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                  <span>{mode === 'login' ? 'AUTHENTICATING...' : 'CREATING ACCOUNT...'}</span>
                </>
              ) : (
                <>
                  {mode === 'login' ? (
                    <LogIn className="h-5 w-5" />
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                  <span>{mode === 'login' ? 'AUTHENTICATE' : 'CREATE ACCOUNT'}</span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Auth Mode */}
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-cyan-400/70 hover:text-cyan-400 font-['Share_Tech_Mono'] text-sm transition-colors"
            >
              {mode === 'login' 
                ? "Don't have an account? Create one" 
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-cyan-400/30 font-['Share_Tech_Mono'] text-xs">
            SECURE CONNECTION ESTABLISHED
          </p>
        </div>
      </div>
    </div>
  );
}
