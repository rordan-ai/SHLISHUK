import { useEffect, useState, type ChangeEvent } from 'react'
import './App.css'

type UploadedImage = {
  id: string
  name: string
  src: string
}

type LandingDraft = {
  title: string
  logoImage: UploadedImage | null
  heroImage: UploadedImage | null
  secondaryImage: UploadedImage | null
  offerImages: UploadedImage[]
  socialLinks: {
    facebook: string
    instagram: string
  }
}

const DB_NAME = 'shlishuk-weekly-offers'
const DB_VERSION = 1
const DRAFT_KEY = 'current-draft'
const LEGACY_STORAGE_KEY = 'shlishuk-weekly-offers-draft'
const STORE_NAME = 'drafts'

const emptyDraft: LandingDraft = {
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

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

function readImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve({
        id: createId(),
        name: file.name,
        src: String(reader.result),
      })
    }

    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function normalizeDraft(draft: Partial<LandingDraft>): LandingDraft {
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

async function loadDraft(): Promise<LandingDraft> {
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

async function saveDraft(draft: LandingDraft) {
  const db = await openDraftDatabase()
  await writeDraftToDatabase(db, draft)
  db.close()
}

function buildPublicUrl() {
  return `${window.location.origin}/`
}

function App() {
  const [draft, setDraft] = useState<LandingDraft>(emptyDraft)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [copied, setCopied] = useState(false)
  const isAdminRoute = window.location.pathname === '/admin'

  function handleCopyUrl() {
    navigator.clipboard.writeText(buildPublicUrl()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    let isActive = true

    loadDraft()
      .then((loadedDraft) => {
        if (isActive) setDraft(loadedDraft)
      })
      .catch(() => {
        if (isActive) setStorageError('לא ניתן לטעון את הטיוטה השמורה.')
      })
      .finally(() => {
        if (isActive) setIsDraftLoaded(true)
      })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isDraftLoaded) return

    saveDraft(draft)
      .then(() => setStorageError(''))
      .catch(() => {
        setStorageError('לא ניתן לשמור את התמונות בדפדפן. נסה תמונות קלות יותר.')
      })
  }, [draft, isDraftLoaded])

  async function handleHeroUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const image = await readImage(file)
    setDraft((currentDraft) => ({ ...currentDraft, heroImage: image }))
    event.target.value = ''
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const image = await readImage(file)
    setDraft((currentDraft) => ({ ...currentDraft, logoImage: image }))
    event.target.value = ''
  }

  async function handleSecondaryUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    const image = await readImage(file)
    setDraft((currentDraft) => ({ ...currentDraft, secondaryImage: image }))
    event.target.value = ''
  }

  async function handleOfferUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).sort((firstFile, nextFile) =>
      firstFile.name.localeCompare(nextFile.name, 'he', { numeric: true }),
    )
    if (files.length === 0) return

    const images = await Promise.all(files.map(readImage))
    setDraft((currentDraft) => ({
      ...currentDraft,
      offerImages: [...currentDraft.offerImages, ...images],
    }))
    event.target.value = ''
  }

  function removeOfferImage(id: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      offerImages: currentDraft.offerImages.filter((image) => image.id !== id),
    }))
  }

  function moveOfferImage(id: string, direction: -1 | 1) {
    setDraft((currentDraft) => {
      const currentIndex = currentDraft.offerImages.findIndex(
        (image) => image.id === id,
      )
      const nextIndex = currentIndex + direction

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentDraft.offerImages.length) {
        return currentDraft
      }

      const offerImages = [...currentDraft.offerImages]
      const [image] = offerImages.splice(currentIndex, 1)
      offerImages.splice(nextIndex, 0, image)

      return { ...currentDraft, offerImages }
    })
  }

  if (!isAdminRoute) {
    return <LandingPage draft={draft} />
  }

  return (
    <main className="admin-page" dir="rtl">
      <section className="admin-panel" aria-labelledby="admin-title">
        <div className="panel-heading">
          <p className="eyebrow">SHLISHUK Back Office</p>
          <h1 id="admin-title">בניית דף מבצעים שבועי</h1>
          <p>
            העלאת תמונת פתיחה ותמונות מבצעים. התמונות אחרי הפתיחה מוצגות אחת
            מתחת לשנייה לפי סדר ההעלאה.
          </p>
          <a className="preview-link" href="/" target="_blank">
            פתיחת הדף הציבורי
          </a>
          {storageError ? <p className="error-message">{storageError}</p> : null}
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
            <label className="upload-button">
              העלאת לוגו
              <input accept="image/*" type="file" onChange={handleLogoUpload} />
            </label>
            {draft.logoImage ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    logoImage: null,
                  }))
                }
              >
                הסר לוגו
              </button>
            ) : null}
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
            <label className="upload-button">
              העלאת תמונה ראשית
              <input accept="image/*" type="file" onChange={handleHeroUpload} />
            </label>
            {draft.heroImage ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    heroImage: null,
                  }))
                }
              >
                הסר תמונה ראשית
              </button>
            ) : null}
          </section>

          <section
            className="upload-card"
            aria-labelledby="secondary-upload-title"
          >
            <div>
              <h2 id="secondary-upload-title">תמונה משנית</h2>
              <p>מוצגת מתחת לתמונה הראשית.</p>
            </div>
            <label className="upload-button">
              העלאת תמונה משנית
              <input
                accept="image/*"
                type="file"
                onChange={handleSecondaryUpload}
              />
            </label>
            {draft.secondaryImage ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    secondaryImage: null,
                  }))
                }
              >
                הסר תמונה משנית
              </button>
            ) : null}
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

        <div className="page-url-bar" dir="rtl">
          <span className="page-url-label">כתובת הדף הציבורי:</span>
          <code className="page-url-value">{buildPublicUrl()}</code>
          <button
            type="button"
            className="copy-url-button"
            onClick={handleCopyUrl}
          >
            {copied ? '✓ הועתק' : 'העתק'}
          </button>
        </div>
      </section>
    </main>
  )
}

