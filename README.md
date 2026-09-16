# Kyle's Internship Desk

A static internship tracker with a shared checklist maintained through Codex.

## Launch locally

Run `npm start` and open http://localhost:4173. For the hosted edition, run `npm run build` and serve `dist/` with any static web server.

## GitHub Pages

Run `npm run build:pages`, commit the generated `docs/` folder, and configure Pages to publish from `main` / `docs`. All asset and data URLs are relative, supporting the repository subpath. The existing Vercel project can also publish `dist/` with `npm run build`.

## Shared data and privacy

Kyle authorized publication of company names, roles, application statuses and public posting links. `public-data.json` contains those fields, public link labels/explanations, and opaque record IDs. `role-links.json` is the reviewed public link catalog; it includes employer postings, explicitly labeled posting copies, possible matches and careers-page fallbacks. Email references, private notes, contacts, dates and credentials are excluded. The checklist contains 56 records. Public link research on September 15, 2026 added 56 links without changing roles or statuses. Gmail access is disconnected and its scheduled updater is paused.

The former six-hour Gmail job is paused following removal of Google access. Chat can research public listings and push reviewed updates when requested. GitHub Pages redeploys after the push. Gmail credentials are never sent to the website.

The website checks the published file every minute. Notes, priorities, local status overrides and deletions remain in browser storage. Browser edits do not write back to GitHub; ask chat to change the shared checklist. Existing local roles are preserved if missing from a later publication. Export a backup before clearing storage or changing browsers. The public website remains available when the computer is off, and no Gmail checks run while access is disconnected.

## Verification

`npm test` verifies data validation, Gmail merge rules, public status merging and the public field allowlist. Static builds copy an explicit list of browser assets; `.runtime/` and server files are excluded.

New To Apply entries published by chat require a reviewed specific posting link in `role-links.json`. The private publisher refuses a publication containing queued roles without one.
