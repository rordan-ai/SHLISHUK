import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

function supabaseCredentials() {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
    anon: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '',
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anon } = supabaseCredentials()
  return Boolean(
    url && anon && (url.startsWith('https://') || url.startsWith('http://')),
  )
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const { url, anon } = supabaseCredentials()
  if (!(url && anon)) return null

  if (!browserClient) {
    browserClient = createClient(url, anon)
  }
  return browserClient
}
