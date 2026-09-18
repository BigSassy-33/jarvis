import crypto from 'node:crypto'

export const TITAN_HEADS = Object.freeze({ JARVIS: 'jarvis', TITAN: 'titan', TITAN_SOS: 'titan_sos' })
const HEADS = new Set(Object.values(TITAN_HEADS))

export function resolveHead(command) {
  const text = String(command ?? '').trim().toLowerCase()
  if (!text) return null
  if (/\b(sos|research|experiment|creative|media|model evaluation|rag)\b/.test(text)) return TITAN_HEADS.TITAN_SOS
  return TITAN_HEADS.TITAN
}

export function createHeadRouter({ titanRequest, sosRequest } = {}) {
  return {
    async route({ command, head = resolveHead(command), idempotencyKey } = {}) {
      if (!command || !String(command).trim()) return { state: 'invalid', message: 'A command is required.' }
      if (!HEADS.has(head)) return { state: 'invalid', message: 'Unknown TITAN head.' }
      const key = idempotencyKey || crypto.randomUUID()
      if (head === TITAN_HEADS.TITAN) {
        if (typeof titanRequest !== 'function') return { state: 'unavailable', head, message: 'TITAN adapter is unavailable.' }
        return titanRequest({ command: String(command).trim(), idempotencyKey: key })
      }
      if (head === TITAN_HEADS.TITAN_SOS) {
        if (typeof sosRequest !== 'function') return { state: 'interface-required', head, message: 'TITAN.SOS requires its authenticated cross-head interface before execution.' }
        return sosRequest({ command: String(command).trim(), idempotencyKey: key })
      }
      return { state: 'invalid', head, message: 'JARVIS is the executive interface, not an execution target.' }
    },
  }
}