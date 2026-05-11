/**
 * preconnect + prefetch מוקדם של ה-payload לפי הסניף הנוכחי מה-URL.
 * רץ בייבוא — לפני React mount.
 */
import type { LandingDraft } from './draftTypes'
import { normalizeDraft } from './draftStorage'
import { BRANCHES, DEFAULT_BRANCH, findBranchBySlug } from './branches'

declare global {
  interface Window {
    /** מילון לפי rowId → Promise של draft. */
    __shlishukDraftRequests?: Record<string, Promise<LandingDraft | null>>
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

function normalizedPathSuffix() {
  if (typeof window === 'undefined') return '/'
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  let suffix = window.location.pathname
  if (base && suffix.startsWith(base)) suffix = suffix.slice(base.length) || '/'
  if (suffix.length > 1 && suffix.endsWith('/')) suffix = suffix.slice(0, -1)
  if (!suffix.startsWith('/')) suffix = `/${suffix}`
  return suffix
}

function isAdminPath() {
  const suffix = normalizedPathSuffix()
  return suffix === '/admin' || suffix.startsWith('/admin/')
}

function resolveBranchFromUrl() {
  const suffix = normalizedPathSuffix()
  // /admin or /admin/<slug>
  if (suffix === '/admin' || suffix === '/admin/') {
    return null // dashboard — לא טוענים branch ספציפי לפרה-פטץ'
  }
  if (suffix.startsWith('/admin/')) {
    const slug = suffix.slice('/admin/'.length)
    return findBranchBySlug(slug)
  }
  // ציבורי
  if (suffix === '/' || suffix === '') return DEFAULT_BRANCH
  const slug = suffix.replace(/^\/+/, '')
  return findBranchBySlug(slug)
}

function startFetchForRowId(rowId: string) {
  const env = readEnv()
  if (!env) return

  const supabaseHost = new URL(env.url).origin
  injectPreconnect(supabaseHost)

  if (!window.__shlishukDraftRequests) window.__shlishukDraftRequests = {}
  if (rowId in window.__shlishukDraftRequests) return

  const endpoint = `${env.url}/rest/v1/shlishuk_draft?select=payload&id=eq.${encodeURIComponent(
    rowId,
  )}`

  window.__shlishukDraftRequests[rowId] = fetch(endpoint, {
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

export function startPublicDraftPrefetch() {
  if (typeof window === 'undefined') return

  const branch = resolveBranchFromUrl()
  if (branch) {
    startFetchForRowId(branch.rowId)
  } else if (isAdminPath()) {
    // אדמין dashboard — נטעין מראש את כל הסניפים (קל, JSON קטן)
    for (const b of BRANCHES) startFetchForRowId(b.rowId)
  }
}
