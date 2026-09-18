import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import crypto from 'node:crypto'

const DEFAULT_TIMEOUT_MS = 15_000

function configuration(raw = process.env) {
  const apiUrl = String(raw.TITAN_API_URL ?? '').trim().replace(/\/$/, '')
  const ownerToken = String(raw.TITAN_OWNER_API_TOKEN ?? '').trim()
  const storeId = String(raw.TITAN_OWNER_STORE_ID ?? '').trim()

  let validUrl = false
  try {
    const parsed = new URL(apiUrl)
    validUrl =
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (raw.NODE_ENV !== 'production' || parsed.protocol === 'https:')
  } catch {}

  return {
    ok: Boolean(apiUrl && ownerToken && /^[A-Za-z0-9_.:-]{1,128}$/.test(storeId) && validUrl),
    apiUrl,
    ownerToken,
    storeId,
  }
}

async function request(path, init = {}, raw = process.env) {
  const cfg = configuration(raw)
  if (!cfg.ok) {
    return { ok: false, status: 503, error: 'TITAN API is not configured' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Number(raw.TITAN_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  )

  try {
    const response = await fetch(`${cfg.apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${cfg.ownerToken}`,
        'x-titan-store-id': cfg.storeId,
        'x-correlation-id': crypto.randomUUID(),
        ...(init.headers ?? {}),
      },
    })
    const text = await response.text()
    let body = {}
    try { body = text ? JSON.parse(text) : {} } catch {}
    return { ok: response.ok, status: response.status, body }
  } catch (error) {
    void error
    return {
      ok: false,
      status: 503,
      error: error?.name === 'AbortError' ? 'TITAN API request timed out' : 'TITAN API could not be reached',
    }
  } finally {
    clearTimeout(timeout)
  }
}

const commandSchema = {
  command: z.string().min(1).max(10_000).describe('The business command to submit to TITAN Mission Control.'),
  idempotencyKey: z.string().min(1).max(128).optional().describe('Optional stable key for safe replay.'),
}

export function titanServer() {
  return createSdkMcpServer({
    name: 'titan',
    version: '1.0.0',
    instructions:
      'TITAN Commerce OS bridge. Use titan_health before claiming TITAN is reachable. ' +
      'Use titan_command for business commands that should enter TITAN Mission Control. ' +
      'The command is submitted through the private owner API and is never reported as queued unless TITAN confirms it.',
    alwaysLoad: true,
    tools: [
      tool(
        'titan_health',
        'Check TITAN API health/readiness. Returns explicit configured/reachable/healthy state without exposing credentials.',
        {},
        async () => {
          const cfg = configuration()
          if (!cfg.ok) {
            return { content: [{ type: 'text', text: JSON.stringify({ state: 'configuration-required' }) }] }
          }

          const results = {}
          for (const path of ['/health', '/livez', '/readyz', '/version']) {
            results[path] = await request(path)
          }

          const healthy = ['/health', '/livez', '/readyz'].every((path) => results[path]?.ok)
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                state: healthy ? 'healthy' : 'degraded',
                checks: Object.fromEntries(
                  Object.entries(results).map(([path, value]) => [
                    path,
                    { ok: value.ok, status: value.status },
                  ]),
                ),
              }),
            }],
          }
        },
      ),
      tool(
        'titan_command',
        'Submit one business command to TITAN Mission Control. Use only when the user actually wants TITAN to execute or queue the command.',
        commandSchema,
        async ({ command, idempotencyKey }) => {
          const key = idempotencyKey || crypto.randomUUID()
          const result = await request('/v1/mission-control/commands', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              idempotencyKey: key,
              command,
              source: 'app_intent',
            }),
          })

          if (!result.ok) {
            const error = result.body?.error ?? {}
            return {
              isError: true,
              content: [{
                type: 'text',
                text: JSON.stringify({
                  state: result.status === 503 ? 'unavailable' : 'rejected',
                  status: result.status,
                  message: error.message ?? result.error ?? 'TITAN did not accept the command',
                  correlationId: error.correlationId ?? null,
                }),
              }],
            }
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                state: 'queued',
                created: result.body?.created ?? null,
                executionId: result.body?.execution?.id ?? null,
                executionStatus: result.body?.execution?.status ?? null,
                correlationId: result.body?.correlationId ?? null,
              }),
            }],
          }
        },
      ),
    ],
  })
}

export { configuration, request }
