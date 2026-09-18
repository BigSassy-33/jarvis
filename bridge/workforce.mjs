import crypto from 'node:crypto'

const DEFAULT_TIMEOUT_MS = 15_000

function configuration(raw = process.env) {
  const apiUrl = String(raw.TITAN_WORKFORCE_API_URL ?? '').trim().replace(/\/+$/, '')
  const apiKey = String(raw.TITAN_WORKFORCE_API_KEY ?? '').trim()
  let validUrl = false
  try {
    const parsed = new URL(apiUrl)
    validUrl =
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      (raw.NODE_ENV !== 'production' || parsed.protocol === 'https:')
  } catch {}
  return { ok: Boolean(apiUrl && apiKey && validUrl), apiUrl, apiKey }
}

async function request(path, init = {}, raw = process.env) {
  const cfg = configuration(raw)
  if (!cfg.ok) return { ok: false, status: 503, error: 'TITAN Workforce is not configured' }

  const controller = new AbortController()
  const timeout = setTimeout(
    () => controller.abort(),
    Number(raw.TITAN_WORKFORCE_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
  )
  const correlationId = init.correlationId ?? crypto.randomUUID()
  try {
    const response = await fetch(`${cfg.apiUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${cfg.apiKey}`,
        'x-correlation-id': correlationId,
        ...(init.headers ?? {}),
      },
    })
    const text = await response.text()
    let body = {}
    try { body = text ? JSON.parse(text) : {} } catch {}
    return {
      ok: response.ok,
      status: response.status,
      body,
      correlationId: body?.correlation_id ?? correlationId,
    }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error?.name === 'AbortError'
        ? 'TITAN Workforce request timed out'
        : 'TITAN Workforce could not be reached',
      correlationId,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function failure(result, fallback) {
  return {
    state: result.status === 503 ? 'unavailable' : 'rejected',
    status: result.status,
    message: result.body?.error ?? result.error ?? fallback,
    correlationId: result.correlationId ?? null,
  }
}

export async function submitObjective(text, raw = process.env, correlationId) {
  const objective = String(text ?? '').trim()
  if (!objective) return { state: 'invalid', message: 'Workforce objective is required' }

  const result = await request('/objectives', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: objective }),
    correlationId,
  }, raw)

  if (!result.ok) return failure(result, 'TITAN Workforce rejected the objective')
  const objectiveId = result.body?.data?.id
  if (!objectiveId) {
    return { state: 'rejected', status: result.status, message: 'Workforce returned no objective ID', correlationId: result.correlationId }
  }
  return { state: 'accepted', objectiveId, correlationId: result.correlationId }
}

export async function startRun(objectiveId, raw = process.env, correlationId) {
  const id = String(objectiveId ?? '').trim()
  if (!id) return { state: 'invalid', message: 'Workforce objective ID is required' }

  const result = await request('/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ objective_id: id }),
    correlationId,
  }, raw)

  if (!result.ok) return failure(result, 'TITAN Workforce rejected the run')
  const runId = result.body?.data?.id
  if (!runId) {
    return { state: 'rejected', status: result.status, message: 'Workforce returned no run ID', correlationId: result.correlationId }
  }
  return { state: 'accepted', runId, correlationId: result.correlationId }
}

export async function executeWorkforceObjective(text, raw = process.env, correlationId) {
  const first = await submitObjective(text, raw, correlationId)
  if (first.state !== 'accepted') return first

  const second = await startRun(first.objectiveId, raw, correlationId)
  if (second.state !== 'accepted') {
    return {
      ...second,
      objectiveId: first.objectiveId,
    }
  }

  return {
    state: 'accepted',
    objectiveId: first.objectiveId,
    runId: second.runId,
    correlationId: second.correlationId,
  }
}

export { configuration, request }
