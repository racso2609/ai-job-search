import { Bot, InlineKeyboard, InputFile } from "grammy"
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

export function setHandlers(h) {
  handlers = h
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
      const meta = getPending(`job:${id}`) || pending.get(id) || {}
      recordDecision({
        key: id,
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
        await handlers.onApply(id, meta)
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
// [Apply]/[Skip] buttons. Returns the number sent.
export async function sendSummary(jobs, { header } = {}) {
  if (!jobs.length) {
    await sendMessage("No new matches this run.")
    return 0
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

  for (const j of jobs) {
    const id = j.key
    const meta = { company: j.company, role: j.title, url: j.url, score: j.rank_score }
    pending.set(id, meta)
    addPending(`job:${id}`, meta)
    const kb = new InlineKeyboard()
      .text("Apply", `apply:${id}`)
      .text("Skip", `skip:${id}`)
    await sendMessage(
      `<b>${escapeHtml(j.title)}</b>\n${escapeHtml(j.company)}` +
        (j.url ? `\n${escapeHtml(j.url)}` : ""),
      { reply_markup: kb },
    )
  }

  return jobs.length
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
