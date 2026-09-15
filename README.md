# Internship Application Tracker

A responsive blue-and-gold internship tracker with dashboard counts, a searchable application ledger, mobile cards, a To Apply queue, priorities, notes, quick status controls, JSON backups and optional local Gmail updates.

## Run locally

Requires Node.js 18+. No dependency installation is needed.

```sh
npm start
```

Open http://localhost:4173. On Windows, double-click `Launch Tracker.cmd`. Keep the terminal open while using the app.

## Your data stays local

**This public repository contains no personal application history, email references, credentials or sync results.** It starts with an empty list. Add roles or import your own JSON backup. Use the same browser and URL to access existing saved data.

Changes are stored in browser local storage and a private `.runtime/browser-snapshot.json` on your computer. Export backups before clearing browser data or switching devices. `.runtime/`, backups and credentials must never be committed. This is a local single-user app, not an authenticated multi-device cloud service. Do not expose the local server to the internet.

## Optional Gmail job watch

A separately configured Codex schedule can read the connected Gmail account and write verified events to this app. The website itself does not read Gmail or hold OAuth credentials. See AUTOMATION.md for the event contract and setup. The app loads saved results every minute; Refresh updates reloads saved results, not the mailbox.

Automatic updates preserve manual notes, priorities and deleted records. Older emails do not overwrite newer manual statuses. Explicit confirmations, interviews, rejections and action requests are matched to a specific company, role and season. Missing email never proves non-application. Ambiguous matches remain for review.

## Development

```sh
npm test
```

- `data.js`: empty public seed, record validation and filtering.
- `sync.js`: event validation and conflict-aware merging.
- `app.js`: UI and browser persistence.
- `server.mjs`: localhost-only file server, sync feed and same-origin snapshot endpoint.
- `scripts/update-watch.mjs`: validated atomic feed updates for an external scheduler.

Dashboard statuses are mutually exclusive. Needs Follow-up is an explicit status; dates do not automatically change it. Checkbox changes to To Apply clear the application date; Undo restores the prior state. Backup imports replace the current list after confirmation.

A GitHub repository stores the code; pushing it does not create a live hosted website or a cloud Gmail integration.

## Deploy on Vercel

Import this repository into Vercel. The checked-in `vercel.json` selects a static deployment, runs `npm run build`, and publishes only `dist/`. Do not use `npm start` as the Vercel build command; that command starts the local-only server.

The hosted edition saves applications in the current browser and supports manual edits and JSON backup import/export. It does not call the local Gmail/snapshot endpoints. Gmail updates still run through the separately configured local Codex schedule. A private authenticated backend is needed for hosted Gmail sync or shared data across devices.

The build copies only five browser assets. It never publishes the local server, `.runtime/`, automation scripts or credentials. Future pushes to the connected production branch trigger a new Vercel deployment.
