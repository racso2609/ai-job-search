import { Bot, InlineKeyboard, InputFile } from "grammy"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { config } from "./config.js"
import { log } from "./logger.js"
import {
  recordDecision,
  addPending,
  getPending,
  removePending,
} from "./state.js"

let bot = null
// Set by index.js: callbacks the bot routes taps into.
let handlers = {}

// Telegram caps callback_data at 64 bytes. Job keys are built from
// company+title slugs and routinely blow past that (81, 88 bytes seen in
// production), which made the API reject the whole message with
// "400: Bad Request: BUTTON_DATA_INVALID". Buttons therefore carry a short
// opaque id and the full key is kept in the pending store.
const CALLBACK_DATA_MAX = 64

export function callbackId(jobKey) {
  return createHash("sha1").update(String(jobKey)).digest("hex")
}

// Fail loudly at build time instead of letting Telegram reject the message
// after the summary was already delivered.
export function assertCallbackData(data) {
  const bytes = Buffer.byteLength(data, "utf8")
  if (bytes > CALLBACK_DATA_MAX) {
    throw new Error(
      `callback_data too long (${bytes} > ${CALLBACK_DATA_MAX}): ${data}`,
    )
  }
  return data
}

export function setHandlers(h) {
  handlers = h
}

// Test seam: lets tests drive sendSummary without a live Telegram bot.
export function __setBotForTest(fake) {
  bot = fake
}

export function startBot() {
  bot = new Bot(config.telegram.token())

  bot.callbackQuery(/^([a-z_]+):(.+)$/, async (ctx) => {
    const action = ctx.match[1]
    const id = ctx.match[2]
    try {
      await routeCallback(ctx, action, id)
    } catch (e) {
      log.error(`callback ${action}:${id} failed:`, e?.stack ?? e)
      await ctx.answerCallbackQuery("Error - see logs").catch(() => {})
    }
  })

  bot.catch((err) => log.error("telegram bot error:", err?.message ?? err))

  bot
    .start({ onStart: () => log.info("telegram bot connected") })
    .catch((e) => log.error("telegram bot failed to start:", e?.message ?? e))

  return bot
}

async function routeCallback(ctx, action, id) {
  // id is either a job key (for apply/skip) or a pending-proposal id.
  switch (action) {
    case "apply":
    case "skip": {
      // `id` is the short opaque callback id; the real job key lives in the
      // pending payload (see sendSummary).
      const meta = getPending(`job:${id}`) || pending.get(`job:${id}`) || {}
      const jobKey = meta.key ?? id
      recordDecision({
        key: jobKey,
        company: meta.company,
        role: meta.role,
        url: meta.url,
        score: meta.score,
        decision: action,
      })
      const label = action === "apply" ? "Marked to APPLY" : "Skipped"
      await ctx.answerCallbackQuery(label)
      await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      await ctx
        .reply(`${label}\n${meta.company ?? ""} - ${meta.role ?? ""}`.trim(), {
          link_preview_options: { is_disabled: true },
        })
        .catch(() => {})
      if (action === "apply" && handlers.onApply) {
        await handlers.onApply(jobKey, meta)
      }
      removePending(`job:${id}`)
      break
    }

    case "gmail_approve":
    case "gmail_skip": {
      const prop = getPending(`gmail:${id}`)
      if (!prop) {
        await ctx.answerCallbackQuery("Expired")
        return
      }
      if (action === "gmail_approve") {
        await ctx.answerCallbackQuery("Approved")
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
        if (handlers.onGmailApprove) await handlers.onGmailApprove(prop)
      } else {
        await ctx.answerCallbackQuery("Ignored")
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      }
      removePending(`gmail:${id}`)
      break
    }

    case "cal_add":
    case "cal_skip": {
      const prop = getPending(`cal:${id}`)
      if (!prop) {
        await ctx.answerCallbackQuery("Expired")
        return
      }
      if (action === "cal_add") {
        await ctx.answerCallbackQuery("Adding to calendar")
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
        if (handlers.onCalendarApprove) await handlers.onCalendarApprove(prop)
      } else {
        await ctx.answerCallbackQuery("Ignored")
        await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
      }
      removePending(`cal:${id}`)
      break
    }

    default:
      await ctx.answerCallbackQuery("Unknown action")
  }
}

export const pending = new Map()

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

export async function sendMessage(text, extra = {}) {
  if (!bot) {
    log.info(`[no bot] ${text}`)
    return null
  }
  return bot.api.sendMessage(config.telegram.chatId(), text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...extra,
  })
}

