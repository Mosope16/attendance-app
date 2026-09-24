// Backwards compatibility alias for Neon client
import { db, useNeonClient } from './neon';

export { db, useNeonClient };
export const supabase = db;
export const useSupabaseClient = useNeonClient;
