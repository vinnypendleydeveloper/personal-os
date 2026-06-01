import { createClient } from '@supabase/supabase-js'

// Server-side client using the service role key (bypasses RLS)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Shared user ID — single-user personal OS
export const USER_ID = process.env.USER_ID ?? 'me'
