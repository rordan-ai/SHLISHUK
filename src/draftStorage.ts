import { ensureSupabaseClient, isSupabaseConfigured } from './supabaseClient'
import type { LandingDraft } from './draftTypes'

export { isSupabaseConfigured }

const DB_NAME = 'shlishuk-weekly-offers'
const DB_VERSION = 1
const DRAFT_KEY = 'current-draft'
const LEGACY_STORAGE_KEY = 'shlishuk-weekly-offers-draft'
const STORE_NAME = 'drafts'
const REMOTE_ROW_ID = 'default'

export const emptyDraft: LandingDraft = {
  title: '',
  logoImage: null,
  heroImage: null,
  secondaryImage: null,
  offerImages: [],
  socialLinks: {
    facebook: '',
    instagram: '',
  },
}

export function normalizeDraft(draft: Partial<LandingDraft>): LandingDraft {
  return {
    ...emptyDraft,
    ...draft,
    socialLinks: {
      ...emptyDraft.socialLinks,
      ...draft.socialLinks,
    },
  }
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function readDraftFromDatabase(db: IDBDatabase): Promise<LandingDraft | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(DRAFT_KEY)

    request.onsuccess = () => {
      resolve(request.result ? normalizeDraft(request.result) : null)
    }

    request.onerror = () => reject(request.error)
  })
}

function writeDraftToDatabase(db: IDBDatabase, draft: LandingDraft) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function loadDraftFromIndexedDb(): Promise<LandingDraft> {
  try {
    const db = await openDraftDatabase()
    const storedDraft = await readDraftFromDatabase(db)
    db.close()

    if (storedDraft) return storedDraft

    const rawDraft = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!rawDraft) return emptyDraft

    return normalizeDraft(JSON.parse(rawDraft) as Partial<LandingDraft>)
  } catch {
    return emptyDraft
  }
}

async function saveDraftToIndexedDb(draft: LandingDraft) {
  const db = await openDraftDatabase()
  await writeDraftToDatabase(db, draft)
  db.close()
}

/**
 * משיכת payload ישירות מ‑PostgREST של Supabase ללא הספרייה (חוסך chunk גדול
 * שמשפיע על הטעינה הראשונית של הדף הציבורי). אם startPublicDraftPrefetch כבר
 * התחיל בקשה — נשתמש בה במקום להפעיל בקשה חדשה.
 */
async function loadDraftFromSupabaseRest(): Promise<LandingDraft> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anon) return loadDraftFromIndexedDb()

  const inflight =
    typeof window !== 'undefined' ? window.__shlishukDraftRequest : undefined

  if (inflight) {
    const draft = await inflight
    if (draft) return draft
  }

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shlishuk_draft?select=payload&id=eq.${encodeURIComponent(
    REMOTE_ROW_ID,
  )}`

  const response = await fetch(endpoint, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase REST error ${response.status}`)
  }

  const rows: Array<{ payload: Partial<LandingDraft> | null }> =
    await response.json()
  const payload = rows[0]?.payload
  if (!payload) return emptyDraft
  return normalizeDraft(payload)
}

async function saveDraftToSupabase(draft: LandingDraft) {
  const clientAwaited = ensureSupabaseClient()
  if (!clientAwaited) throw new Error('Supabase not configured')

  const client = await clientAwaited

  const { error } = await client.from('shlishuk_draft').upsert(
    {
      id: REMOTE_ROW_ID,
      payload: draft,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) throw error
}

/** תצוגה מיידית מ‑IndexedDB (אחרי שמירה כפולה זה מקורב לענן). */
export async function loadDraftFromBrowserCache(): Promise<LandingDraft> {
  return loadDraftFromIndexedDb()
}

/** משיכה מהענן (REST ישיר). */
export async function loadDraftFromCloud(): Promise<LandingDraft> {
  return loadDraftFromSupabaseRest()
}

export async function persistDraftLocally(draft: LandingDraft): Promise<void> {
  await saveDraftToIndexedDb(draft)
}

/** זיכרון דפדפן תמיד, וגם הענן אם מוגדר. */
export async function saveDraft(draft: LandingDraft) {
  try {
    await saveDraftToIndexedDb(draft)
  } catch {
    /* לא חוסם שמירה בענן */
  }
  if (isSupabaseConfigured()) {
    await saveDraftToSupabase(draft)
  }
}
