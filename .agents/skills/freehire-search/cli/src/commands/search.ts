import { apiGet, stripInvisible, toResult, writeError, type Envelope, type FreehireJob, type JobResult } from "../helpers.js"

// The agent variant of the job search: the same query, ranking, and facets as the
// web's /jobs/search, but each hit carries the posting's full description instead
// of the search index's truncated preview — so a run reads every result without a
// follow-up `detail` per hit.
const SEARCH_PATH = "/api/v1/agent/jobs/search"

// The web search: identical query surface, but each hit carries only the index's
// truncated preview. --no-description uses it, because the agent endpoint reads
// every full body from the database whether or not the caller wants them - the
// lean mode would otherwise pay the expensive request and discard its payload.
const LEAN_SEARCH_PATH = "/api/v1/jobs/search"

/** How the API renders each result's full description. */
export type DescriptionFormat = "markdown" | "text" | "html"

export const DESCRIPTION_FORMATS: DescriptionFormat[] = ["markdown", "text", "html"]

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit: number
  format: "json" | "table" | "plain"
  descriptionFormat: DescriptionFormat
  // Hydrate full description bodies (the documented default). False keeps a
  // discovery pass cheap: bodies are ~73% of a default search payload, and
  // /scrape pre-filters by title before reading bodies anyway.
  includeDescription?: boolean
  // Facet filters (already parsed into value lists; empty means unset).
  regions: string[]
  countries: string[]
  cities: string[]
  seniority: string[]
  category: string[]
  skills: string[]
  company?: string
  workMode?: string // work_mode facet: remote | hybrid | onsite
  // Aggregator sources to drop from the results (exact match on the API's
  // `source`, or on its prefix for the per-country variants such as
  // "whatjobs-ca"). The API's `source` facet only includes, so the exclusion is
  // applied here; see runSearch's paging note.
  excludeSources: string[]
  // Arbitrary facet escape hatch: param -> values, for the long tail of the vocabulary.
  facets: Record<string, string[]>
}

function buildQuery(opts: SearchOpts, page = opts.page, offsetOverride?: number): URLSearchParams {
  const p = new URLSearchParams()
  if (opts.query) p.set("q", opts.query)
  p.set("limit", String(opts.limit))
  p.set("offset", String(offsetOverride ?? (page - 1) * opts.limit))
  if (opts.includeDescription !== false) p.set("description_format", opts.descriptionFormat)
  if (opts.jobage > 0 && opts.jobage < 9999) p.set("posted_within_days", String(opts.jobage))
  if (opts.workMode) p.set("work_mode", opts.workMode)
  if (opts.company) p.set("company_slug", opts.company)

  // Named facets and the generic --facet escape hatch append the same way; values
  // are already split into lists, so each becomes one repeated query param.
  const facets: Array<[string, string[]]> = [
    ["regions", opts.regions],
    ["countries", opts.countries],
    ["cities", opts.cities],
    ["seniority", opts.seniority],
    ["category", opts.category],
    ["skills", opts.skills],
    ...Object.entries(opts.facets),
  ]
  for (const [param, values] of facets) {
    for (const value of values) p.append(param, value)
  }
  return p
}

/** The date portion (YYYY-MM-DD) of an ISO timestamp, or "—" when absent. */
function shortDate(date: string | null): string {
  return date ? date.slice(0, 10) : "—"
}

// Table columns: header, width, and the cell value. The SLUG column is sized to
// the longest slug so it is never truncated — a cut slug can't be looked up in
// `detail`; the fixed-width columns truncate for scanning.
interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "SLUG", width: Math.max(4, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 38, cell: (r) => r.title },
    { header: "COMPANY", width: 22, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 20, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
  ]
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")

  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}`,
      `  slug: ${r.id}`,
      `  ${r.url}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

