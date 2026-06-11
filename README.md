# Bookly AI Client

The web app for Bookly: a personal library with a comic-book heart. Upload PDF books, arrange them on shelves, read them full-screen, and let an AI voice narrate them to you with word-by-word highlighting.

Built with Next.js 16, React 19, Tailwind CSS 4, TanStack Query, GSAP, and react-pdf.

## Getting started

The app expects the [Bookly AI API](https://github.com/shashiKundur1/Bookly-AI-api) running on `http://localhost:8000` (one `docker compose up` over there).

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, create an account, and add a book. The dev server binds to `0.0.0.0`, so you can open the same app from your phone at `http://<your-mac-ip>:3000` — API calls are proxied through Next, so no extra setup is needed.

Set `API_URL` if the backend lives somewhere other than `localhost:8000`.

## What's inside

- **Library** — comic-panel book cards with covers, reading progress, status stickers, color marks, and favorite stars. Shelves by status, search, sort, priority filters, and a drag-to-arrange mode for your own ordering.
- **Book page** — edit details, switch status/priority/color, upload a custom cover or regenerate one from page 1, and a tappable per-page progress map.
- **Reader** — the PDF fills the screen with bouncy GSAP page turns. Swipe, tap the page edges, use arrow keys, or scrub the page slider. Zoom with the +/− buttons (panning takes over when zoomed). Progress saves automatically and reading sessions are tracked for your stats.
- **Listen mode** — tap the speaker and the book reads itself in real time: audio streams over a WebSocket and plays gaplessly through Web Audio, starting in well under a second. The paragraph being spoken is highlighted on the page, Netflix-style subtitles under the page show karaoke word-by-word highlighting (synced to a playback-aligned timeline, never to how far ahead the server has synthesized), and pages turn exactly when their narration starts. Pick from 12 narration emotions (narrator, storyteller, dramatic, cinematic, whisper, …) plus voice and pitch-preserving speed; acting cues like ✦ chuckles appear in the subtitles (toggleable). Tap any paragraph to start narration right there; flip pages while listening and the narration follows you.
- **Profile** — avatar, reading stats, recent sessions, name and password management.

## Project layout

```
src/
  app/            routes: login, register, library, books/[id], read/[id], profile
  components/     ui primitives, library, book, and reader features
  lib/            api client, query hooks, types, animations, formatting
```

The comic design system lives in `src/app/globals.css` as Tailwind 4 theme tokens (`paper`, `ink`, `zap`, `pow`, `boom`…) plus utilities like `comic-border`, `comic-press`, `shine`, and `halftone`. Animations are GSAP only, with `prefers-reduced-motion` respected throughout.

`postinstall` copies the pdf.js worker, cmaps, and standard fonts into `public/` so the reader works offline with Turbopack.

## Production

The `Dockerfile` builds a standalone production image. The API origin is baked in at build time via the `API_URL` build arg (default `http://api:8000`, which matches the compose network). The easiest full-stack deployment is the production compose file in the API repo:

```bash
cd ../Bookly-AI-api
JWT_SECRET=$(openssl rand -hex 32) docker compose -f docker-compose.prod.yml up -d --build
```

To run just the web image against a remote API:

```bash
docker build --build-arg API_URL=https://your-api.example.com -t bookly-web .
docker run -p 3000:3000 bookly-web
```
