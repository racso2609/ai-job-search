---
description: Creates a Google Calendar event for an approved interview, using the Google Calendar MCP server. Invoked by the background service after the user approves a proposal in Telegram.
---

# /daemon-calendar - Create an Interview Calendar Event (daemon mode)

> **Daemon command.** Invoked only after the user approved a calendar proposal
> in Telegram. It creates exactly one event via the Google Calendar MCP server
> and reports the result as JSON. It never drafts, never applies, never emails.

`$ARGUMENTS` carries the event details as a compact JSON object, for example:

```json
{"company":"Acme","role":"ML Engineer","datetime":"2026-11-10T15:00:00","duration_minutes":45,"interviewer":"Jane Doe","url":"https://meet.example.com/xyz","description":"Technical screen"}
```

## Requirements

Google Calendar access is provided by an MCP server configured in `opencode.json`
(server name `calendar`). Discover its tools from your own tool list (names
prefixed `calendar_`). If no Calendar MCP tools are available, print the JSON
result with `ok: false` and an `error`, and stop.

## Steps

1. Parse the JSON in `$ARGUMENTS`.
2. Create one event:
   - Summary: `Interview: <role> @ <company>`
   - Start: `datetime`; End: `datetime` plus `duration_minutes` (default 45).
   - Description: `interviewer`, `url`, and the free-text `description`, omitting
     empty fields.
   - Location: `url` if present.
3. Do not create a second event, do not modify existing events, and do not
   invite attendees (the daemon has no guest email unless the proposal carried
   one; leave attendees empty).

## Final output (required)

Print exactly one fenced JSON block as the last thing in your response:

```json
{
  "ok": true,
  "event_id": "<calendar event id>",
  "html_link": "<event url>",
  "start": "YYYY-MM-DDTHH:MM:SS",
  "summary": "Interview: <role> @ <company>"
}
```

On failure: `{"ok": false, "error": "<one line>"}`. Do not print any other JSON
block, and do not wrap it in markdown.
