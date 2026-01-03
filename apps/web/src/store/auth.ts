import { create } from 'zustand';
import { isSessionValid, destroySession } from '../lib/auth-gate';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  checkSession: () => void;
  setAuthenticated: (user: User) => void;
  logout: () => void;
}

// User data after successful authentication
const authenticatedUser: User = {
  id: 'hd-auth-user',
  email: 'user@system',
  firstName: 'System',
  lastName: 'User',
  role: 'admin',
  organizationId: 'heimdell-org',
};

export const useAuthStore = create<AuthStore>((set) => ({
  // Start unauthenticated - require login
  user: null,
  isAuthenticated: false,
  
  // Check if existing session is valid
  checkSession: () => {
    if (isSessionValid()) {
      set({ user: authenticatedUser, isAuthenticated: true });
    } else {
      set({ user: null, isAuthenticated: false });
    }
  },
  
  // Set authenticated state after successful login
  setAuthenticated: (user) => set({ user, isAuthenticated: true }),
  
  // Logout and destroy session
  logout: () => {
    destroySession();
    set({ user: null, isAuthenticated: false });
  },
}));