// freehire's contract - the openapi `Regions` enum and `RegionValues` in vocab.go -
// defines a closed set: these nine buckets plus `none`. Anything else is a stray
// tag, `us` above all, which is a country code that matches only a handful of
// postings. A search filtered on one therefore looks empty or nearly empty, so the
// CLI says the value is wrong instead of letting it read as a thin market.
const REGION_VALUES = [
  "global",
  "north_america",
  "latam",
  "eu",
  "uk",
  "mena",
  "africa",
  "apac",
  "cis",
  "none",
] as const

/** Region values the caller filtered on: `--region` plus the `--facet regions=` escape hatch. */
function requestedRegions(opts: SearchOpts): string[] {
  return [...opts.regions, ...(opts.facets.regions ?? [])]
}

/**
 * One line on stderr when a region filter uses a value outside the closed
 * vocabulary, written after stdout and without touching the exit code, so a bad
 * parameter never reads as "no postings". The result count is deliberately not
 * consulted: a broad query returns real hits under a stray tag and is still wrong,
 * which is exactly the case a zero-result check would miss.
 */
function warnOnUnknownRegion(opts: SearchOpts): void {
  const requested = requestedRegions(opts)
  if (requested.length === 0) return
  const known = new Set<string>(REGION_VALUES)
  const unknown = [...new Set(requested.map((value) => value.trim().toLowerCase()))].filter(
    (value) => value !== "" && !known.has(value),
  )
  if (unknown.length === 0) return
  const country = unknown.includes("us")
    ? " A country belongs in --country, e.g. --country US."
    : " A country belongs in --country."
  process.stderr.write(
    JSON.stringify({
      warning:
        `--region ${unknown.join(", ")} is not a region value: freehire's regions are ` +
        `${REGION_VALUES.join(", ")}.${country}`,
      code: "REGION_VALUE_UNKNOWN",
    }) + "\n",
  )
}

/**
 * Normalise `--exclude-source` values: trimmed, lowercased, deduplicated, empty
 * dropped. Lowercasing is safe because freehire's `source` values are lowercase
 * slugs, and it keeps `--exclude-source WhatJobs` from silently matching nothing.
 */
export function normaliseSources(values: string[] | undefined): string[] {
  const seen = new Set<string>()
  for (const raw of values ?? []) {
    const value = raw.trim().toLowerCase()
    if (value) seen.add(value)
  }
  return [...seen]
}

/**
 * Whether a posting's `source` is excluded. freehire's `source` facet is
 * per-market ("whatjobs-ae", "whatjobs-ca", "whatjobs-pl" …) while the facet
 * vocabulary lists only the bare aggregator name, so a plain equality test would
 * let every country variant through. Matching the name itself or the name
 * followed by a dash covers both shapes without matching an unrelated source
 * that merely starts with the same letters ("whatjobsomething" stays in).
 */
export function isExcludedSource(source: string | null | undefined, excluded: string[]): boolean {
  if (!source) return false
  const value = source.trim().toLowerCase()
  return excluded.some((name) => value === name || value.startsWith(`${name}-`))
}

/** One page of results from the search endpoint, or null when the endpoint is missing. */
function fetchPage(
  path: string,
  opts: SearchOpts,
  page: number,
  offsetOverride?: number,
): Promise<Envelope<FreehireJob[]> | null> {
  return apiGet<FreehireJob[]>(`${path}?${buildQuery(opts, page, offsetOverride).toString()}`)
}

// How many pages a filtered search will read before giving up on filling the
// caller's page size. The API caps offset+limit at 10000, so this bound is about
// cost, not reachability: each page is a full request with hydrated bodies, and a
// query whose results are mostly excluded could otherwise walk thousands of rows
// to fill 25 slots. Five pages keeps a normal run at one or two requests while
// still returning a full page for a source that supplies ~half the corpus.
const MAX_FILTER_PAGES = 5

