import { afterEach, describe, expect, test } from "bun:test"
import { isExcludedSource, normaliseSources, runSearch, type SearchOpts } from "../src/commands/search"

// The API's `source` facet only includes (`source=whatjobs` narrows to it). There
// is no exclusion parameter, and an unsupported one is ignored rather than
// rejected, so `exclude_source=whatjobs` returns the whole corpus while looking
// like a working filter. The exclusion therefore has to happen client-side, and
// these tests pin the two properties that make that honest: the country variants
// are covered, and the result set is backfilled instead of silently shrinking.

const originalFetch = globalThis.fetch
const originalStdoutWrite = process.stdout.write
const originalStderrWrite = process.stderr.write

function capture(stream: "stdout" | "stderr"): { read: () => string } {
  let buf = ""
  const write = ((chunk: string | Uint8Array) => {
    buf += chunk.toString()
    return true
  }) as typeof process.stdout.write
  if (stream === "stdout") process.stdout.write = write
  else process.stderr.write = write
  return { read: () => buf }
}

function job(source: string, slug: string) {
  return {
    public_slug: slug,
    source,
    external_id: slug,
    url: `https://example.com/jobs/${slug}`,
    title: `Role ${slug}`,
    company: "Acme",
    company_slug: "acme",
    location: "Remote",
    description: "body",
    skills: ["typescript"],
    work_mode: "remote",
    regions: ["eu"],
    countries: [],
    cities: [],
    posted_at: "2026-11-10T00:00:00Z",
    created_at: "2026-11-10T00:00:00Z",
    enrichment: {},
  }
}

/**
 * Serve the given pages in order. `pages[n]` answers the request whose `offset`
 * is n * limit; beyond the list the API answers with an empty page, which is what
 * a real exhausted result set looks like.
 */
function stubPages(pages: Array<Array<ReturnType<typeof job>>>): { urls: string[] } {
  const urls: string[] = []
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    urls.push(url)
    const offset = Number(new URL(url).searchParams.get("offset") ?? "0")
    const limit = Number(new URL(url).searchParams.get("limit") ?? "25")
    const index = Math.floor(offset / limit)
    return Response.json({ data: pages[index] ?? [], meta: { total: 999 } })
  }) as typeof fetch
  return { urls }
}

function opts(over: Partial<SearchOpts> = {}): SearchOpts {
  return {
    jobage: 14,
    page: 1,
    limit: 3,
    format: "json",
    descriptionFormat: "markdown",
    regions: [],
    countries: [],
    cities: [],
    seniority: [],
    category: [],
    skills: [],
    excludeSources: [],
    facets: {},
    ...over,
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
  process.stdout.write = originalStdoutWrite
  process.stderr.write = originalStderrWrite
})

describe("isExcludedSource", () => {
  test("matches the bare source name", () => {
    expect(isExcludedSource("whatjobs", ["whatjobs"])).toBe(true)
  })

  test("matches the per-country variants the facet vocabulary hides", () => {
    // freehire's facet lists only "whatjobs" (103k postings) while the wire shape
    // carries "whatjobs-ae", "whatjobs-ca", "whatjobs-pl", … - an equality test
    // would exclude nothing at all and the filter would look like it worked.
    for (const source of ["whatjobs-ae", "whatjobs-ca", "whatjobs-pl", "whatjobs-za"]) {
      expect(isExcludedSource(source, ["whatjobs"])).toBe(true)
    }
  })

  test("does not drop a different source that merely shares the prefix", () => {
    expect(isExcludedSource("whatjobsomething", ["whatjobs"])).toBe(false)
  })

  test("leaves every other source alone", () => {
    for (const source of ["linkedin", "greenhouse", "ashby", "manatal"]) {
      expect(isExcludedSource(source, ["whatjobs"])).toBe(false)
    }
  })

  test("is case-insensitive and tolerates a missing source", () => {
    expect(isExcludedSource("WhatJobs-CA", ["whatjobs"])).toBe(true)
    expect(isExcludedSource(null, ["whatjobs"])).toBe(false)
    expect(isExcludedSource(undefined, ["whatjobs"])).toBe(false)
  })
})

describe("normaliseSources", () => {
  test("trims, lowercases and deduplicates", () => {
    expect(normaliseSources([" WhatJobs ", "whatjobs", "LINKEDIN"])).toEqual(["whatjobs", "linkedin"])
  })

  test("drops empty entries", () => {
    expect(normaliseSources(["", "  ", "whatjobs"])).toEqual(["whatjobs"])
  })

  test("an absent list means no exclusions", () => {
    expect(normaliseSources(undefined)).toEqual([])
  })
})

