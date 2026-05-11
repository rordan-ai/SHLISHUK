/**
 * דחיסה של תמונה בצד הקליינט והעלאה ל-Supabase Storage (bucket: shlishuk-images).
 * מחזיר תמיד URL ציבורי (CDN) — לא base64.
 */
import type { UploadedImage } from './draftTypes'
import { ensureSupabaseClient } from './supabaseClient'

const BUCKET = 'shlishuk-images'
/** גודל מקסימלי לתמונת דף (גם ל-hero/secondary). מספיק להצגה גם ב-Retina. */
const MAX_DIMENSION = 1600
/** דחיסה איכותית מאוד; WebP חוסך משמעותית מ-PNG/JPEG. */
const TARGET_QUALITY = 0.85
const TARGET_TYPE = 'image/webp'

const PLAIN_TYPES_ALWAYS = new Set(['image/svg+xml', 'image/gif'])

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function fileExtension(file: File): string {
  const parts = file.name.split('.')
  if (parts.length < 2) return ''
  return parts.pop()!.toLowerCase()
}

function loadHTMLImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

async function compressToWebp(file: File): Promise<{
  blob: Blob
  contentType: string
  ext: string
}> {
  if (PLAIN_TYPES_ALWAYS.has(file.type)) {
    const ext = fileExtension(file) || (file.type === 'image/svg+xml' ? 'svg' : 'gif')
    return { blob: file, contentType: file.type, ext }
  }

  let img: HTMLImageElement
  try {
    img = await loadHTMLImage(file)
  } catch {
    const ext = fileExtension(file) || 'bin'
    return { blob: file, contentType: file.type || 'application/octet-stream', ext }
  }

  const ratio = Math.min(
    1,
    MAX_DIMENSION / img.naturalWidth,
    MAX_DIMENSION / img.naturalHeight,
  )
  const targetW = Math.round(img.naturalWidth * ratio)
  const targetH = Math.round(img.naturalHeight * ratio)

  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(targetW, targetH)
      : Object.assign(document.createElement('canvas'), {
          width: targetW,
          height: targetH,
        })

  const ctx = (canvas as HTMLCanvasElement).getContext('2d')
  if (!ctx) {
    const ext = fileExtension(file) || 'bin'
    return { blob: file, contentType: file.type || 'application/octet-stream', ext }
  }
  ;(ctx as CanvasRenderingContext2D).drawImage(img, 0, 0, targetW, targetH)

  const blob: Blob | null =
    'convertToBlob' in canvas
      ? await (canvas as OffscreenCanvas).convertToBlob({
          type: TARGET_TYPE,
          quality: TARGET_QUALITY,
        })
      : await new Promise<Blob | null>((resolve) =>
          (canvas as HTMLCanvasElement).toBlob(
            (b) => resolve(b),
            TARGET_TYPE,
            TARGET_QUALITY,
          ),
        )

  if (!blob) {
    const ext = fileExtension(file) || 'bin'
    return { blob: file, contentType: file.type || 'application/octet-stream', ext }
  }

  return { blob, contentType: TARGET_TYPE, ext: 'webp' }
}

function publicUrlForObject(supabaseUrl: string, path: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${path}`
}

function sanitizeBranchPrefix(rowId: string) {
  return rowId.replace(/[^A-Za-z0-9_-]+/g, '-') || 'default'
}

/**
 * מעלה תמונה ל-Storage עם prefix של הסניף. אם אין לקוח Supabase מוגדר —
 * נופל ל-base64 (offline/dev) כך שהאדמין לא חסום בלי הגדרות.
 */
export async function uploadImage(
  file: File,
  branchRowId: string,
): Promise<UploadedImage> {
  const id = createId()

  const clientPromise = ensureSupabaseClient()
  if (!clientPromise) {
    return readImageAsDataUrl(file, id)
  }

  let prepared: { blob: Blob; contentType: string; ext: string }
  try {
    prepared = await compressToWebp(file)
  } catch {
    prepared = { blob: file, contentType: file.type, ext: fileExtension(file) || 'bin' }
  }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^\u0590-\u05FFa-zA-Z0-9-_]+/g, '-')
    .slice(0, 60) || 'image'
  const branchPrefix = sanitizeBranchPrefix(branchRowId)
  const objectPath = `${branchPrefix}/${new Date()
    .toISOString()
    .slice(0, 10)}/${id}-${safeName}.${prepared.ext}`

  const client = await clientPromise

  const { error } = await client.storage.from(BUCKET).upload(objectPath, prepared.blob, {
    contentType: prepared.contentType,
    cacheControl: '31536000, immutable',
    upsert: false,
  })
  if (error) {
    return readImageAsDataUrl(file, id)
  }

  return {
    id,
    name: file.name,
    src: publicUrlForObject(supabaseUrl, objectPath),
  }
}

export async function uploadImages(
  files: File[],
  branchRowId: string,
): Promise<UploadedImage[]> {
  return Promise.all(files.map((f) => uploadImage(f, branchRowId)))
}

/** מחיקת קובץ ב-Storage לפי URL ציבורי שלנו. שגיאות נבלעות (לא חוסמות UI). */
export async function deleteUploadedImage(image: UploadedImage | null) {
  if (!image) return
  if (!image.src.startsWith('http')) return
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  if (!url) return
  const prefix = `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`
  if (!image.src.startsWith(prefix)) return
  const path = image.src.slice(prefix.length)

  const clientPromise = ensureSupabaseClient()
  if (!clientPromise) return

  try {
    const client = await clientPromise
    await client.storage.from(BUCKET).remove([path])
  } catch {
    /* התעלם — תמונה יתומה לא חוסמת */
  }
}

function readImageAsDataUrl(file: File, id: string): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve({ id, name: file.name, src: String(reader.result) })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
