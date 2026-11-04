import { EventEmitter } from "node:events"
import { log } from "./logger.js"

// Minimal serial job queue. One job runs at a time; a job is an async function.
// Events: "idle", "done" (job), "failed" (job, err).
export class Queue extends EventEmitter {
  constructor() {
    super()
    this.jobs = []
    this.running = false
  }

  push(name, fn) {
    const job = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name, fn }
    this.jobs.push(job)
    log.info(`queue: +${name} (${this.jobs.length} pending)`)
    this.#drain()
    return job.id
  }

  get pending() {
    return this.jobs.length + (this.running ? 1 : 0)
  }

  async #drain() {
    if (this.running) return
    const job = this.jobs.shift()
    if (!job) {
      this.emit("idle")
      return
    }
    this.running = true
    log.info(`queue: running ${job.name}`)
    try {
      await job.fn()
      this.emit("done", job)
    } catch (err) {
      log.error(`queue: ${job.name} failed:`, err?.stack ?? err)
      this.emit("failed", job, err)
    } finally {
      this.running = false
      // Yield a tick so the event loop can breathe between jobs.
      setImmediate(() => this.#drain())
    }
  }
}
