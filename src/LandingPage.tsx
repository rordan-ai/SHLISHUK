import { memo } from 'react'

import type { LandingDraft } from './draftTypes'

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

export const LandingPage = memo(function LandingPage({
  draft,
}: {
  draft: LandingDraft
}) {
  const shareText =
    'היי, מצאתי מבצעים אטרקטיבים השבוע במרכולית '
  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`

  return (
    <main className="public-page" dir="rtl">
      <header className="public-header">
        {draft.logoImage ? (
          <div className="logo-wrapper">
            <img
              className="public-logo"
              src={draft.logoImage.src}
              alt="לוגו דף המבצעים"
              fetchPriority="high"
              decoding="async"
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
          <a
            className="icon-link whatsapp-share"
            href={whatsappShareUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="שתף בווטסאפ"
          >
            <WhatsAppIcon />
          </a>
          {draft.socialLinks.facebook ? (
            <a
              className="icon-link facebook-link"
              href={draft.socialLinks.facebook}
              target="_blank"
              rel="noreferrer"
              aria-label="פייסבוק"
            >
              <FacebookIcon />
            </a>
          ) : (
            <span className="icon-link facebook-link" aria-label="פייסבוק">
              <FacebookIcon />
            </span>
          )}
          {draft.socialLinks.instagram ? (
            <a
              className="icon-link instagram-link"
              href={draft.socialLinks.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="אינסטגרם"
            >
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
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className="hero-placeholder">תמונה ראשית תופיע כאן</div>
        )}

        {draft.secondaryImage ? (
          <img
            className="secondary-image"
            src={draft.secondaryImage.src}
            alt="תמונה משנית של דף המבצעים"
            loading="lazy"
            decoding="async"
          />
        ) : null}

        <div className="offer-stack">
          {draft.offerImages.map((image) => (
            <img
              key={image.id}
              src={image.src}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      </section>
    </main>
  )
})

export default LandingPage
