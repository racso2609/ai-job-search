---
description: Headless apply - evaluates fit, drafts CV and cover letter, compiles PDFs; no interactive prompts. Emits a JSON result block. Invoked by the background service.
---

# /daemon-apply - Headless Application Draft (daemon mode)

> **Daemon command.** Non-interactive variant of `/apply` for the background
> service. It never pauses for a "proceed?" prompt and never awaits approval.
> The daemon owns the approval loop over Telegram. The posting is `$ARGUMENTS`
> (a URL or pasted text) and it is assumed already approved by the user.

Execute the full `/apply` workflow from `.opencode/commands/apply.md`, with the
following daemon-mode deviations. Where this file and apply.md disagree, this
file wins.

## Deviations from apply.md

1. **No Step 1 confirmation.** Do not ask "Should I proceed with drafting?".
   The approval already happened in Telegram; proceed straight to drafting.
2. **Posting integrity gate (apply Step 0).** Still run `tools/posting_guard.py`.
   If the verdict carries a warning mark, do NOT stop: record the verdict and
   the finding counts, proceed, and surface the flag in the final JSON so the
   daemon can warn the user. A flagged posting is drafted, never silently
   dropped.
3. **Subagents.** Use the `task` tool with `subagent_type: posting-fetcher`
   (Step 0) and `subagent_type: application-reviewer` (Step 3), as apply.md
   describes. SCRATCHPAD is set by the workspace plugin.
4. **Tracker and archive (apply Step 6b).** Run it unchanged: record the
   `drafted` tracker row and archive the posting exactly as written there.
5. **Compile the PDFs (apply Step 5).** Mandatory. After compiling, keep both
   PDFs on disk; the daemon attaches them to Telegram.
6. **Do not delete the PDFs.** Delete LaTeX intermediates (aux, log, and so on)
   per Step 5e, but never delete the PDF files themselves.

## Final output (required)

After the workflow completes, print exactly one fenced JSON block as the last
thing in your response, and nothing after it:

```json
{
  "ok": true,
  "company": "<company>",
  "role": "<role>",
  "fit_score": 0,
  "fit_verdict": "<strong fit|moderate fit|weak fit>",
  "guard": "clean",
  "cv_pdf": "cv/main_<company>_<role>.pdf",
  "cover_pdf": "cover_letters/cover_<company>_<role>.pdf",
  "cv_tex": "cv/main_<company>_<role>.tex",
  "cover_tex": "cover_letters/cover_<company>_<role>.tex",
  "tracker_status": "drafted",
  "summary": "<one-line summary for the user>"
}
```

Rules for the JSON:
- ok is false only when drafting could not complete (posting unfetchable,
  compile failed). When ok is false, include an "error": "<one line>" field
  and omit the file paths.
- The file paths are relative to the repo root and must point at files that
  actually exist on disk. Never invent a path.
- guard is the verbatim verdict line from `tools/posting_guard.py`, or "clean".
- Do not print any other JSON block, and do not wrap the files in markdown.
