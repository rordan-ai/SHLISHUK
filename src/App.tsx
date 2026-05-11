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
import {
  BRANCHES,
  DEFAULT_BRANCH,
  findBranchBySlug,
  type BranchConfig,
} from './branches'

const AdminApp = lazy(() => import('./AdminApp'))
const AdminDashboard = lazy(() => import('./AdminDashboard'))

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

type Route =
  | { kind: 'public'; branch: BranchConfig }
  | { kind: 'admin-dashboard' }
  | { kind: 'admin-branch'; branch: BranchConfig }
  | { kind: 'not-found' }

function resolveRoute(): Route {
  if (typeof window === 'undefined') {
    return { kind: 'public', branch: DEFAULT_BRANCH }
  }
  const suffix = normalizedAppPathname(window.location.pathname)

  if (suffix === '/admin') return { kind: 'admin-dashboard' }
  if (suffix.startsWith('/admin/')) {
    const slug = suffix.slice('/admin/'.length)
    const branch = findBranchBySlug(slug)
    return branch ? { kind: 'admin-branch', branch } : { kind: 'not-found' }
  }
  if (suffix === '/' || suffix === '') {
    return { kind: 'public', branch: DEFAULT_BRANCH }
  }
  const slug = suffix.replace(/^\/+/, '')
  const branch = findBranchBySlug(slug)
  return branch ? { kind: 'public', branch } : { kind: 'not-found' }
}

function siteRoot() {
  const explicit = import.meta.env.VITE_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`
  }
  const origin = window.location.origin
  const base = baseUrlWithSlash()
  return `${origin}${base}`
}

function buildPublicUrlForBranch(branch: BranchConfig) {
  const root = siteRoot()
  if (!branch.slug) return root
  return `${root}${branch.slug}`
}

function buildAdminUrlForBranch(branch: BranchConfig) {
  const root = siteRoot().replace(/\/$/, '')
  return `${root}/admin/${branch.slug || branch.rowId}`
}

function buildAdminDashboardUrl() {
  const root = siteRoot().replace(/\/$/, '')
  return `${root}/admin`
}

function AdminFallback() {
  return (
    <main className="admin-page" dir="rtl">
      <p className="admin-suspense-fallback">טוען…</p>
    </main>
  )
}

function NotFoundPage() {
  return (
    <main className="admin-page" dir="rtl">
      <section className="admin-panel">
        <div className="panel-heading">
          <p className="eyebrow">SHLISHUK</p>
          <h1>הדף לא נמצא</h1>
          <p>הכתובת אינה מוכרת. רשימת הסניפים:</p>
          <ul>
            {BRANCHES.map((b) => (
              <li key={b.rowId}>
                <a href={buildPublicUrlForBranch(b)}>{b.label}</a>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [route, setRoute] = useState<Route>(() => resolveRoute())
  const [draft, setDraft] = useState<LandingDraft>(emptyDraft)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [sharedSocialLinks, setSharedSocialLinks] = useState<
    LandingDraft['socialLinks'] | null
  >(null)

  const branchForData =
    route.kind === 'public' || route.kind === 'admin-branch' ? route.branch : null
  const isAdminBranchRoute = route.kind === 'admin-branch'
  const isSecondaryBranch =
    branchForData != null && branchForData.rowId !== DEFAULT_BRANCH.rowId
  const effectiveSharedSocialLinks = isSecondaryBranch ? sharedSocialLinks : null
  const [deferRemotePersist, setDeferRemotePersist] = useState(
    () => isAdminBranchRoute && isSupabaseConfigured(),
  )

  useEffect(() => {
    function onPopState() {
      setRoute(resolveRoute())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useLayoutEffect(() => {
    if (!branchForData) return
    let cancel = false
    const rowId = branchForData.rowId
    ;(async () => {
      setDraft(emptyDraft)
      setIsDraftLoaded(false)
      setDeferRemotePersist(isAdminBranchRoute && isSupabaseConfigured())

      if (isSupabaseConfigured()) {
        try {
          const cached = await loadDraftFromBrowserCache(rowId)
          if (!cancel) setDraft(cached)
        } catch {
          /* ממשיכים למשיכת ענן */
        }

        try {
          const remote = await loadDraftFromCloud(rowId)
          if (!cancel) {
            await persistDraftLocally(remote, rowId)
            setDraft(remote)
          }
        } catch {
          if (!cancel && isAdminBranchRoute) {
            setStorageError(
              'לא ניתן לטעון מהענן. מוצגים נתונים מהדפדפן כשיש.',
            )
          }
        }
      } else {
        const local = await loadDraftFromBrowserCache(rowId)
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
  }, [branchForData, isAdminBranchRoute])

  /**
   * סניפים משניים יורשים socialLinks מסניף הראשי (default). אנו טוענים את ה-default
   * תמיד כשלסניף הנוכחי יש rowId שונה — גם לתצוגה ציבורית וגם לתצוגה ב-admin.
   */
  useEffect(() => {
    if (!isSecondaryBranch) return
    let cancel = false
    ;(async () => {
      try {
        if (isSupabaseConfigured()) {
          try {
            const cached = await loadDraftFromBrowserCache(DEFAULT_BRANCH.rowId)
            if (!cancel && cached) setSharedSocialLinks(cached.socialLinks)
          } catch {
            /* ignore */
          }
          const remote = await loadDraftFromCloud(DEFAULT_BRANCH.rowId)
          if (!cancel) {
            await persistDraftLocally(remote, DEFAULT_BRANCH.rowId)
            setSharedSocialLinks(remote.socialLinks)
          }
        } else {
          const local = await loadDraftFromBrowserCache(DEFAULT_BRANCH.rowId)
          if (!cancel) setSharedSocialLinks(local.socialLinks)
        }
      } catch {
        /* אם default לא נטען מהענן, נמשיך עם מה שיש בdraft של הסניף */
      }
    })()
    return () => {
      cancel = true
    }
  }, [isSecondaryBranch])

  useEffect(() => {
    if (route.kind !== 'public' || !isSupabaseConfigured()) return

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
  }, [route.kind])

  if (route.kind === 'public') {
    const effectiveDraft: LandingDraft =
      effectiveSharedSocialLinks
        ? { ...draft, socialLinks: effectiveSharedSocialLinks }
        : draft
    return <LandingPage draft={effectiveDraft} />
  }

  if (route.kind === 'admin-dashboard') {
    return (
      <Suspense fallback={<AdminFallback />}>
        <AdminDashboard
          buildPublicUrlForBranch={buildPublicUrlForBranch}
          buildAdminUrlForBranch={buildAdminUrlForBranch}
        />
      </Suspense>
    )
  }

  if (route.kind === 'admin-branch') {
    const branch = route.branch
    const isSecondary = branch.rowId !== DEFAULT_BRANCH.rowId
    return (
      <Suspense fallback={<AdminFallback />}>
        <AdminApp
          branch={branch}
          draft={draft}
          setDraft={setDraft}
          isDraftLoaded={isDraftLoaded}
          deferRemotePersist={deferRemotePersist}
          storageError={storageError}
          setStorageError={setStorageError}
          buildPublicUrl={() => buildPublicUrlForBranch(branch)}
          buildPublicAdminUrl={() => buildAdminUrlForBranch(branch)}
          buildAdminDashboardUrl={buildAdminDashboardUrl}
          sharedSocialLinks={isSecondary ? effectiveSharedSocialLinks : null}
          mainBranchAdminUrl={buildAdminUrlForBranch(DEFAULT_BRANCH)}
        />
      </Suspense>
    )
  }

  return <NotFoundPage />
}

export default App
