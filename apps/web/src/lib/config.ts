/**
 * App Configuration
 * 
 * Controls which backend to use for data operations.
 */

export type DataBackend = 'local' | 'netlify';

// Check if we're in Netlify environment
const isNetlifyEnv = typeof window !== 'undefined' && (
  window.location.hostname.includes('netlify') ||
  window.location.hostname === 'localhost' && window.location.port === '8888'
);

// Configuration
export const config = {
  /**
   * Data backend to use.
   * - 'local': Uses localStorage (offline-first, no server needed)
   * - 'netlify': Uses Netlify Functions + Neon Postgres
   */
  dataBackend: (localStorage.getItem('data_backend') as DataBackend) || 
               (isNetlifyEnv ? 'netlify' : 'local'),
  
  /**
   * Set the data backend
   */
  setDataBackend(backend: DataBackend) {
    this.dataBackend = backend;
    localStorage.setItem('data_backend', backend);
  },
  
  /**
   * Check if using Netlify backend
   */
  isNetlifyBackend() {
    return this.dataBackend === 'netlify';
  },
  
  /**
   * Check if using local backend
   */
  isLocalBackend() {
    return this.dataBackend === 'local';
  }
};

export default config;