describe("--exclude-source", () => {
  test("drops the excluded source and backfills the page from the next one", async () => {
    // Page 1 is half whatjobs; a naive filter would return 1 row of the 3 asked
    // for, which reads as a thin market rather than a filter.
    const stub = stubPages([
      [job("whatjobs-ca", "a"), job("greenhouse", "b"), job("whatjobs-pl", "c")],
      [job("linkedin", "d"), job("ashby", "e"), job("whatjobs-ae", "f")],
    ])
    const stdout = capture("stdout")
    const code = await runSearch(opts({ query: "backend", excludeSources: ["whatjobs"] }))
    expect(code).toBe(0)
    const out = JSON.parse(stdout.read())
    expect(out.results.map((r: { id: string }) => r.id)).toEqual(["b", "d", "e"])
    // Two requests: the first page did not fill the caller's limit, so the
    // backfill continued. A single-request implementation returns 1 row here.
    expect(stub.urls).toHaveLength(2)
  })

  test("stops at the first page when it already fills the limit", async () => {
    const stub = stubPages([[job("greenhouse", "a"), job("linkedin", "b"), job("ashby", "c")]])
    capture("stdout")
    await runSearch(opts({ query: "backend", excludeSources: ["whatjobs"] }))
    expect(stub.urls).toHaveLength(1)
  })

  test("stops paging once the API returns a short page", async () => {
    // A short page is the end of the result set; asking again would repeat an
    // empty answer and burn a request per page up to the cap.
    const stub = stubPages([[job("whatjobs-ca", "a")], []])
    const stdout = capture("stdout")
    await runSearch(opts({ query: "backend", excludeSources: ["whatjobs"] }))
    expect(JSON.parse(stdout.read()).results).toEqual([])
    expect(stub.urls).toHaveLength(1)
  })

  test("bounds the backfill instead of walking the whole corpus", async () => {
    // Every page is a FULL page of excluded postings: the short-page exit never
    // fires, so only the cap stops the walk. Without it this loops until the
    // API's 10000-row ceiling, one hydrated request at a time.
    const fullPage = () => [job("whatjobs-ca", "x"), job("whatjobs-pl", "y"), job("whatjobs-ae", "z")]
    const stub = stubPages(Array.from({ length: 20 }, fullPage))
    const stdout = capture("stdout")
    const code = await runSearch(opts({ query: "backend", excludeSources: ["whatjobs"] }))
    expect(code).toBe(0)
    expect(JSON.parse(stdout.read()).results).toEqual([])
    expect(stub.urls.length).toBeLessThanOrEqual(5)
  })

  test("reports that total is unfiltered instead of lying about it", async () => {
    // The API computes `total` before any exclusion, so presenting it as the count
    // of what was returned would be a number that disagrees with the rows below it.
    stubPages([[job("greenhouse", "a"), job("whatjobs-ca", "b"), job("ashby", "c")]])
    const stdout = capture("stdout")
    await runSearch(opts({ query: "backend", excludeSources: ["whatjobs"] }))
    const out = JSON.parse(stdout.read())
    expect(out.meta.total_is_unfiltered).toBe(true)
    expect(out.meta.excluded_sources).toEqual(["whatjobs"])
    expect(out.meta.count).toBe(2)
  })

  test("no exclusion keeps the single-request path and the plain meta", async () => {
    const stub = stubPages([[job("whatjobs-ca", "a")]])
    const stdout = capture("stdout")
    await runSearch(opts({ query: "backend" }))
    const out = JSON.parse(stdout.read())
    expect(stub.urls).toHaveLength(1)
    expect(out.meta.total_is_unfiltered).toBeUndefined()
    expect(out.meta.excluded_sources).toBeUndefined()
    expect(out.results).toHaveLength(1)
  })

  test("applies the exclusion to table output too", async () => {
    stubPages([[job("whatjobs-ca", "a"), job("greenhouse", "b")]])
    const stdout = capture("stdout")
    await runSearch(opts({ query: "backend", format: "table", limit: 5, excludeSources: ["whatjobs"] }))
    const table = stdout.read()
    expect(table).toContain("Role b")
    expect(table).not.toContain("Role a")
  })
})
