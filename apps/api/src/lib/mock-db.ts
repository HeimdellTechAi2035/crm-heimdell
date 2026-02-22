// Mock database for dev/test mode when real DB isn't available
// Used by imports.ts when config.devTestMode is true

const store: Record<string, any[]> = {
  leads: [],
  companies: [],
  importJobs: [],
  importRows: [],
};

export const mockDb = {
  lead: {
    findMany: async (args?: any) => {
      let results = [...store.leads];
      if (args?.where?.organizationId) {
        results = results.filter((l) => l.organizationId === args.where.organizationId);
      }
      return results;
    },
    create: async (args: { data: any }) => {
      const lead = { id: `mock-lead-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date(), updatedAt: new Date(), ...args.data };
      store.leads.push(lead);
      return lead;
    },
    count: async () => store.leads.length,
  },

  company: {
    findMany: async (args?: any) => {
      let results = [...store.companies];
      if (args?.where?.organizationId) {
        results = results.filter((c) => c.organizationId === args.where.organizationId);
      }
      return results;
    },
    findFirst: async (args?: any) => {
      if (args?.where?.domain) {
        return store.companies.find((c) => c.domain === args.where.domain) || null;
      }
      if (args?.where?.name) {
        return store.companies.find((c) => c.name === args.where.name) || null;
      }
      return store.companies[0] || null;
    },
    create: async (args: { data: any }) => {
      const company = { id: `mock-company-${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: new Date(), updatedAt: new Date(), ...args.data };
      store.companies.push(company);
      return company;
    },
    count: async () => store.companies.length,
  },

  importJob: {
    findUnique: async (args: { where: { id: string } }) => {
      return store.importJobs.find((j) => j.id === args.where.id) || null;
    },
    create: async (args: { data: any }) => {
      const job = { id: `mock-import-${Date.now()}`, createdAt: new Date(), updatedAt: new Date(), ...args.data };
      store.importJobs.push(job);
      return job;
    },
    update: async (args: { where: { id: string }; data: any }) => {
      const idx = store.importJobs.findIndex((j) => j.id === args.where.id);
      if (idx >= 0) {
        store.importJobs[idx] = { ...store.importJobs[idx], ...args.data, updatedAt: new Date() };
        return store.importJobs[idx];
      }
      return null;
    },
    findMany: async (args?: any) => {
      let results = [...store.importJobs];
      if (args?.where?.organizationId) {
        results = results.filter((j) => j.organizationId === args.where.organizationId);
      }
      return results;
    },
  },

  importRow: {
    createMany: async (args: { data: any[] }) => {
      for (const row of args.data) {
        store.importRows.push({ id: `mock-row-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...row });
      }
      return { count: args.data.length };
    },
    findMany: async (args?: any) => {
      let results = [...store.importRows];
      if (args?.where?.importJobId) {
        results = results.filter((r) => r.importJobId === args.where.importJobId);
      }
      return results;
    },
    updateMany: async (args: { where: any; data: any }) => {
      let count = 0;
      for (const row of store.importRows) {
        if (args.where.importJobId && row.importJobId !== args.where.importJobId) continue;
        Object.assign(row, args.data);
        count++;
      }
      return { count };
    },
  },

  // Reset for testing
  _reset: () => {
    store.leads = [];
    store.companies = [];
    store.importJobs = [];
    store.importRows = [];
  },
};
