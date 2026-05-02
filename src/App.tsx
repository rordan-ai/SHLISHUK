import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react'
import './App.css'

import LandingPage from './LandingPage'
import type { LandingDraft } from './draftTypes'
import {
  emptyDraft,
  isSupabaseConfigured,
  loadDraftFromBrowserCache,
  loadDraftFromCloud,
  persistDraftLocally,
} from './draftStorage'
import { ensureSupabaseClient } from './supabaseClient'

const AdminApp = lazy(() => import('./AdminApp'))

function baseUrlWithSlash() {
  const b = import.meta.env.BASE_URL
  return b.endsWith('/') ? b : `${b}/`
}

function normalizedAppPathname(fullPathname: string) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  let suffix: string

  if (!base || base === '') {
    suffix = fullPathname
  } else if (fullPathname.startsWith(base)) {
    suffix = fullPathname.slice(base.length) || '/'
    if (!suffix.startsWith('/')) suffix = `/${suffix}`
  } else {
    suffix = fullPathname
  }

  if (suffix.length > 1 && suffix.endsWith('/')) {
    suffix = suffix.slice(0, -1)
  }
  if (!suffix.startsWith('/')) {
    suffix = `/${suffix}`
  }
  return suffix
}

function resolveIsAdminRoute() {
  return normalizedAppPathname(window.location.pathname) === '/admin'
}

function buildPublicUrl() {
  const explicit = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`
  }
  const origin = window.location.origin
  const base = baseUrlWithSlash()
  return `${origin}${base}`
}

function buildPublicAdminUrl() {
  const explicit = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    const base = explicit.replace(/\/$/, '')
    return `${base}/admin`
  }
  const origin = window.location.origin
  const base = baseUrlWithSlash()
  return `${origin}${base}admin`
}

function AdminFallback() {
  return (
    <main className="admin-page" dir="rtl">
      <p className="admin-suspense-fallback">טוען אדמין…</p>
    </main>
  )
}

function App() {
  const isAdminRoute = resolveIsAdminRoute()
  const [draft, setDraft] = useState<LandingDraft>(emptyDraft)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [deferRemotePersist, setDeferRemotePersist] = useState(
    () => isAdminRoute && isSupabaseConfigured(),
  )

  useLayoutEffect(() => {
    let cancel = false

    ;(async () => {
      if (isSupabaseConfigured()) {
        try {
          const cached = await loadDraftFromBrowserCache()
          if (!cancel) setDraft(cached)
        } catch {
          /* ממשיכים למשיכת ענן */
        }

        try {
          const remote = await loadDraftFromCloud()
          if (!cancel) {
            await persistDraftLocally(remote)
            setDraft(remote)
          }
        } catch {
          if (!cancel && isAdminRoute) {
            setStorageError(
              'לא ניתן לטעון מהענן. מוצגים נתונים מהדפדפן כשיש.',
            )
          }
        }
      } else {
        const local = await loadDraftFromBrowserCache()
        if (!cancel) setDraft(local)
      }

      if (!cancel) {
        setIsDraftLoaded(true)
        setDeferRemotePersist(false)
      }
    })()

    return () => {
      cancel = true
    }
  }, [isAdminRoute])

  useEffect(() => {
    if (isAdminRoute || !isSupabaseConfigured()) return

    let idleHandle = 0

    function warmSupabaseChunk() {
      void ensureSupabaseClient()
    }

    if (typeof window.requestIdleCallback === 'function') {
      idleHandle = window.requestIdleCallback(warmSupabaseChunk)
      return () => window.cancelIdleCallback(idleHandle)
    }

    const t = window.setTimeout(warmSupabaseChunk, 1)
    return () => window.clearTimeout(t)
  }, [isAdminRoute])

  if (!isAdminRoute) {
    return <LandingPage draft={draft} />
  }

  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminApp
        draft={draft}
        setDraft={setDraft}
        isDraftLoaded={isDraftLoaded}
        deferRemotePersist={deferRemotePersist}
        storageError={storageError}
        setStorageError={setStorageError}
        buildPublicUrl={buildPublicUrl}
        buildPublicAdminUrl={buildPublicAdminUrl}
      />
    </Suspense>
  )
}

export default App
