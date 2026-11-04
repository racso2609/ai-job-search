import { Bot, InlineKeyboard } from "grammy"
import { config } from "./config.js"
import { log } from "./logger.js"
import { recordDecision } from "./state.js"

let bot = null

export function startBot() {
  bot = new Bot(config.telegram.token())

  // A tapped decision button: callback data is "apply:<key>" / "skip:<key>".
  bot.callbackQuery(/^(apply|skip):(.+)$/, async (ctx) => {
    const decision = ctx.match[1]
    const key = ctx.match[2]
    const meta = pending.get(key) || {}

    recordDecision({
      key,
      company: meta.company,
      role: meta.role,
      url: meta.url,
      score: meta.score,
      decision,
    })

    const label = decision === "apply" ? "✅ Marked to APPLY" : "🗑️ Skipped"
    await ctx.answerCallbackQuery(label)
    await ctx.editMessageReplyMarkup({ reply_markup: undefined }).catch(() => {})
    await ctx.reply(
      `${label}\n${meta.company ?? ""} — ${meta.role ?? ""}\n${
        decision === "apply"
          ? "(v1 records the choice. The apply phase arrives in v2.)"
          : ""
      }`.trim(),
      { link_preview_options: { is_disabled: true } },
    )
  })

  bot.catch((err) => {
    log.error("telegram bot error:", err?.message ?? err)
  })

  // Long-polling start; do not block startup.
  bot.start({ onStart: () => log.info("telegram bot connected") }).catch((e) => {
    log.error("telegram bot failed to start:", e?.message ?? e)
  })

  return bot
}

// Tracks the last sent job summary so a button tap can be resolved to metadata.
// Keyed by job key; populated by sendSummary() before the buttons are shown.
export const pending = new Map()

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

// Sends one batch summary: a short table of the top jobs plus, for each, a pair
// of inline buttons. Returns the number of jobs notified.
export async function sendSummary(jobs, { header } = {}) {
  if (!bot) {
    log.info(
      `[no bot] would notify ${jobs.length} job(s): ${jobs
        .map((j) => `${j.rank_score} ${j.company}`)
        .join(", ")}`,
    )
    return 0
  }

  if (!jobs.length) {
    await bot.api.sendMessage(config.telegram.chatId(), "No new matches this run.")
    return 0
  }

  // 1) Text summary.
  const lines = jobs.map((j, i) => {
    const score = j.rank_score ?? "?"
    const verdict = j.rank_verdict ?? ""
    const loc = j.location ? ` · ${j.location}` : ""
    const dl = j.deadline ? ` · ⏳ ${j.deadline}` : ""
    const guard = j.guard && j.guard !== "clean" ? " ⚠" : ""
    return `${i + 1}. [${score}] ${escapeHtml(j.title)} — ${escapeHtml(
      j.company,
    )}${guard}\n    ${escapeHtml(verdict)}${escapeHtml(loc)}${escapeHtml(dl)}`
  })

  const tail = config.dashboardUrl
    ? `\n\n<a href="${config.dashboardUrl}">📊 Open dashboard</a>`
    : "\n\n(run /html-report for the full dashboard)"

  const text =
    `<b>${escapeHtml(header ?? "New job matches")}</b>\n` +
    `${jobs.length} job(s) need your decision:\n\n` +
    lines.join("\n") +
    tail

  await bot.api.sendMessage(config.telegram.chatId(), text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  })

  // 2) One message per job with the decision buttons, so the tap maps 1:1.
  for (const j of jobs) {
    pending.set(j.key, {
      company: j.company,
      role: j.title,
      url: j.url,
      score: j.rank_score,
    })
    const kb = new InlineKeyboard()
      .text("✅ Apply", `apply:${j.key}`)
      .text("🗑️ Skip", `skip:${j.key}`)
    const body =
      `<b>${escapeHtml(j.title)}</b>\n${escapeHtml(j.company)}` +
      (j.url ? `\n${escapeHtml(j.url)}` : "")
    await bot.api.sendMessage(config.telegram.chatId(), body, {
      parse_mode: "HTML",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    })
  }

  return jobs.length
}