// Sends a batch of ranked jobs: a summary plus one message per job with
// [Apply]/[Skip] buttons. Returns the job keys that were actually delivered,
// so the caller only marks those as notified.
export async function sendSummary(jobs, { header } = {}) {
  if (!jobs.length) {
    await sendMessage("No new matches this run.")
    return []
  }

  const lines = jobs.map((j, i) => {
    const score = j.rank_score ?? "?"
    const verdict = j.rank_verdict ?? ""
    const loc = j.location ? ` - ${j.location}` : ""
    const dl = j.deadline ? ` - deadline ${j.deadline}` : ""
    const guard = j.guard && j.guard !== "clean" ? " (!)" : ""
    return `${i + 1}. [${score}] ${escapeHtml(j.title)} - ${escapeHtml(
      j.company,
    )}${guard}\n    ${escapeHtml(verdict)}${escapeHtml(loc)}${escapeHtml(dl)}`
  })

  const tail = config.dashboardUrl
    ? `\n\n<a href="${config.dashboardUrl}">Open dashboard</a>`
    : "\n\n(run /html-report for the full dashboard)"

  await sendMessage(
    `<b>${escapeHtml(header ?? "New job matches")}</b>\n` +
      `${jobs.length} job(s) need your decision:\n\n` +
      lines.join("\n") +
      tail,
  )

  const delivered = []
  for (const j of jobs) {
    // Telegram rejects the whole message if callback_data exceeds 64 bytes.
    // Job keys are long slugs, so the button carries a short hash and the
    // full key travels in the pending payload.
    const id = callbackId(j.key)
    const meta = {
      key: j.key,
      company: j.company,
      role: j.title,
      url: j.url,
      score: j.rank_score,
    }
    pending.set(`job:${id}`, meta)
    addPending(`job:${id}`, meta)
    const kb = new InlineKeyboard()
      .text("Apply", assertCallbackData(`apply:${id}`))
      .text("Skip", assertCallbackData(`skip:${id}`))
    try {
      await sendMessage(
        `<b>${escapeHtml(j.title)}</b>\n${escapeHtml(j.company)}` +
          (j.url ? `\n${escapeHtml(j.url)}` : ""),
        { reply_markup: kb },
      )
      delivered.push(j.key)
    } catch (e) {
      // One undeliverable job must not abort the batch: the summary is already
      // out, and a throw here skips markNotified so the whole set is retried
      // on the next cycle.
      log.error(`failed to send job card for ${j.key}:`, e?.message ?? e)
      removePending(`job:${id}`)
      pending.delete(`job:${id}`)
    }
  }

  return delivered
}

// Sends one Gmail proposal with [Approve]/[Ignore] buttons.
export async function sendGmailProposal(prop, id) {
  addPending(`gmail:${id}`, prop)
  const kb = new InlineKeyboard()
    .text("Approve", `gmail_approve:${id}`)
    .text("Ignore", `gmail_skip:${id}`)
  const dt = prop.interview_datetime ? `\nWhen: ${prop.interview_datetime}` : ""
  await sendMessage(
    `<b>Status signal: ${escapeHtml(prop.company)}</b>\n` +
      `${escapeHtml(prop.role)}\n` +
      `${escapeHtml(prop.current_status)} -> ${escapeHtml(prop.proposed_status)}\n` +
      `\u201c${escapeHtml(prop.source_subject)}\u201d (${escapeHtml(prop.source_date)})` +
      dt,
    { reply_markup: kb },
  )
}

// Sends a calendar proposal with [Add to calendar]/[Ignore] buttons.
export async function sendCalendarProposal(prop, id) {
  addPending(`cal:${id}`, prop)
  const kb = new InlineKeyboard()
    .text("Add to calendar", `cal_add:${id}`)
    .text("Ignore", `cal_skip:${id}`)
  await sendMessage(
    `<b>Interview detected</b>\n` +
      `${escapeHtml(prop.company)} - ${escapeHtml(prop.role)}\n` +
      `When: ${escapeHtml(prop.datetime)}\n` +
      (prop.interviewer ? `Interviewer: ${escapeHtml(prop.interviewer)}\n` : "") +
      (prop.url ? `${escapeHtml(prop.url)}` : ""),
    { reply_markup: kb },
  )
}

// Sends the drafted application PDFs.
export async function sendApplication(result) {
  if (!bot) {
    log.info(`[no bot] application drafted: ${result.company} / ${result.role}`)
    return
  }
  const cap =
    `<b>Application drafted: ${escapeHtml(result.company)}</b>\n` +
    `${escapeHtml(result.role)}  - fit ${result.fit_score} (${escapeHtml(
      result.fit_verdict,
    )})\n` +
    (result.guard && result.guard !== "clean"
      ? `Gate: ${escapeHtml(result.guard)}\n`
      : "") +
    `${escapeHtml(result.summary ?? "")}\n\n` +
    `Review the PDFs, then submit manually through the portal.`
  await sendMessage(cap)

  for (const [label, rel] of [
    ["CV", result.cv_pdf],
    ["Cover letter", result.cover_pdf],
  ]) {
    if (!rel) continue
    const abs = join(config.paths.repo, rel)
    try {
      await bot.api.sendDocument(
        config.telegram.chatId(),
        new InputFile(abs, `${label} - ${result.company}.pdf`),
        { caption: label },
      )
    } catch (e) {
      log.error(`failed to send ${rel}:`, e?.message ?? e)
      await sendMessage(`(could not attach ${escapeHtml(rel)}: ${e?.message ?? e})`)
    }
  }
}
