// Result-shape contract for the daemon helpers.
//
// `runApply`, `runGmailScan` and `runCalendar` must all report a failed run the
// same way: `{ ok: false, error }` carrying the real diagnosis. Returning `null`
// (what they did before) forces every caller to invent a generic message, which
// is how "Draft failed for <company> - see service logs." hid a model
// degeneration for a whole day.
//
// opencode is mocked so the test exercises the shape, not the model.

import { describe, expect, mock, test } from "bun:test"

// Non-zero exit is deliberately not retryable, so this resolves on the first
// attempt and the test does not wait out RETRY_DELAY_MS.
mock.module("../src/opencode.js", () => ({
  runOpencode: async () => ({
    code: 1,
    stdout: "",
    stderr: "boom",
    events: [],
    killed: false,
  }),
  textFromEvents: () => "",
}))

const { runApply, runGmailScan, runCalendar } = await import("../src/worker.js")

describe("daemon helpers report failure instead of returning null", () => {
  test("runApply carries the exit reason", async () => {
    const result = await runApply("https://example.com/job/1")

    expect(result).not.toBeNull()
    expect(result.ok).toBe(false)
    expect(result.error).toContain("exited 1")
  })

  test("runGmailScan carries the exit reason", async () => {
    const result = await runGmailScan([])

    expect(result).not.toBeNull()
    expect(result.ok).toBe(false)
    expect(result.error).toContain("exited 1")
  })

  test("runCalendar carries the exit reason", async () => {
    const result = await runCalendar({ summary: "call" })

    expect(result).not.toBeNull()
    expect(result.ok).toBe(false)
    expect(result.error).toContain("exited 1")
  })
})
