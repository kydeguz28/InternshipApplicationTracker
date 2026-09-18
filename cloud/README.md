# Private browser sync

Status: ready for GitHub Pages publication. Authentication settings are configured; real-account sign-in and cross-browser verification remain pending.

## Completed

- Free Supabase project provisioned. Private tables enforce verified enrollment and ownership through authenticated RPCs; direct table access is revoked.
- Revision checks, independent-edit merging, explicit conflict handling, offline caching, and recovery snapshots implemented.
- Sign-in panel and static bundle built. New browsers explicitly choose their starting copy.
- The 58-role backup is preserved outside this repository and staged privately for the enrolled email. Never commit private backups or secret keys.
- All 29 automated tests pass. Transactionally rolled-back database tests passed anonymous denial, non-member denial, owner isolation, direct-table denial, and stale-write rejection. Local browser layout inspected.

## Sign-in and verification

The project is in kydeguz28's Org. Auth uses the default one-time email-link template and the GitHub Pages site URL. Custom code templates are unavailable on the free built-in mail service. The enrolled recipient must also be an organization member for this mail service.

Open a fresh email link in each browser. On first connection choose the cloud copy to restore the staged backup, or explicitly select a newer browser copy. Real-account sign-in and two-browser verification still require the user; automated reconciliation and access checks have passed.

Run npm ci, npm test, and npm run build:pages to build. Serve docs/ to preview.

No Gmail connection is used or authorized. Private sync is separate from public checklist publication. While signed in, the public feed does not overwrite the account snapshot. Sync runs while the page is open, not every six hours.
