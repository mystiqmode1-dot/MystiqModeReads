# MystiqMode Reads

An installable, mobile-first reading web app inspired by the supplied orange, charcoal, and parchment interface reference.

## Run

Requires Node.js 24 or newer. No external packages are required.

```sh
npm start
```

Open port 3000. `npm run dev` watches the server; reload the browser after frontend changes. `npm test` runs end-to-end HTTP tests against a temporary SQLite database.

## First version

- Responsive searchable library and category filters, with three original sample books and local SVG cover illustrations.
- Email/password registration and login, scrypt password hashing, server-side expiring sessions, HttpOnly cookies.
- Account reading shelf and persisted reading position; guests can read and retain their place on the same browser.
- Parchment reader with animated page turns, touch swipes, keyboard arrows, chapter navigation, font sizes, and light/sepia/dark modes. The animation is a CSS page rotation, not a physically simulated curl.
- The first registered account is the administrator. Administrators can upload UTF-8 `.txt` files or paste text, with title, author, category, and description. Books are paginated and published to the shared library. PDF/EPUB and custom cover imports are not yet implemented.
- Web manifest, icon, and service worker provide installation support on compatible browsers. Deploy over HTTPS for phone installation. iOS uses Share → Add to Home Screen. This release does not cache books offline.

SQLite is stored in ignored `data/reads.sqlite`; retain this directory on a persistent volume and back it up. `DB_PATH` can select another database file; `PORT` defaults to 3000. Set `COOKIE_SECURE=1` behind HTTPS.

## Before public launch

This is a development MVP, not a completed production authentication/billing system. Register the owner account before allowing public access; first-user administration is intended for initial development. Add login throttling, email verification, password recovery, moderation, HTTPS hosting, persistent-volume backups, and operational monitoring before inviting the public. Offline downloads and premium subscriptions are deliberately deferred. Sample stories are original introductory adaptations, not full editions of the epics.

No secrets, paid services, or external database are required. Fonts load optionally from Google Fonts; the app falls back to system fonts when unavailable.
