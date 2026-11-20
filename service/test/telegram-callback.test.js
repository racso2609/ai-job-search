// Regression: Telegram caps callback_data at 64 bytes. Job keys are long slugs
// (81-88 bytes observed in production), so buttons built from the raw key were
// rejected with "400: Bad Request: BUTTON_DATA_INVALID" and the whole scrape
// cycle failed after the summary had already been sent.
import { test } from "node:test"
import assert from "node:assert/strict"
import { callbackId, assertCallbackData } from "../src/telegram.js"

const LONG_KEYS = [
  "coderio_senior-full-stack-developer-con-experiencia-en-node-js-y-rea-b15484",
  "bairesdev_senior-fullstack-react-node-developer-remote-work-ref-307768",
  "oliver-bernard_senior-backend-engineer-node-ts-fully-remote-ai-fintech-scal-46a474",
]

test("the raw job key would exceed Telegram's 64-byte callback_data limit", () => {
  // Guards the premise: if this ever stops holding, the bug is not reachable.
  for (const key of LONG_KEYS) {
    assert.ok(
      Buffer.byteLength(`apply:${key}`, "utf8") > 64,
      `expected apply:${key} to exceed 64 bytes`,
    )
  }
})

test("callbackId keeps apply:/skip: payloads under the limit", () => {
  for (const key of LONG_KEYS) {
    const id = callbackId(key)
    for (const action of ["apply", "skip"]) {
      const data = `${action}:${id}`
      assert.ok(
        Buffer.byteLength(data, "utf8") <= 64,
        `${data} is ${Buffer.byteLength(data, "utf8")} bytes`,
      )
    }
  }
})

test("callbackId is deterministic and collision-free for distinct keys", () => {
  assert.equal(callbackId(LONG_KEYS[0]), callbackId(LONG_KEYS[0]))
  const ids = new Set(LONG_KEYS.map(callbackId))
  assert.equal(ids.size, LONG_KEYS.length)
})

test("assertCallbackData throws instead of letting Telegram reject the message", () => {
  assert.equal(assertCallbackData("apply:abc"), "apply:abc")
  assert.throws(
    () => assertCallbackData(`apply:${LONG_KEYS[0]}`),
    /callback_data too long/,
  )
})
