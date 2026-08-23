import { createClient } from '@supabase/supabase-js';
import { Diagnostics } from '@/lib/diagnostics';

/**
 * Server-Only Supabase Admin Client
 * Uses the privileged SUPABASE_SERVICE_ROLE_KEY to perform administrative mutations.
 * 
 * CRITICAL SECURITY INVARIANT:
 * This key is NEVER prefixed with NEXT_PUBLIC_ and must NEVER be imported or bundled in client-side code.
 */
export function getAdminSupabaseClient() {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: Attempted to instantiate Supabase Admin Client in a browser context!');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!serviceRoleKey || serviceRoleKey.includes('placeholder')) {
    Diagnostics.warn('SUPABASE_SERVICE_ROLE_KEY not configured. Falling back to ANON client for non-sensitive operations.', {
      component: 'SupabaseAdmin',
    });
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key';
    return createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
