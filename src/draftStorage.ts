import { getSupabaseBrowserClient, isSupabaseConfigured } from './supabaseClient'
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

async function loadDraftFromSupabase(): Promise<LandingDraft> {
  const client = getSupabaseBrowserClient()
  if (!client) return loadDraftFromIndexedDb()

  const { data, error } = await client
    .from('shlishuk_draft')
    .select('payload')
    .eq('id', REMOTE_ROW_ID)
    .maybeSingle()

  if (error) throw error
  if (!data?.payload) return emptyDraft
  return normalizeDraft(data.payload as Partial<LandingDraft>)
}

async function saveDraftToSupabase(draft: LandingDraft) {
  const client = getSupabaseBrowserClient()
  if (!client) throw new Error('Supabase not configured')

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

export async function loadDraft(): Promise<LandingDraft> {
  if (isSupabaseConfigured()) {
    return loadDraftFromSupabase()
  }
  return loadDraftFromIndexedDb()
}

export async function saveDraft(draft: LandingDraft) {
  if (isSupabaseConfigured()) {
    return saveDraftToSupabase(draft)
  }
  return saveDraftToIndexedDb(draft)
}
