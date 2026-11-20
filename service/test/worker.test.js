// Regression tests for the daemon's missing-result diagnosis and retry.
//
// Both fixtures reproduce real failures observed on 2026-11-20:
//   - BairesDev: the model emitted 595 raw `</invoke>`-style tags as text and
//     ended with `reason: "stop"`, so no JSON block ever reached the daemon.
//   - Oliver Bernard: the model spent its entire output budget on reasoning
//     (`reason: "length"`, output: 0) and never printed the result block.
//
// Run with: bun test service/test

import { describe, expect, test } from "bun:test"
import { diagnoseMissingResult, extractJsonBlock } from "../src/worker.js"

// Builds the JSONL stream opencode emits, one event per line.
function jsonl(events) {
  return events.map((e) => JSON.stringify(e)).join("\n")
}

function textEvent(text) {
  return { type: "text", part: { type: "text", text } }
}

function finishEvent(reason, tokens) {
  return { type: "step_finish", part: { type: "step-finish", reason, tokens } }
}

describe("diagnoseMissingResult", () => {
  test("flags the raw-markup degeneration seen on the BairesDev run", () => {
    // 595 tags in the real run; reproduce the shape, not the exact count.
    const noise = "</result>\n</invoke>\n</parameter>\n".repeat(200)
    const stdout = jsonl([textEvent(noise), finishEvent("stop", { output: 5945 })])

    const diag = diagnoseMissingResult({ stdout, events: [], code: 0, killed: false })

    expect(diag.retryable).toBe(true)
    expect(diag.reason).toContain("markup")
  })

  test("flags the reasoning-budget exhaustion seen on the Oliver Bernard run", () => {
    const stdout = jsonl([
      textEvent("Drafts written. Dispatching reviewer."),
      finishEvent("length", { output: 0, reasoning: 32000 }),
    ])
    const events = [textEvent("x"), finishEvent("length", { output: 0, reasoning: 32000 })]

    const diag = diagnoseMissingResult({ stdout, events, code: 0, killed: false })

    expect(diag.retryable).toBe(true)
    expect(diag.reason).toContain("output budget")
  })

  test("does not retry a timeout - a retry would just burn another budget", () => {
    const diag = diagnoseMissingResult({
      stdout: jsonl([textEvent("working")]),
      events: [],
      code: null,
      killed: true,
    })

    expect(diag.retryable).toBe(false)
    expect(diag.reason).toContain("time budget")
  })

  test("does not retry a non-zero exit", () => {
    const diag = diagnoseMissingResult({
      stdout: "",
      events: [],
      code: 3,
      killed: false,
    })

    expect(diag.retryable).toBe(false)
    expect(diag.reason).toContain("exited 3")
  })

  test("a healthy run's few example tags are not mistaken for degeneration", () => {
    // A normal run may quote one example block; that is far below the threshold.
    const stdout = jsonl([
      textEvent("Here is the shape:\n```json\n{\"ok\":true}\n```\n</invoke>"),
      finishEvent("stop", { output: 900 }),
    ])

    const diag = diagnoseMissingResult({ stdout, events: [], code: 0, killed: false })

    expect(diag.reason).not.toContain("markup")
    expect(diag.retryable).toBe(true)
  })
})

describe("extractJsonBlock", () => {
  test("reads the result block out of a normal JSONL stream", () => {
    const stdout = jsonl([
      textEvent("done"),
      textEvent('```json\n{"ok":true,"company":"Acme"}\n```'),
    ])

    expect(extractJsonBlock(stdout).company).toBe("Acme")
  })

  test("ignores a degenerate stream that carries no result block", () => {
    const stdout = jsonl([textEvent("</result>\n</invoke>\n".repeat(200))])

    expect(extractJsonBlock(stdout)).toBeNull()
  })
})