/**
 * Fetch the caller's page, dropping excluded sources and backfilling from later
 * pages so the exclusion does not silently shrink the result set.
 *
 * The API's `source` facet only includes (`source=whatjobs` narrows to it); there
 * is no exclusion parameter, and an unsupported one is ignored rather than
 * rejected - so `exclude_source=whatjobs` returns everything and a caller would
 * never know the filter did nothing. Filtering client-side is therefore the only
 * honest option, and it has to page: dropping ~20% of a page and returning 20 of
 * 25 rows would look like a thin market instead of a filter.
 */
async function fetchFiltered(
  path: string,
  opts: SearchOpts,
  excluded: string[],
): Promise<Envelope<FreehireJob[]> | null> {
  const kept: FreehireJob[] = []
  const seen = new Set<string>()
  let meta: Envelope<FreehireJob[]>["meta"]
  // Filtering happens after the API has already ranked and paged the corpus, so
  // a page of the *filtered* stream does not line up with any page of the
  // unfiltered one: with `whatjobs` interleaved, the rows page 1 consumed are not
  // the rows page 2 starts at, and asking for "page 2" re-reads the tail of page
  // 1 (returning rows the caller already saw) or skips past rows it has not.
  // The only sequence that stays contiguous is the unfiltered ranking walked
  // from offset 0, so the walk always starts there and the caller's page is a
  // slice of the accumulated result.
  const skip = (opts.page - 1) * opts.limit
  const target = opts.page * opts.limit
  let offset = 0
  for (let i = 0; i < MAX_FILTER_PAGES; i++) {
    const env = await fetchPage(path, opts, opts.page, offset)
    if (!env) return i === 0 ? null : { data: kept, meta }
    meta = env.meta ?? meta
    const rows = env.data ?? []
    for (const row of rows) {
      if (kept.length >= target) break
      if (isExcludedSource(row.source, excluded)) continue
      // The ranking can shift between requests (each one is a separate query),
      // so a row can legitimately arrive twice; a duplicate must not eat a slot.
      const key = row.public_slug ?? `${row.source ?? ""}:${row.external_id ?? ""}`
      if (seen.has(key)) continue
      seen.add(key)
      kept.push(row)
    }
    if (kept.length >= target || rows.length < opts.limit) break
    offset += rows.length
  }
  return { data: kept.slice(skip, target), meta }
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const path = opts.includeDescription === false ? LEAN_SEARCH_PATH : SEARCH_PATH
    const excluded = normaliseSources(opts.excludeSources)
    const env = excluded.length === 0 ? await fetchPage(path, opts, opts.page) : await fetchFiltered(path, opts, excluded)
    // A 404 here is a missing endpoint, not a missing job: a freehire instance
    // older than the agent search surface answers that way, and reporting it as
    // an empty result set would hide the misconfiguration behind plausible output.
    if (!env) {
      writeError(
        `${path} not found — this freehire instance predates the search endpoint; upgrade it or unset FREEHIRE_API_URL to use the hosted API`,
        "SEARCH_FAILED",
      )
      return 1
    }
    let rows = stripInvisible((env.data ?? []).map(toResult))
    // The web search still carries each hit's truncated preview, and the cost
    // this flag exists to avoid is the share of CLI output descriptions occupy
    // in agent context - so the lean mode drops them client-side.
    if (opts.includeDescription === false) {
      rows = rows.map((r) => ({ ...r, description: null }))
    }
    const total = env.meta?.total ?? rows.length
    // `total` is the index's estimate for the query, computed before any
    // exclusion, so a run that drops sources must not present it as the count of
    // what it returned. Saying so beats a number that silently disagrees with the
    // rows below it.
    const meta: Record<string, unknown> = { count: rows.length, page: opts.page, total }
    if (excluded.length > 0) {
      meta.total_is_unfiltered = true
      meta.excluded_sources = excluded
    }

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(JSON.stringify({ meta, results: rows }, null, 2) + "\n")
    }
    // After stdout: a diagnostic must never interleave with the JSON, and the exit
    // code stays 0 because a wrong filter value is not a failure of the request.
    warnOnUnknownRegion(opts)
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
