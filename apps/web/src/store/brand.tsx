import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api } from '../lib/api';

interface BusinessUnit {
  id: string;
  name: string;
  subdomain: string;
  isActive: boolean;
  settings?: Record<string, any>;
}

interface BrandContextType {
  selectedBrand: BusinessUnit | null;
  brands: BusinessUnit[];
  loading: boolean;
  error: string | null;
  selectBrand: (brandId: string) => void;
  refreshBrands: () => Promise<void>;
  initializeBrands: () => Promise<void>;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [selectedBrand, setSelectedBrand] = useState<BusinessUnit | null>(null);
  const [brands, setBrands] = useState<BusinessUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      // Only fetch if we have a token (user is authenticated)
      const token = api.getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await api.get('/api/business-units/active');
      const brandsData = response.data;
      setBrands(brandsData);

      // Auto-select first brand if none selected
      if (!selectedBrand && brandsData.length > 0) {
        const savedBrandId = localStorage.getItem('selectedBrandId');
        const brandToSelect = savedBrandId
          ? brandsData.find((b: BusinessUnit) => b.id === savedBrandId) || brandsData[0]
          : brandsData[0];
        setSelectedBrand(brandToSelect);
      }
      setError(null);
    } catch (err: any) {
      console.warn('Failed to load brands:', err.message);
      setError(err.message || 'Failed to load brands');
      // Don't crash the app on brand loading failure
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const selectBrand = useCallback((brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    if (brand) {
      setSelectedBrand(brand);
      localStorage.setItem('selectedBrandId', brandId);
    }
  }, [brands]);

  const refreshBrands = useCallback(async () => {
    await fetchBrands();
  }, []);

  const initializeBrands = useCallback(async () => {
    await fetchBrands();
  }, []);

  useEffect(() => {
    // Only fetch brands if user has a token
    const token = api.getToken();
    if (token) {
      fetchBrands();
    } else {
      setLoading(false);
    }
  }, []);



  return (
    <BrandContext.Provider
      value={{
        selectedBrand,
        brands,
        loading,
        error,
        selectBrand,
        refreshBrands,
        initializeBrands,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
