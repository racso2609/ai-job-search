// Vision + CV routing: a photo goes to the vision step, a "genera un CV"
// request goes to the CV flow, and an ordinary question about existing CVs
// stays with the read-only support agent. These pin the routing that can
// silently misroute (a CV question that triggers generation, or a photo that
// is ignored).
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  handleSupportText,
  handlePhotoMessage,
  setHandlers,
} from "../src/telegram.js"

function fakeTextCtx(text) {
  return {
    message: { text },
    replied: [],
    async reply(msg) {
      this.replied.push(msg)
    },
    async replyWithChatAction() {},
  }
}

function fakePhotoCtx(caption = "") {
  return {
    message: {
      photo: [
        { file_id: "small", width: 90 },
        { file_id: "big", width: 1280 },
      ],
      caption,
    },
    replied: [],
    async reply(msg) {
      this.replied.push(msg)
    },
    async replyWithChatAction() {},
  }
}

test("a 'genera un CV' request is routed to the CV flow, not support", async () => {
  const cv = []
  const support = []
  setHandlers({
    onCvRequest: async (t) => cv.push(t),
    onSupport: async (t) => support.push(t),
  })

  await handleSupportText(fakeTextCtx("genera un CV para esta oferta https://x/y"))
  assert.equal(cv.length, 1, "should hit the CV flow")
  assert.equal(support.length, 0, "must not also hit support")
})

test("a question about existing CVs stays with the support agent", async () => {
  const cv = []
  const support = []
  setHandlers({
    onCvRequest: async (t) => cv.push(t),
    onSupport: async (t) => support.push(t),
  })

  await handleSupportText(fakeTextCtx("¿cuántos CVs tengo creados?"))
  assert.equal(cv.length, 0, "a question must NOT trigger generation")
  assert.equal(support.length, 1, "should go to support")
})

test("a photo is routed to the vision step with its caption", async () => {
  const seen = []
  setHandlers({ onVision: async (p) => seen.push(p) })

  await handlePhotoMessage(fakePhotoCtx("esta oferta"))
  assert.equal(seen.length, 1)
  assert.equal(seen[0].fileId, "big", "should pick the largest photo size")
  assert.equal(seen[0].caption, "esta oferta")
})

test("without an onVision handler a photo is a no-op, not a crash", async () => {
  setHandlers({})
  const ctx = fakePhotoCtx()
  await handlePhotoMessage(ctx)
  assert.deepEqual(ctx.replied, [])
})
