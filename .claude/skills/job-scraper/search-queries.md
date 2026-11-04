# Search Queries for Job Scraper

<!-- SETUP: Customize these queries based on your skills, target roles, and location -->

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first. Shipped country-agnostic CLIs include `linkedin-search` and `freehire-search`; Danish demos and any skill you add with `/add-portal` are included the same way. You do **not** need a matching `site:` line below for those CLIs to run.

The `site:` query templates in this file are the **WebSearch fallback** — for portals without a CLI, company career pages, or when a CLI fails.

**Language scope:** write every query category in every language listed in your CLAUDE.md Languages table (typically 1-2, sometimes more). A posting requiring a language you have *not* declared, as a job condition, is excluded before scoring; a posting requiring a *higher level* than you declared in a language you *do* work in is flagged for your own judgment, not excluded — see `04-job-evaluation.md`'s Language Gate, the single source of truth for this rule. Translate each category's keywords rather than machine-translating word-for-word (e.g. "Frontend Developer" -> "Desarrollador Frontend", not a literal word-for-word translation) if you work in more than one language.

## Search Sites

Primary (your market's job boards - scaffold one with `/add-portal`):
## Search Sites

Primary (remote-first; Oscar works from Venezuela on UTC, so "location" means timezone overlap, not commute):
- **linkedin.com/jobs** - LinkedIn job listings; also covered by the `linkedin-search` CLI
- **wellfound.com** (formerly AngelList) - startup roles, remote-heavy, Web3-friendly
- **remoteok.com** / **weworkremotely.com** - remote-only boards
- **cryptojobslist.com** / **web3.career** - niche boards for the primary domain
- **getonbrd.com** / **remoto.dev** - LatAm-focused remote boards (Spanish-language postings)

Secondary (company career pages via Google):
- Direct `site:` searches against known DeFi/Web3 and fintech companies (Alchemy, Moralis, Zerion, Chainlink, Aave ecosystem, wallet vendors)

## Query Categories

Queries are grouped by priority. Write **each category in both languages** from CLAUDE.md's Languages table (English and Spanish). Combine each query with a remote/geo term where the site supports it (`remote`, `anywhere`, `worldwide`, `latam`, `españa`).

**Organize by function, not job title.** The same work carries different titles across companies: "Backend Engineer" may be posted as "Backend Developer", "Node.js Engineer", "Platform Engineer" or "Software Engineer (Backend)". Each category below lists several plausible titles rather than betting a whole tier on one string.

### Priority 1: Blockchain / Web3 Engineering

Oscar's strongest and most desired direction: DeFi, on-chain data, wallets, contracts.

```
site:linkedin.com/jobs "blockchain engineer" remote
site:linkedin.com/jobs "smart contract engineer" remote
site:linkedin.com/jobs "DeFi engineer" remote
site:cryptojobslist.com "blockchain" "remote"
site:web3.career "TypeScript" "Solidity" remote
site:linkedin.com/jobs "ingeniero blockchain" remoto
site:linkedin.com/jobs "desarrollador blockchain" remoto
site:getonbrd.com "blockchain" "remoto"
```

### Priority 2: Backend Engineering (TypeScript / Node / Go)

Core technical strength: hexagonal architecture, microservices, Kafka, PostgreSQL, real-time.

```
site:linkedin.com/jobs "backend engineer" "TypeScript" remote
site:linkedin.com/jobs "backend engineer" "Node.js" remote
site:linkedin.com/jobs "backend engineer" "Go" remote
site:linkedin.com/jobs "platform engineer" "TypeScript" remote
site:wellfound.com "backend engineer" "Node.js" remote
site:linkedin.com/jobs "desarrollador backend" "Node.js" remoto
site:getonbrd.com "backend" "Node" remoto
```

### Priority 3: Full-Stack (React / Next.js + Node)

Adjacent role: end-to-end product work, which matches the co-founder profile.

```
site:linkedin.com/jobs "full stack engineer" "React" "Node" remote
site:linkedin.com/jobs "full stack engineer" "Next.js" remote
site:linkedin.com/jobs "desarrollador full stack" "React" remoto
site:getonbrd.com "full stack" "remoto"
```

### Priority 4: Fintech / Payments / Data

Broader net where the domain intersects crypto rails.

```
site:linkedin.com/jobs "fintech" "backend engineer" remote
site:linkedin.com/jobs "payments engineer" remote
site:linkedin.com/jobs "data engineer" "Kafka" remote
site:linkedin.com/jobs "technical lead" "fintech" remote
```

### Priority 5: Technical Lead / Senior IC at a software factory

Matches the Dlocs experience: client-facing senior delivery.

```
site:linkedin.com/jobs "technical lead" "Node.js" remote
site:linkedin.com/jobs "senior engineer" "client-facing" remote
site:linkedin.com/jobs "lider tecnico" "remoto"
```

## Location Filter

Oscar works **remotely only** and will not relocate. There is no commute radius to evaluate; filter on remote-eligibility and timezone instead:

- **Accepted:** fully remote, "remote anywhere", "remote worldwide", "remote LATAM", "remote EU/US with async culture"
- **Accepted:** hybrid roles only if the office requirement is nominal or the company is remote-first in practice
- **Borderline (flag, don't drop):** "remote US only" / "remote EU only" where the posting is strict about work authorization — Oscar has no US/EU work permit, so verify before applying
- **Rejected:** on-site only, relocation required, or a fixed timezone band that does not overlap UTC (e.g. US Pacific-only synchronous)

## Language Filter

Your working languages and levels are in CLAUDE.md's Languages table (Spanish native, English professional). When filtering scraped results, apply `04-job-evaluation.md`'s Language Gate: a posting requiring a language you haven't declared at all is excluded; a posting requiring a higher level than you declared in a language you do work in is not excluded, flag it clearly instead (see `job-scraper/SKILL.md`'s Step 3 "Quick Fit Assessment" for how the flag surfaces in `/scrape` output). Postings simply *written* in a language you don't work in, that don't require it on the job, are fine.

## Date Filter

Only include jobs posted within the last 14 days, or with an application deadline that has not yet passed. If a posting date cannot be determined, include it but flag as "date unknown".

## Adapting Queries

If the user specifies a focus area, select queries from the matching category and also generate 2-3 custom queries for that focus. For example:
- "/scrape [focus_area]" -> relevant category queries + custom focus-specific queries
