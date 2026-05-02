import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  const url = import.meta.env.VITE_SUPABASE_URL!
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY!
  if (!browserClient) {
    browserClient = createClient(url, anon)
  }
  return browserClient
}
