import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from 'react'

import type { LandingDraft, UploadedImage } from './draftTypes'
import { isSupabaseConfigured, saveDraft } from './draftStorage'
import {
  deleteUploadedImage,
  uploadImage,
  uploadImages,
} from './imageUpload'

const AUTOSAVE_DEBOUNCE_MS = 350
const SAVE_TIMEOUT_MS = 12000

function saveDraftWithTimeout(draft: LandingDraft) {
  return Promise.race([
    saveDraft(draft),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('שמירה לקחה יותר מדי. נסה שוב.')),
        SAVE_TIMEOUT_MS,
      ),
    ),
  ])
}

type AdminAppProps = {
  draft: LandingDraft
  setDraft: Dispatch<SetStateAction<LandingDraft>>
  isDraftLoaded: boolean
  deferRemotePersist: boolean
  storageError: string
  setStorageError: (value: string) => void
  buildPublicUrl: () => string
  buildPublicAdminUrl: () => string
}

type PreviewSlotId = 'logo' | 'hero' | 'secondary'

function UploadPreviewBlock({
  inputId,
  uploadLabel,
  image,
  onFileChange,
  onRemove,
  removeLabel,
  saveBusy,
  saveFeedbackSlot,
  slotId,
  onSaveNow,
}: {
  inputId: string
  uploadLabel: string
  image: UploadedImage | null
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>
  onRemove: () => void
  removeLabel: string
  saveBusy: boolean
  saveFeedbackSlot: PreviewSlotId | null
  slotId: PreviewSlotId
  onSaveNow: () => Promise<void>
}) {
  const justSaved = saveFeedbackSlot === slotId

  return (
    <div className="upload-preview-block">
      <div className="upload-actions-row">
        <label className="upload-button" htmlFor={inputId}>
          {uploadLabel}
          <input
            id={inputId}
            accept="image/*"
            type="file"
            onChange={(event) => void onFileChange(event)}
          />
        </label>
        <button
          type="button"
          className="ghost-button admin-save-inline"
          disabled={saveBusy}
          onClick={() => void onSaveNow()}
        >
          {saveBusy ? 'שומר…' : justSaved ? '✓ נשמר' : 'שמור עכשיו'}
        </button>
      </div>

      <figure className="admin-thumb-slot">
        {image ? (
          <img
            className="admin-thumb"
            src={image.src}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="admin-thumb-empty">טרם הועלה תמונה</div>
        )}
        <figcaption
          className={`admin-thumb-caption${image ? ' is-file' : ''}`}
        >
          {image ? (
            <>
              <span className="admin-thumb-status loaded">נטען: </span>
              {image.name}
            </>
          ) : (
            <span className="admin-thumb-status empty">אין קובץ מקושר בשדה זה</span>
          )}
        </figcaption>
      </figure>

      {image ? (
        <button className="ghost-button" type="button" onClick={onRemove}>
          {removeLabel}
        </button>
      ) : null}
    </div>
  )
}

