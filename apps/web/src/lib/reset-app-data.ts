// Complete App Data Reset Utility
// Clears ONLY THE CURRENT USER'S data from storage
// Uses user-scoped keys to ensure data isolation

import { useQueryClient } from '@tanstack/react-query';
import { getCurrentUserIdSync } from './supabaseClient';

// Base storage keys for data collections
const DATA_STORAGE_KEYS = [
  'heimdell_leads',
  'heimdell_companies',
  'heimdell_deals',
  'heimdell_tasks',
  'heimdell_activities',
  'heimdell_imports',
  'heimdell_current_import',
];

// Keys that are NOT user-scoped (global settings)
const GLOBAL_STORAGE_KEYS = [
  'heimdell_user',
  'selectedBrandId',
];

// All sessionStorage keys
const SESSION_STORAGE_KEYS = [
  'heimdell_session',
  'temp_import',
];

// IndexedDB database names (if used)
const INDEXED_DB_NAMES = [
  'heimdell-db',
  'heimdell-offline',
];

// Cache storage names (for service workers)
const CACHE_STORAGE_NAMES = [
  'heimdell-cache',
  'heimdell-assets',
];

/**
 * Clears localStorage data FOR THE CURRENT USER ONLY
 * Other users' data remains untouched
 */
function clearLocalStorage(): void {
  const userId = getCurrentUserIdSync();
  
  if (!userId) {
    console.warn('No user ID - cannot clear user-scoped data');
    return;
  }
  
  // Clear user-scoped data keys
  DATA_STORAGE_KEYS.forEach(key => {
    const scopedKey = `${key}_${userId}`;
    localStorage.removeItem(scopedKey);
    console.log(`Cleared: ${scopedKey}`);
  });
  
  // Also clear any other user-scoped keys we might have missed
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(userId) && key.startsWith('heimdell')) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Cleared additional: ${key}`);
  });
  
  console.log(`Cleared all data for user: ${userId}`);
}

/**
 * Clears all sessionStorage data
 */
function clearSessionStorage(): void {
  SESSION_STORAGE_KEYS.forEach(key => {
    sessionStorage.removeItem(key);
  });
  
  // Clear any heimdell prefixed keys
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && (key.startsWith('heimdell') || key.startsWith('heimdell_'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

/**
 * Clears all IndexedDB databases
 */
async function clearIndexedDB(): Promise<void> {
  for (const dbName of INDEXED_DB_NAMES) {
    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => {
          console.warn(`IndexedDB "${dbName}" is blocked - close other tabs`);
          resolve(); // Continue anyway
        };
      });
    } catch (err) {
      console.warn(`Failed to delete IndexedDB "${dbName}":`, err);
    }
  }
}

/**
 * Clears all Cache Storage (Service Worker caches)
 */
async function clearCacheStorage(): Promise<void> {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => CACHE_STORAGE_NAMES.includes(name) || name.startsWith('heimdell'))
          .map(name => caches.delete(name))
      );
    } catch (err) {
      console.warn('Failed to clear cache storage:', err);
    }
  }
}

/**
 * Unregisters all Service Workers
 */
async function unregisterServiceWorkers(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    } catch (err) {
      console.warn('Failed to unregister service workers:', err);
    }
  }
}

export interface ResetResult {
  success: boolean;
  errors: string[];
  cleared: {
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDB: boolean;
    cacheStorage: boolean;
    serviceWorkers: boolean;
  };
}

/**
 * Main reset function - clears ALL app data
 * @returns Result object with success status and any errors
 */
export async function resetAppData(): Promise<ResetResult> {
  const errors: string[] = [];
  const cleared = {
    localStorage: false,
    sessionStorage: false,
    indexedDB: false,
    cacheStorage: false,
    serviceWorkers: false,
  };

  // 1. Clear localStorage
  try {
    clearLocalStorage();
    cleared.localStorage = true;
  } catch (err) {
    errors.push(`localStorage: ${err}`);
  }

  // 2. Clear sessionStorage
  try {
    clearSessionStorage();
    cleared.sessionStorage = true;
  } catch (err) {
    errors.push(`sessionStorage: ${err}`);
  }

  // 3. Clear IndexedDB
  try {
    await clearIndexedDB();
    cleared.indexedDB = true;
  } catch (err) {
    errors.push(`IndexedDB: ${err}`);
  }

  // 4. Clear Cache Storage
  try {
    await clearCacheStorage();
    cleared.cacheStorage = true;
  } catch (err) {
    errors.push(`Cache Storage: ${err}`);
  }

  // 5. Unregister Service Workers
  try {
    await unregisterServiceWorkers();
    cleared.serviceWorkers = true;
  } catch (err) {
    errors.push(`Service Workers: ${err}`);
  }

  // Verify localStorage is actually empty
  const remainingKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('heimdell')) {
      remainingKeys.push(key);
    }
  }
  if (remainingKeys.length > 0) {
    errors.push(`Some localStorage keys could not be cleared: ${remainingKeys.join(', ')}`);
    cleared.localStorage = false;
  }

  return {
    success: errors.length === 0,
    errors,
    cleared,
  };
}

/**
 * Hook to use resetAppData with React Query cache invalidation
 */
export function useResetAppData() {
  const queryClient = useQueryClient();

  return async (): Promise<ResetResult> => {
    // First reset all React Query caches
    queryClient.clear();
    
    // Then clear all persistent storage
    const result = await resetAppData();
    
    // Invalidate all queries to force refetch (will now return empty)
    await queryClient.invalidateQueries();
    
    return result;
  };
}
