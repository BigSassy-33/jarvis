import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import crypto from 'node:crypto'
import { createHeadRouter, TITAN_HEADS } from './head-router.mjs'
import { submitObjective, startRun, executeWorkforceObjective } from './workforce.mjs'

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

async function sosRequest(command, idempotencyKey, raw = process.env) {
  const apiUrl = String(raw.TITAN_SOS_API_URL ?? '').trim().replace(/\/$/, '')
  const token = String(raw.TITAN_SOS_API_TOKEN ?? '').trim()
  if (!apiUrl || !token) {
    return {
      state: 'interface-required',
      head: TITAN_HEADS.TITAN_SOS,
      message: 'TITAN.SOS authenticated interface is not configured.',
    }
  }

  let validUrl = false
  try {
    const parsed = new URL(apiUrl)
    validUrl = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && raw.NODE_ENV !== 'production')
  } catch {}

  if (!validUrl) {
    return {
      state: 'rejected',
      head: TITAN_HEADS.TITAN_SOS,
      message: 'TITAN.SOS interface requires HTTPS outside development.',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Number(raw.TITAN_SOS_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  )
  const correlationId = crypto.randomUUID()

  try {
    const response = await fetch(`${apiUrl}/v1/cross-head/requests`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-correlation-id': correlationId,
        'x-titan-source-head': TITAN_HEADS.JARVIS,
        'x-titan-target-head': TITAN_HEADS.TITAN_SOS,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        sourceHead: TITAN_HEADS.JARVIS,
        targetHead: TITAN_HEADS.TITAN_SOS,
        idempotencyKey,
        command,
        capability: 'route_to_head',
      }),
    })
    const bodyText = await response.text()
    let body = {}
    try { body = bodyText ? JSON.parse(bodyText) : {} } catch {}

    if (!response.ok) {
      return {
        state: response.status === 503 ? 'unavailable' : 'rejected',
        head: TITAN_HEADS.TITAN_SOS,
        status: response.status,
        message: body?.error?.message ?? body?.error ?? 'TITAN.SOS rejected the cross-head request.',
        correlationId: body?.correlationId ?? correlationId,
      }
    }

    return {
      state: body?.state ?? 'queued',
      head: TITAN_HEADS.TITAN_SOS,
      requestId: body?.requestId ?? body?.request?.id ?? null,
      approvalRequired: body?.approvalRequired ?? true,
      correlationId: body?.correlationId ?? correlationId,
    }
  } catch (error) {
    return {
      state: 'unavailable',
      head: TITAN_HEADS.TITAN_SOS,
      message: error?.name === 'AbortError'
        ? 'TITAN.SOS interface request timed out'
        : 'TITAN.SOS interface could not be reached',
      correlationId,
    }
  } finally {
    clearTimeout(timeout)
  }
}

const headRouter = createHeadRouter({
  titanRequest: async ({ command, idempotencyKey }) => {
    const result = await request('/v1/mission-control/commands', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idempotencyKey, command, source: 'app_intent' }),
    })
    if (!result.ok) return { state: result.status === 503 ? 'unavailable' : 'rejected', head: TITAN_HEADS.TITAN, status: result.status, message: result.body?.error?.message ?? result.error ?? 'TITAN did not accept the command', correlationId: result.body?.correlationId ?? null }
    return { state: 'queued', head: TITAN_HEADS.TITAN, executionId: result.body?.execution?.id ?? null, executionStatus: result.body?.execution?.status ?? null, correlationId: result.body?.correlationId ?? null }
  },
  sosRequest: ({ command, idempotencyKey }) => sosRequest(command, idempotencyKey),
})

const headCommandSchema = {
  command: z.string().min(1).max(10_000),
  head: z.enum(['jarvis', 'titan', 'titan_sos']).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
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
        'titan_route',
        'Route an executive command to JARVIS, TITAN, or TITAN.SOS. TITAN.SOS execution is never claimed unless its authenticated cross-head interface is actually configured.',
        headCommandSchema,
        async ({ command, head, idempotencyKey }) => {
          const result = await headRouter.route({ command, head, idempotencyKey })
          return { isError: result.state === 'invalid' || result.state === 'unavailable' || result.state === 'interface-required', content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      ),
      tool(
        'titan_execution_status',
        'Retrieve the status of a TITAN execution previously returned by titan_command or titan_route. Never infer completion from queue acceptance.',
        { executionId: z.string().min(1).max(128) },
        async ({ executionId }) => {
          const result = await request(`/agent-executions/${encodeURIComponent(executionId)}`, { method: 'GET' })
          if (!result.ok) {
            return {
              isError: true,
              content: [{
                type: 'text',
                text: JSON.stringify({
                  state: result.status === 503 ? 'unavailable' : 'rejected',
                  status: result.status,
                  message: result.body?.error?.message ?? result.error ?? 'TITAN execution status could not be retrieved',
                  correlationId: result.body?.error?.correlationId ?? result.body?.correlationId ?? result.correlationId ?? null,
                }),
              }],
            }
          }

          const execution = result.body?.execution ?? result.body?.data ?? result.body
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                state: execution?.status ?? 'unknown',
                executionId: execution?.id ?? executionId,
                execution,
                correlationId: result.body?.correlationId ?? result.correlationId ?? null,
              }),
            }],
          }
        },
      ),
      tool(
        'workforce_execute',
        'Submit an objective to TITAN Workforce and start its run. It is reported as accepted only after both authenticated API operations confirm creation.',
        { objective: z.string().min(1).max(5_000) },
        async ({ objective }) => {
          const result = await executeWorkforceObjective(objective)
          return { isError: result.state !== 'accepted', content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      ),
      tool(
        'workforce_objective',
        'Submit an objective to TITAN Workforce. It is reported as accepted only after the authenticated Workforce API confirms creation.',
        { objective: z.string().min(1).max(5_000) },
        async ({ objective }) => {
          const result = await submitObjective(objective)
          return { isError: result.state !== 'accepted', content: [{ type: 'text', text: JSON.stringify(result) }] }
        },
      ),
      tool(
        'workforce_run',
        'Start a TITAN Workforce run for an existing objective ID. It is reported as accepted only after Workforce confirms creation.',
        { objectiveId: z.string().uuid() },
        async ({ objectiveId }) => {
          const result = await startRun(objectiveId)
          return { isError: result.state !== 'accepted', content: [{ type: 'text', text: JSON.stringify(result) }] }
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
