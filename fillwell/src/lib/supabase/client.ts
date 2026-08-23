import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { Diagnostics } from '@/lib/diagnostics';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key';

export const isSupabaseConfigured = 
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && 
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder') &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder');

if (!isSupabaseConfigured) {
  Diagnostics.warn(
    'Supabase credentials are placeholder or unconfigured. Running in local memory/store mode.',
    { component: 'SupabaseClient' }
  );
}

export function createSupabaseClient() {
  return createBrowserClient(rawUrl, rawKey);
}

export const supabase = createClient(rawUrl, rawKey);
