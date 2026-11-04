---
description: Headless Gmail scan - reads recruiter emails for tracked applications, classifies status signals, and emits a JSON proposal list. No writes, no prompts. Invoked by the background service.
---

# /daemon-gmail - Headless Gmail Status Scan (daemon mode)

> **Daemon command.** Non-interactive variant of `/gmail-sync` for the
> background service. It never writes to the tracker or to outcome.md and never
> asks for approval. It only READS Gmail, classifies, and returns a JSON
> proposal list. The daemon presents those proposals over Telegram and performs
> the approved writes itself (or re-invokes opencode to do so).

Read `$ARGUMENTS` (may be empty, a company name, or `since YYYY-MM-DD`).

## Requirements

Gmail access is provided by an MCP server configured in `opencode.json`
(server name `gmail`). Discover its tools from your own tool list (names
prefixed `gmail_`). If no Gmail MCP tools are available, print the JSON result
with `ok: false` and an `error` explaining that Gmail MCP is not connected, and
stop. Never attempt Gmail access via Bash, IMAP, or any other channel.

## Deviations from gmail-sync.md

Follow the detection logic of `.opencode/commands/gmail-sync.md` Steps 2-5
(load open applications, build the search query, filter to unprocessed
messages, classify each message) but:

1. **No writes.** Do not modify `job_search_tracker.csv`, any `outcome.md`, or
   `gmail_sync/state.json`. This command is read-only.
2. **No approval step.** Do not present a table and wait. Emit the JSON below.
3. **Classify from full bodies**, never snippets, exactly as gmail-sync Step 4
   requires.
4. **Never propose** `hired` or `offer_declined`; those need the user's
   real-world decision.
5. **Unmatched and conflicting** messages are reported in their own arrays,
   never guessed into a proposal.
6. **Interview offers:** when a message is an interview invite and states a
   concrete date/time, include the parsed date/time in the proposal so the
   daemon can offer a calendar event.

## Final output (required)

After scanning, print exactly one fenced JSON block as the last thing in your
response, and nothing after it:

```json
{
  "ok": true,
  "scanned": 0,
  "proposals": [
    {
      "company": "<company>",
      "role": "<role>",
      "signal": "interview|assessment|offer|rejection|application_ack",
      "current_status": "<tracker status>",
      "proposed_status": "<tracker status>",
      "source_subject": "<email subject>",
      "source_date": "YYYY-MM-DD",
      "message_id": "<gmail message id>",
      "interview_datetime": "YYYY-MM-DDTHH:MM:SS"
    }
  ],
  "unmatched": [
    { "subject": "<subject>", "from": "<sender>", "reason": "<why unmatched>" }
  ],
  "conflicts": [
    { "company": "<company>", "detail": "<what conflicted>" }
  ],
  "stale": [
    { "company": "<company>", "role": "<role>", "last_activity": "YYYY-MM-DD", "status": "<status>" }
  ]
}
```

Rules for the JSON:
- ok is false only when the scan could not run at all (no Gmail MCP, tracker
  missing). Then include an "error": "<one line>" field.
- `interview_datetime` is present only for an interview proposal with a stated
  date/time; omit the key otherwise. Use ISO local time, no timezone suffix.
- Every proposal must cite its `source_subject` and `source_date`. Never invent
  a signal or a company.
- Do not print any other JSON block, and do not wrap it in markdown.
