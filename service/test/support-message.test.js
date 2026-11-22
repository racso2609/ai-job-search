// Support turns: a free-text Telegram message is answered on demand by the
// support agent. These tests pin the two things that can silently break the
// feature: a command being mistaken for a question, and a missing handler
// crashing the bot instead of being a no-op.
import { test } from "node:test"
import assert from "node:assert/strict"
import { handleSupportText, setHandlers } from "../src/telegram.js"

function fakeCtx(text) {
  return {
    message: { text },
    replied: [],
    async reply(msg) {
      this.replied.push(msg)
    },
    async replyWithChatAction() {},
  }
}

test("a free-text message is routed to the support agent", async () => {
  const seen = []
  setHandlers({ onSupport: async (t) => seen.push(t) })

  await handleSupportText(fakeCtx("cuantas candidaturas llevo?"))
  assert.deepEqual(seen, ["cuantas candidaturas llevo?"])
})

test("commands are not routed to the support agent", async () => {
  const seen = []
  setHandlers({ onSupport: async (t) => seen.push(t) })

  await handleSupportText(fakeCtx("/start"))
  assert.deepEqual(seen, [], "a /command must not become a support turn")
})

test("without an onSupport handler the listener is a no-op, not a crash", async () => {
  setHandlers({})

  const ctx = fakeCtx("hola")
  await handleSupportText(ctx)
  assert.deepEqual(ctx.replied, [])
})

test("a failing support turn is reported, not swallowed silently", async () => {
  setHandlers({
    onSupport: async () => {
      throw new Error("boom")
    },
  })

  const ctx = fakeCtx("hola")
  await handleSupportText(ctx)
  assert.equal(ctx.replied.length, 1)
  assert.match(ctx.replied[0], /Error procesando/)
})
