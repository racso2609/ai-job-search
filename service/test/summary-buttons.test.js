// End-to-end check of sendSummary: every button it builds must fit Telegram's
// 64-byte callback_data cap, and the returned list must only contain the jobs
// whose card was actually delivered (so markNotified cannot swallow a failure).
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const stateDir = mkdtempSync(join(tmpdir(), "ajs-test-"))
process.env.STATE_DIR = stateDir
process.env.TELEGRAM_BOT_TOKEN = "test"
process.env.TELEGRAM_CHAT_ID = "1"

const { sendSummary, __setBotForTest, callbackId } = await import(
  "../src/telegram.js"
)

const LONG_JOBS = [
  {
    key: "coderio_senior-full-stack-developer-con-experiencia-en-node-js-y-rea-b15484",
    title: "Senior Full Stack Developer",
    company: "Coderio",
    url: "https://example.test/1",
    rank_score: 84,
    rank_verdict: "strong",
  },
  {
    key: "bairesdev_senior-fullstack-react-node-developer-remote-work-ref-307768",
    title: "Senior Fullstack React Node",
    company: "BairesDev",
    url: "https://example.test/2",
    rank_score: 84,
    rank_verdict: "strong",
  },
]

function fakeBot() {
  const sent = []
  return {
    sent,
    api: {
      sendMessage: async (_chat, text, extra) => {
        sent.push({ text, extra })
        return { message_id: sent.length }
      },
    },
  }
}

test("sendSummary keeps every callback_data within 64 bytes", async () => {
  const bot = fakeBot()
  __setBotForTest(bot)
  await sendSummary(LONG_JOBS, { header: "test" })

  const buttons = bot.sent
    .flatMap((m) => m.extra?.reply_markup?.inline_keyboard ?? [])
    .flat()
  assert.ok(buttons.length > 0, "expected job buttons to be built")
  for (const b of buttons) {
    const n = Buffer.byteLength(b.callback_data, "utf8")
    assert.ok(n <= 64, `${b.callback_data} is ${n} bytes`)
  }
})

test("sendSummary reports only the jobs whose card was delivered", async () => {
  const bot = fakeBot()
  // Fail on the second job card, keep the summary and the first card working.
  let calls = 0
  bot.api.sendMessage = async (_chat, text, extra) => {
    calls++
    if (extra?.reply_markup && calls === 3) {
      throw new Error("400: Bad Request: BUTTON_DATA_INVALID")
    }
    bot.sent.push({ text, extra })
    return { message_id: calls }
  }
  __setBotForTest(bot)

  const delivered = await sendSummary(LONG_JOBS, { header: "test" })
  assert.deepEqual(delivered, [LONG_JOBS[0].key])
})

test("a tap on the hashed button resolves back to the full job key", async () => {
  const bot = fakeBot()
  __setBotForTest(bot)
  await sendSummary(LONG_JOBS, { header: "test" })

  const { getPending } = await import("../src/state.js")
  const id = callbackId(LONG_JOBS[0].key)
  const meta = getPending(`job:${id}`)
  assert.ok(meta, "pending payload missing for the hashed id")
  assert.equal(meta.key, LONG_JOBS[0].key)
  assert.equal(meta.company, LONG_JOBS[0].company)
})
