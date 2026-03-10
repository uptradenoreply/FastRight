import { createClient } from '@supabase/supabase-js';
import { Database } from './types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key is missing. Ensure they are configured in your .env file.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
