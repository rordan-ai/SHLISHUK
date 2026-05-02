/**
 * מבצע preconnect+prefetch ל‑Supabase מוקדם ככל הניתן: רץ בזמן ייבוא המודול
 * (לפני React mount). הפונקציה loadDraftFromCloud תעדיף לקרוא את ה‑payload
 * מתוך אותה Promise במקום לפתוח חיבור חדש.
 */
import type { LandingDraft } from './draftTypes'
import { normalizeDraft } from './draftStorage'

const REMOTE_ROW_ID = 'default'

declare global {
  interface Window {
    __shlishukDraftRequest?: Promise<LandingDraft | null>
  }
}

function readEnv() {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !anon) return null
  return { url: url.replace(/\/$/, ''), anon }
}

function injectPreconnect(host: string) {
  if (typeof document === 'undefined') return
  const head = document.head
  if (!head) return
  if (head.querySelector(`link[rel="preconnect"][href="${host}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = host
  link.crossOrigin = ''
  head.appendChild(link)
}

function preloadImage(src: string) {
  if (typeof document === 'undefined') return
  if (!src || !src.startsWith('http')) return
  const head = document.head
  if (!head) return
  if (head.querySelector(`link[rel="preload"][href="${src}"]`)) return
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = src
  link.fetchPriority = 'high'
  head.appendChild(link)
}

function isAdminPath() {
  if (typeof window === 'undefined') return false
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  let suffix = window.location.pathname
  if (base && suffix.startsWith(base)) suffix = suffix.slice(base.length) || '/'
  if (!suffix.startsWith('/')) suffix = `/${suffix}`
  return suffix === '/admin' || suffix === '/admin/'
}

export function startPublicDraftPrefetch() {
  if (typeof window === 'undefined') return
  if (window.__shlishukDraftRequest) return

  const env = readEnv()
  if (!env) return

  const supabaseHost = new URL(env.url).origin
  injectPreconnect(supabaseHost)

  const endpoint = `${env.url}/rest/v1/shlishuk_draft?select=payload&id=eq.${encodeURIComponent(
    REMOTE_ROW_ID,
  )}`

  window.__shlishukDraftRequest = fetch(endpoint, {
    headers: {
      apikey: env.anon,
      Authorization: `Bearer ${env.anon}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Supabase REST ${res.status}`)
      return res.json() as Promise<
        Array<{ payload: Partial<LandingDraft> | null }>
      >
    })
    .then((rows) => {
      const payload = rows[0]?.payload
      const draft = payload ? normalizeDraft(payload) : null
      if (draft && !isAdminPath()) {
        if (draft.heroImage?.src) preloadImage(draft.heroImage.src)
        if (draft.logoImage?.src) preloadImage(draft.logoImage.src)
      }
      return draft
    })
    .catch(() => null)
}
