import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyCredentials, createSession } from '@/lib/auth-gate';
import { Shield, AlertTriangle } from 'lucide-react';

/**
 * Hidden Authentication Gate
 * 
 * This page is intentionally minimal and reveals nothing about the application.
 * No branding, no hints, no visible credentials.
 */
export function AuthGate() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(false);
    setIsSubmitting(true);

    // Small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

    if (verifyCredentials(email, password)) {
      createSession();
      // Clear form before navigation
      setEmail('');
      setPassword('');
      navigate('/', { replace: true });
    } else {
      setError(true);
      // Clear password on failure
      setPassword('');
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-sm p-8">
        {/* Minimal branding - intentionally vague */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Shield className="h-8 w-8 text-cyan-400" />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-cyan-500 focus:outline-none"
              placeholder="Identifier"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded text-white focus:border-cyan-500 focus:outline-none"
              placeholder="Access Key"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Access denied</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Verifying...' : 'Authenticate'}
          </button>
        </form>

        {/* No hints, no links, no help text */}
      </div>
    </div>
  );
}
