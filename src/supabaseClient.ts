import type { SupabaseClient } from '@supabase/supabase-js'

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

/** לקוח Supabase נטען כ־lazy chunk — הקוד בדף הציבורי לא כולל את החבילה בתחילה. */
let clientPromise: Promise<SupabaseClient> | null = null

export function ensureSupabaseClient(): Promise<SupabaseClient> | null {
  const { url, anon } = supabaseCredentials()
  if (!(url && anon)) {
    clientPromise = null
    return null
  }
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anon),
    )
  }
  return clientPromise
}
