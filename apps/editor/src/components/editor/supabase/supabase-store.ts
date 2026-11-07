import { create } from "zustand";

// Names of the tables and views in the project's saved Supabase schema. The type pickers offer
// "Supabase Row" only when this has entries. Set from the server on editor load and by the
// Supabase page after a fetch or clear.

interface SupabaseTablesState {
  tables: string[];
  setTables: (tables: string[]) => void;
}

export const useSupabaseTables = create<SupabaseTablesState>((set) => ({
  tables: [],
  setTables: (tables) => set({ tables })
}));
