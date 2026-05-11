import { ensureSupabaseClient, isSupabaseConfigured } from './supabaseClient'
import type { LandingDraft } from './draftTypes'
import { DEFAULT_BRANCH } from './branches'

export { isSupabaseConfigured }

const DB_NAME = 'shlishuk-weekly-offers'
const DB_VERSION = 1
const LEGACY_STORAGE_KEY = 'shlishuk-weekly-offers-draft'
const STORE_NAME = 'drafts'
/** המפתח הישן שהיה בשימוש לפני multi-branch (נשמר כתאימות אחורה). */
const LEGACY_INDEXEDDB_KEY = 'current-draft'

function indexedDbKeyForRow(rowId: string) {
  // אותו מפתח שהיה בעבר עבור ה-row הראשי, כדי לא לאבד טיוטה מקומית
  if (rowId === DEFAULT_BRANCH.rowId) return LEGACY_INDEXEDDB_KEY
  return `draft:${rowId}`
}

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

function readDraftFromDatabase(
  db: IDBDatabase,
  key: string,
): Promise<LandingDraft | null> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const request = transaction.objectStore(STORE_NAME).get(key)

    request.onsuccess = () => {
      resolve(request.result ? normalizeDraft(request.result) : null)
    }

    request.onerror = () => reject(request.error)
  })
}

function writeDraftToDatabase(db: IDBDatabase, draft: LandingDraft, key: string) {
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const request = transaction.objectStore(STORE_NAME).put(draft, key)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function loadDraftFromIndexedDb(rowId: string): Promise<LandingDraft> {
  try {
    const db = await openDraftDatabase()
    const key = indexedDbKeyForRow(rowId)
    const storedDraft = await readDraftFromDatabase(db, key)
    db.close()

    if (storedDraft) return storedDraft

    // Legacy localStorage רק לסניף הראשי (היה שמור שם בפעם הראשונה)
    if (rowId === DEFAULT_BRANCH.rowId) {
      const rawDraft = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (rawDraft) {
        return normalizeDraft(JSON.parse(rawDraft) as Partial<LandingDraft>)
      }
    }

    return emptyDraft
  } catch {
    return emptyDraft
  }
}

async function saveDraftToIndexedDb(draft: LandingDraft, rowId: string) {
  const db = await openDraftDatabase()
  await writeDraftToDatabase(db, draft, indexedDbKeyForRow(rowId))
  db.close()
}

/**
 * משיכת payload ישירות מ‑PostgREST של Supabase ללא הספרייה (חוסך chunk גדול).
 * אם startPublicDraftPrefetch כבר התחיל בקשה לאותו rowId — נשתמש בה.
 */
async function loadDraftFromSupabaseRest(rowId: string): Promise<LandingDraft> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url || !anon) return loadDraftFromIndexedDb(rowId)

  const inflight =
    typeof window !== 'undefined' ? window.__shlishukDraftRequests : undefined
  const cached = inflight?.[rowId]
  if (cached) {
    const draft = await cached
    if (draft) return draft
  }

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/shlishuk_draft?select=payload&id=eq.${encodeURIComponent(
    rowId,
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

async function saveDraftToSupabase(draft: LandingDraft, rowId: string) {
  const clientAwaited = ensureSupabaseClient()
  if (!clientAwaited) throw new Error('Supabase not configured')

  const client = await clientAwaited

  const { error } = await client.from('shlishuk_draft').upsert(
    {
      id: rowId,
      payload: draft,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )

  if (error) throw error
}

/** תצוגה מיידית מ‑IndexedDB. */
export async function loadDraftFromBrowserCache(
  rowId: string,
): Promise<LandingDraft> {
  return loadDraftFromIndexedDb(rowId)
}

/** משיכה מהענן (REST ישיר). */
export async function loadDraftFromCloud(rowId: string): Promise<LandingDraft> {
  return loadDraftFromSupabaseRest(rowId)
}

export async function persistDraftLocally(
  draft: LandingDraft,
  rowId: string,
): Promise<void> {
  await saveDraftToIndexedDb(draft, rowId)
}

/** זיכרון דפדפן תמיד, וגם הענן אם מוגדר. */
export async function saveDraft(draft: LandingDraft, rowId: string) {
  try {
    await saveDraftToIndexedDb(draft, rowId)
  } catch {
    /* לא חוסם שמירה בענן */
  }
  if (isSupabaseConfigured()) {
    await saveDraftToSupabase(draft, rowId)
  }
}
