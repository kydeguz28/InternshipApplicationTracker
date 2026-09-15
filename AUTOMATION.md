# Local Gmail automation setup

Use a Codex scheduled task with the Gmail plugin connected. Choose your own cadence. The computer and desktop app must be running for local updates. No schedule is created by cloning this repository.

The scheduled task should read relevant employer messages, verify company + exact role/requisition + season, and produce minimal events. Preserve manual changes. Never copy email bodies, credentials, assessment invitation tokens, meeting links or personal contact details into the app. Keep Gmail read-only.

Write a batch JSON in a private working folder:

```json
{
  "schemaVersion": 1,
  "lastCheckedAt": "2026-09-14T12:00:00Z",
  "events": [
    {
      "id": "gmail:abc123",
      "kind": "gmail",
      "messageId": "abc123",
      "company": "Example Company",
      "role": "Summer 2027 Engineering Intern",
      "status": "Applied",
      "occurredAt": "2026-09-14T11:00:00Z",
      "evidence": "Explicit role-specific application confirmation.",
      "hasApplied": true,
      "allowCreate": true
    }
  ],
  "alerts": []
}
```

These are synthetic example values. Use actual evidence for real events. For existing records, add the current recordId. Do not match by company alone. A stable message ID makes repeated scans idempotent; existing events are immutable. Corrections need a new ID. Dates use ISO timestamps; appliedDate/followUpDate use YYYY-MM-DD. Label confirmation receipt dates with dateSource rather than implying an exact application timestamp.

Run `node scripts/update-watch.mjs path/to/batch.json`. It validates and writes `.runtime/gmail-feed.json` and `.runtime/watch-summary.json`. The app polls `/api/sync` once per minute and stores its latest view at `.runtime/browser-snapshot.json` for later scheduled checks. Never commit these runtime files.

For incremental scans, use an overlap from the previous successful scan, paginate relevant search results, and only advance lastCheckedAt when the scan completes. A generic invitation to apply is not a submission; conditional interview language is not an interview; lack of response is not rejection. Read subsequent employer replies before marking follow-up requests outstanding.

Optional employer-search events use kind `search`, a stable event ID, a verified employer link and status `To Apply`. Add only specific relevant roles, deduplicating against applications and Gmail. Search updates cannot change an application status.

Notify only on meaningful changes, required actions or failures. Keep unchanged scans quiet. Do not send email or submit applications as part of the automation.