export default function AdminApp({
  draft,
  setDraft,
  isDraftLoaded,
  deferRemotePersist,
  storageError,
  setStorageError,
  buildPublicUrl,
  buildPublicAdminUrl,
}: AdminAppProps) {
  const [copied, setCopied] = useState(false)
  const [copiedAdmin, setCopiedAdmin] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [saveFeedbackSlot, setSaveFeedbackSlot] = useState<PreviewSlotId | null>(
    null,
  )
  const draftRef = useRef(draft)
  const autosaveTimerRef = useRef<number | null>(null)
  const inFlightSaveRef = useRef<Promise<unknown> | null>(null)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  function clearAutosaveTimer() {
    if (autosaveTimerRef.current != null) {
      window.clearTimeout(autosaveTimerRef.current)
      autosaveTimerRef.current = null
    }
  }

  async function flushSave(): Promise<void> {
    clearAutosaveTimer()
    while (inFlightSaveRef.current) {
      try {
        await inFlightSaveRef.current
      } catch {
        /* נספר את השגיאה למטה */
      }
      if (inFlightSaveRef.current === null) break
    }
    const snapshot = draftRef.current
    const promise = saveDraftWithTimeout(snapshot)
    inFlightSaveRef.current = promise
    try {
      await promise
      setStorageError('')
    } catch {
      if (!isSupabaseConfigured()) {
        setStorageError(
          'לא ניתן לשמור את התמונות בדפדפן. נסה תמונות קלות יותר.',
        )
      } else {
        setStorageError('לא ניתן לשמור בהגדרה המשותפת. נסה שוב.')
      }
      throw new Error('save_failed')
    } finally {
      if (inFlightSaveRef.current === promise) {
        inFlightSaveRef.current = null
      }
    }
  }

  async function persistNow(slot: PreviewSlotId) {
    if (saveBusy) return
    setSaveBusy(true)
    setSaveFeedbackSlot(null)
    try {
      await flushSave()
      setSaveFeedbackSlot(slot)
      window.setTimeout(() => setSaveFeedbackSlot(null), 2000)
    } catch {
      /* flushSave כבר עידכן storageError */
    } finally {
      setSaveBusy(false)
    }
  }

  useEffect(() => {
    if (!isDraftLoaded || deferRemotePersist) return

    clearAutosaveTimer()
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null
      void flushSave().catch(() => {
        /* flushSave already set storageError */
      })
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => clearAutosaveTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, isDraftLoaded, deferRemotePersist])

  function handleCopyUrl() {
    navigator.clipboard.writeText(buildPublicUrl()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleCopyAdminUrl() {
    navigator.clipboard.writeText(buildPublicAdminUrl()).then(() => {
      setCopiedAdmin(true)
      setTimeout(() => setCopiedAdmin(false), 2000)
    })
  }

  async function handleSlotUpload(
    event: ChangeEvent<HTMLInputElement>,
    field: 'heroImage' | 'logoImage' | 'secondaryImage',
  ) {
    const file = event.target.files?.[0]
    if (!file) return
    setStorageError('')
    let image: UploadedImage
    try {
      image = await uploadImage(file)
    } catch {
      setStorageError('העלאת התמונה נכשלה. נסה תמונה קלה יותר.')
      event.target.value = ''
      return
    }

    const prevImage = draftRef.current[field]
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: image,
    } as LandingDraft))
    event.target.value = ''

    void deleteUploadedImage(prevImage)
  }

  async function handleHeroUpload(event: ChangeEvent<HTMLInputElement>) {
    return handleSlotUpload(event, 'heroImage')
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    return handleSlotUpload(event, 'logoImage')
  }

  async function handleSecondaryUpload(event: ChangeEvent<HTMLInputElement>) {
    return handleSlotUpload(event, 'secondaryImage')
  }

  async function handleOfferUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).sort((firstFile, nextFile) =>
      firstFile.name.localeCompare(nextFile.name, 'he', { numeric: true }),
    )
    if (files.length === 0) return
    setStorageError('')
    let images: UploadedImage[]
    try {
      images = await uploadImages(files)
    } catch {
      setStorageError('העלאת התמונה נכשלה. נסה תמונה קלה יותר.')
      event.target.value = ''
      return
    }
    setDraft((currentDraft) => ({
      ...currentDraft,
      offerImages: [...currentDraft.offerImages, ...images],
    }))
    event.target.value = ''
  }

  function removeOfferImage(id: string) {
    const removed =
      draftRef.current.offerImages.find((img) => img.id === id) ?? null
    setDraft((currentDraft) => ({
      ...currentDraft,
      offerImages: currentDraft.offerImages.filter((image) => image.id !== id),
    }))
    void deleteUploadedImage(removed)
  }

  function clearSlot(field: 'heroImage' | 'logoImage' | 'secondaryImage') {
    const removed = draftRef.current[field]
    setDraft((currentDraft) => ({
      ...currentDraft,
      [field]: null,
    } as LandingDraft))
    void deleteUploadedImage(removed)
  }

  function moveOfferImage(id: string, direction: -1 | 1) {
    setDraft((currentDraft) => {
      const currentIndex = currentDraft.offerImages.findIndex(
        (image) => image.id === id,
      )
      const nextIndex = currentIndex + direction

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= currentDraft.offerImages.length
      ) {
        return currentDraft
      }

      const offerImages = [...currentDraft.offerImages]
      const [image] = offerImages.splice(currentIndex, 1)
      offerImages.splice(nextIndex, 0, image)

      return { ...currentDraft, offerImages }
    })
  }

  return (
    <main className="admin-page" dir="rtl">
      <section className="admin-panel" aria-labelledby="admin-title">
        {!isSupabaseConfigured() ? (
          <p className="admin-local-hint">
            מצב מקומי בלבד: הנתונים נשמרים בדפדפן. לסנכרון עם הכתובת החיצונית הגדר
            Supabase (ראה setup/supabase.sql).
          </p>
        ) : null}

        <div className="panel-heading">
          <p className="eyebrow">SHLISHUK Back Office</p>
          <h1 id="admin-title">בניית דף מבצעים שבועי</h1>
          <p>
            העלאת תמונת פתיחה ותמונות מבצעים. התמונות אחרי הפתיחה מוצגות אחת מתחת
            לשנייה לפי סדר ההעלאה.
          </p>
          <p className="preview-links-inline">
            <a
              className="preview-link"
              href={buildPublicUrl()}
              target="_blank"
              rel="noreferrer"
            >
              פתיחת הדף הציבורי
            </a>
            <span className="preview-links-sep"> · </span>
            <a
              className="preview-link"
              href={buildPublicAdminUrl()}
              target="_blank"
              rel="noreferrer"
            >
              כתובת האדמין (להעתקה / לשימוש ב-GitHub Pages)
            </a>
          </p>
          {storageError ? (
            <p className="error-message">{storageError}</p>
          ) : null}
        </div>

        <div className="control-grid">
          <section className="upload-card" aria-labelledby="page-header-title">
            <div>
              <h2 id="page-header-title">כותרת ראשית ולוגו</h2>
              <p>יוצגו בראש הדף הציבורי מעל התמונות.</p>
            </div>
            <label className="field-label">
              כותרת ראשית
              <input
                className="text-field"
                type="text"
                value={draft.title}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    title: event.target.value,
                  }))
                }
                placeholder="לדוגמה: מבצעים של השבוע"
              />
            </label>
            <UploadPreviewBlock
              slotId="logo"
              inputId="admin-upload-logo"
              uploadLabel="העלאת לוגו"
              image={draft.logoImage}
              onFileChange={handleLogoUpload}
              onRemove={() => clearSlot('logoImage')}
              removeLabel="הסר לוגו"
              saveBusy={saveBusy}
              saveFeedbackSlot={saveFeedbackSlot}
              onSaveNow={() => persistNow('logo')}
            />
          </section>

          <section className="upload-card" aria-labelledby="social-links-title">
            <div>
              <h2 id="social-links-title">רשתות חברתיות</h2>
              <p>קישורים שיופיעו בראש הדף.</p>
            </div>
            <label className="field-label">
              פייסבוק
              <input
                className="text-field"
                type="url"
                value={draft.socialLinks.facebook}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    socialLinks: {
                      ...currentDraft.socialLinks,
                      facebook: event.target.value,
                    },
                  }))
                }
                placeholder="https://facebook.com/..."
              />
            </label>
            <label className="field-label">
              אינסטגרם
              <input
                className="text-field"
                type="url"
                value={draft.socialLinks.instagram}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    socialLinks: {
                      ...currentDraft.socialLinks,
                      instagram: event.target.value,
                    },
                  }))
                }
                placeholder="https://instagram.com/..."
              />
            </label>
          </section>

          <section className="upload-card" aria-labelledby="hero-upload-title">
            <div>
              <h2 id="hero-upload-title">תמונה ראשית</h2>
              <p>מוצגת בראש דף המבצעים.</p>
            </div>
            <UploadPreviewBlock
              slotId="hero"
              inputId="admin-upload-hero"
              uploadLabel="העלאת תמונה ראשית"
              image={draft.heroImage}
              onFileChange={handleHeroUpload}
              onRemove={() => clearSlot('heroImage')}
              removeLabel="הסר תמונה ראשית"
              saveBusy={saveBusy}
              saveFeedbackSlot={saveFeedbackSlot}
              onSaveNow={() => persistNow('hero')}
            />
          </section>

          <section
            className="upload-card"
            aria-labelledby="secondary-upload-title"
          >
            <div>
              <h2 id="secondary-upload-title">תמונה משנית</h2>
              <p>מוצגת מתחת לתמונה הראשית.</p>
            </div>
            <UploadPreviewBlock
              slotId="secondary"
              inputId="admin-upload-secondary"
              uploadLabel="העלאת תמונה משנית"
              image={draft.secondaryImage}
              onFileChange={handleSecondaryUpload}
              onRemove={() => clearSlot('secondaryImage')}
              removeLabel="הסר תמונה משנית"
              saveBusy={saveBusy}
              saveFeedbackSlot={saveFeedbackSlot}
              onSaveNow={() => persistNow('secondary')}
            />
          </section>

          <section className="upload-card" aria-labelledby="offers-upload-title">
            <div>
              <h2 id="offers-upload-title">תוכן אחרי תמונה</h2>
              <p>רק תמונות. בלי עורך טקסט, פונטים, יישורים או וידאו.</p>
            </div>
            <label className="upload-button">
              העלאת תמונות מבצעים
              <input
                accept="image/*"
                multiple
                type="file"
                onChange={handleOfferUpload}
              />
            </label>
          </section>
        </div>

        <section className="image-list" aria-labelledby="image-list-title">
          <h2 id="image-list-title">סדר תמונות המבצעים</h2>
          {draft.offerImages.length > 0 ? (
            <ol>
              {draft.offerImages.map((image, index) => (
                <li key={image.id}>
                  <span>{index + 1}</span>
                  <img src={image.src} alt="" />
                  <strong>{image.name}</strong>
                  <div className="image-actions">
                    <button
                      type="button"
                      onClick={() => moveOfferImage(image.id, -1)}
                      disabled={index === 0}
                    >
                      למעלה
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOfferImage(image.id, 1)}
                      disabled={index === draft.offerImages.length - 1}
                    >
                      למטה
                    </button>
                  </div>
                  <button type="button" onClick={() => removeOfferImage(image.id)}>
                    הסר
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-state">עדיין אין תמונות מבצעים.</p>
          )}
        </section>

        <div className="page-url-rows" dir="rtl">
          <div className="page-url-bar">
            <span className="page-url-label">כתובת הדף הציבורי:</span>
            <code className="page-url-value">{buildPublicUrl()}</code>
            <button type="button" className="copy-url-button" onClick={handleCopyUrl}>
              {copied ? '✓ הועתק' : 'העתק'}
            </button>
          </div>
          <div className="page-url-bar">
            <span className="page-url-label">כתובת האדמין (אותה סביבה):</span>
            <code className="page-url-value">{buildPublicAdminUrl()}</code>
            <button
              type="button"
              className="copy-url-button"
              onClick={handleCopyAdminUrl}
            >
              {copiedAdmin ? '✓ הועתק' : 'העתק'}
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