function LandingPage({ draft }: { draft: LandingDraft }) {
  const shareText = 'היי, מצאתי מבצעים אטרקטיבים השבוע במרכולית '
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    shareText,
  )}`

  return (
    <main className="public-page" dir="rtl">
      <header className="public-header">
        {draft.logoImage ? (
          <div className="logo-wrapper">
            <img
              className="public-logo"
              src={draft.logoImage.src}
              alt="לוגו דף המבצעים"
            />
          </div>
        ) : null}

        <div className="header-spacer" aria-hidden="true" />

        {draft.title ? (
          <h1 className="public-title">{draft.title}</h1>
        ) : (
          <div className="header-title-placeholder" aria-hidden="true" />
        )}

        <div className="header-spacer" aria-hidden="true" />

        <nav className="social-links" aria-label="רשתות חברתיות ושיתוף">
          <a className="icon-link whatsapp-share" href={whatsappShareUrl} target="_blank" aria-label="שתף בווטסאפ">
            <WhatsAppIcon />
          </a>
          {draft.socialLinks.facebook ? (
            <a className="icon-link facebook-link" href={draft.socialLinks.facebook} target="_blank" aria-label="פייסבוק">
              <FacebookIcon />
            </a>
          ) : (
            <span className="icon-link facebook-link" aria-label="פייסבוק">
              <FacebookIcon />
            </span>
          )}
          {draft.socialLinks.instagram ? (
            <a className="icon-link instagram-link" href={draft.socialLinks.instagram} target="_blank" aria-label="אינסטגרם">
              <InstagramIcon />
            </a>
          ) : (
            <span className="icon-link instagram-link" aria-label="אינסטגרם">
              <InstagramIcon />
            </span>
          )}
        </nav>
      </header>

      <section className="landing-preview" aria-label="דף מבצעים">
        {draft.heroImage ? (
          <img
            className="hero-image"
            src={draft.heroImage.src}
            alt="תמונה ראשית של דף המבצעים"
          />
        ) : (
          <div className="hero-placeholder">תמונה ראשית תופיע כאן</div>
        )}

        {draft.secondaryImage ? (
          <img
            className="secondary-image"
            src={draft.secondaryImage.src}
            alt="תמונה משנית של דף המבצעים"
          />
        ) : null}

        <div className="offer-stack">
          {draft.offerImages.map((image) => (
            <img key={image.id} src={image.src} alt="" />
          ))}
        </div>
      </section>
    </main>
  )
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12.04 2C6.55 2 2.08 6.42 2.08 11.86c0 1.73.46 3.42 1.33 4.9L2 22l5.42-1.38a10.1 10.1 0 0 0 4.62 1.1c5.49 0 9.96-4.42 9.96-9.86S17.53 2 12.04 2Zm0 17.9a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.21.82.86-3.08-.2-.32a7.86 7.86 0 0 1-1.2-4.14c0-4.43 3.69-8.04 8.23-8.04s8.23 3.61 8.23 8.04-3.69 8.04-8.23 8.04Zm4.51-6.02c-.25-.12-1.46-.71-1.69-.79-.23-.08-.39-.12-.56.12-.17.25-.64.79-.79.95-.15.17-.29.19-.54.06-.25-.12-1.05-.38-2-1.22-.74-.65-1.24-1.46-1.38-1.71-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.33-.77-1.82-.2-.47-.41-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.84-.87 2.04s.89 2.37 1.02 2.54c.12.17 1.76 2.65 4.27 3.72.6.25 1.06.4 1.42.52.6.19 1.14.16 1.57.1.48-.07 1.46-.59 1.67-1.16.21-.57.21-1.06.15-1.16-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 8.7V6.9c0-.5.4-.9.9-.9H17V3h-2.4C12 3 10.5 4.6 10.5 6.7v2H8v3.1h2.5V21h3.2v-9.2h2.6l.5-3.1h-3.1Z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.8 2.8h8.4a5 5 0 0 1 5 5v8.4a5 5 0 0 1-5 5H7.8a5 5 0 0 1-5-5V7.8a5 5 0 0 1 5-5Zm0 2A3 3 0 0 0 4.8 7.8v8.4a3 3 0 0 0 3 3h8.4a3 3 0 0 0 3-3V7.8a3 3 0 0 0-3-3H7.8Zm4.2 3.1a4.1 4.1 0 1 1 0 8.2 4.1 4.1 0 0 1 0-8.2Zm0 2a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm4.4-2.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2Z" />
    </svg>
  )
}

export default App
