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

Gmail access is provided by an MCP server configured in `opencode.json`. Two
transports are supported and either one satisfies this command:

- **`gmail-imap` (default on headless hosts).** A local IMAP bridge
  (`imap-mcp-server`) authenticated with a Gmail app password. OpenCode prefixes
  every MCP tool with its server name, so these appear in your tool list as
  `gmail-imap_imap_*` (note the double prefix, e.g.
  `gmail-imap_imap_search_emails`). The ones you need:
  `imap_search_emails`, `imap_get_email`, `imap_list_folders`,
  `imap_find_thread_messages` — call them by their full prefixed name. This
  server runs **read-only** (`IMAP_MCP_READ_ONLY=true`), so `imap_send_email`
  and every other write tool are absent by design - that is the intended state,
  not a fault.
- **`gmail` (OAuth).** The hosted OAuth server, tools appearing as `gmail_*`
  (`search_emails`, `read_email`, `list_labels`). Only usable when a browser
  callback has been completed on this machine.

Detect whichever is available by inspecting your tool list: a tool name
containing `imap_search_emails` means the IMAP bridge, `gmail_search_emails`
means OAuth. Use the one you have. If both are present, prefer `gmail-imap`
(it is the one the credentials on this host actually authenticate).

If neither is available, print the JSON result with `ok: false` and an `error`
explaining that no Gmail MCP server is connected, and stop. Never attempt Gmail
access via Bash, raw IMAP sockets, curl, or any other channel - only through the
MCP tools.

### Mapping between the two transports

Both read the same mailbox; only the call shape differs:

| Need | `gmail-imap` | `gmail` (OAuth) |
|---|---|---|
| Search | `imap_search_emails` with `from`, `subject`, `since`, `limit` | `search_emails` with a Gmail query string |
| Full body | `imap_get_email` with `uid` | `read_email` with `messageId` |
| Thread | `imap_find_thread_messages` | search by `rfc822msgid` |
| Message id | `messageId` field returned by search | `messageId` |

Two `imap_*` specifics that will bite you if ignored:

1. **Search arguments are structured, not a Gmail query string.** `Gmail`-style
   operators (`newer_than:30d`, `-in:sent`, `{a b}` OR-groups, `label:`) do not
   exist. Map gmail-sync's query onto the structured fields instead: the
   lookback window becomes `since: YYYY-MM-DD`, the company names become a
   `from`/`subject` pass (run one search per company, or one broad `since`
   search and filter locally), and `-in:sent -in:drafts` becomes "do not pass
   `includeDrafts`/include the Sent folder".
2. **`imap_search_emails` returns headers only.** You must follow up with
   `imap_get_email` per matched uid to get the body. Classification from
   snippets or subjects alone is forbidden (see rule 3) - the body fetch is not
   optional, even though it costs one call per message.

Pass `folder: "INBOX"` explicitly, or `searchAllFolders: true` when a message
may have been archived (gmail-sync's negative operators exist precisely because
archived mail matters). `searchAllFolders` returns headers only, so budget the
`imap_get_email` calls.

## Deviations from gmail-sync.md

Follow the detection logic of `.opencode/commands/gmail-sync.md` Steps 2-5
(load open applications, build the search query, filter to unprocessed
messages, classify each message) but:

1. **No writes.** Do not modify `job_search_tracker.csv`, any `outcome.md`, or
   `gmail_sync/state.json`. This command is read-only.
2. **No approval step.** Do not present a table and wait. Emit the JSON below.
3. **Classify from full bodies**, never snippets, exactly as gmail-sync Step 4
   requires. With `gmail-imap` this means an explicit `imap_get_email` call per
   candidate message.
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
- `message_id` is the id the transport returned (`messageId` in both cases).
- `interview_datetime` is present only for an interview proposal with a stated
  date/time; omit the key otherwise. Use ISO local time, no timezone suffix.
- Every proposal must cite its `source_subject` and `source_date`. Never invent
  a signal or a company.
- Do not print any other JSON block, and do not wrap it in markdown.
