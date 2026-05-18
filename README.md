# Lists

A personal PWA for figuring out what to do. Items live in three nested tiers:

- **Library** — everything you might do (recipes, movies, books, projects, …)
- **Shortlist** — what you're considering soon
- **Active** — what you're actually doing now

Each item has a name, a single user-created category, and freeform tags. Tags get autocomplete suggestions from other items in the same category. Data is stored locally in IndexedDB (via Dexie) — nothing leaves the device.

## Stack

- SvelteKit (SPA, static adapter)
- Dexie.js (IndexedDB)
- Tailwind CSS v4
- @vite-pwa/sveltekit (installable PWA, offline)

## Develop

Requires Node 22+ (use `nvm use` — `.nvmrc` is committed).

```sh
npm install
npm run dev
```

## Build

```sh
npm run build       # outputs static site to ./build
npm run preview     # preview the build
```

## Deploy (Cloudflare Pages, free)

1. Push this repo to GitHub.
2. In Cloudflare Pages → "Create a project" → connect the repo.
3. Build command: `npm run build`. Build output directory: `build`.
4. Done. You get a `*.pages.dev` URL — open it on your phone, then "Add to Home Screen" to install the PWA.

Alternatives: Vercel, Netlify, or GitHub Pages all work with the same `build/` output.
