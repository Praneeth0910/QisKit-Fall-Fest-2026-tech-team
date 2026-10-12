import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jpciyrodeppqpkwqblpk.supabase.co';
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_wjeOXSiT7E63DsDqTaL1cw_JBMTC3kj';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[Supabase] Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Using anon key fallback for database access.'
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

