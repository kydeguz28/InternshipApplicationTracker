# Kyle's Internship Desk

A static internship tracker with a shared checklist maintained through Codex.

## Launch locally

Run `npm start` and open http://localhost:4173. For the hosted edition, run `npm run build` and serve `dist/` with any static web server.

## GitHub Pages

Run `npm run build:pages`, commit the generated `docs/` folder, and configure Pages to publish from `main` / `docs`. All asset and data URLs are relative, supporting the repository subpath. The existing Vercel project can also publish `dist/` with `npm run build`.

## Shared data and privacy

Kyle authorized publication of company names, roles and application statuses. `public-data.json` contains only those fields and opaque record IDs. Email references, private notes, contacts, dates and credentials are excluded. The initial publication restores 55 records.

A separately configured local Codex job reads Gmail every six hours and checks employer listings daily, merges verified updates with the private tracker, writes the sanitized public checklist, and pushes GitHub. GitHub Pages redeploys after the push. Gmail credentials are never sent to the website.

The website checks the published file every minute. Notes, priorities, local status overrides and deletions remain in browser storage. Browser edits do not write back to GitHub; ask chat to change the shared checklist. Existing local roles are preserved if missing from a later publication. Export a backup before clearing storage or changing browsers. The public website remains available when the computer is off, but new Gmail checks require the local Codex scheduler to run.

## Verification

`npm test` verifies data validation, Gmail merge rules, public status merging and the public field allowlist. Static builds copy an explicit list of browser assets; `.runtime/` and server files are excluded.
