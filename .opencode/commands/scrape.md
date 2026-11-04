---
description: Search job portals for new postings matching your profile
---

# /scrape - Find New Job Postings

> **opencode runtime note.** This command drives the repo's `job-scraper` skill (`.claude/skills/job-scraper/SKILL.md`, registered as skill `scrape`). Load it via the `skill` tool with `name: scrape`, then execute its workflow exactly (`$ARGUMENTS` passes through as the skill's optional arguments: a focus area, `broad`, or `health`).

Search the installed portal CLIs under `.agents/skills/` for postings matching the profile, deduplicate against `job_scraper/seen_jobs.json` and `job_search_tracker.csv`, and present new matches sorted by fit.

Arguments (optional): $ARGUMENTS
