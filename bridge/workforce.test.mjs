import test from 'node:test'
import assert from 'node:assert/strict'
import { configuration, request, submitObjective, startRun } from './workforce.mjs'

test('Workforce configuration requires endpoint and API key', () => {
  assert.equal(configuration({}).ok, false)
  assert.equal(configuration({ TITAN_WORKFORCE_API_URL: 'https://workforce.example', TITAN_WORKFORCE_API_KEY: 'secret' }).ok, true)
})

test('production Workforce endpoint must use HTTPS', () => {
  assert.equal(configuration({ NODE_ENV: 'production', TITAN_WORKFORCE_API_URL: 'http://workforce.example', TITAN_WORKFORCE_API_KEY: 'secret' }).ok, false)
})

test('Workforce request sends bearer auth and correlation ID', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.headers.authorization, 'Bearer secret')
    assert.match(init.headers['x-correlation-id'], /^[0-9a-f-]{36}$/)
    return new Response(JSON.stringify({ data: { id: 'objective-1' }, correlation_id: 'corr-1' }), { status: 201, headers: { 'content-type': 'application/json' } })
  }
  try {
    const result = await request('/objectives', { method: 'POST' }, { TITAN_WORKFORCE_API_URL: 'https://workforce.example', TITAN_WORKFORCE_API_KEY: 'secret' })
    assert.equal(result.ok, true)
    assert.equal(result.status, 201)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('submitObjective reports accepted only after Workforce confirms', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ data: { id: 'objective-1' }, correlation_id: 'corr-1' }), { status: 201 })
  try {
    const result = await submitObjective('Build the next ZLA campaign', { TITAN_WORKFORCE_API_URL: 'https://workforce.example', TITAN_WORKFORCE_API_KEY: 'secret' })
    assert.deepEqual(result, { state: 'accepted', objectiveId: 'objective-1', correlationId: 'corr-1' })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('startRun reports rejected when Workforce rejects', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Objective not found', correlation_id: 'corr-2' }), { status: 404 })
  try {
    const result = await startRun('objective-1', { TITAN_WORKFORCE_API_URL: 'https://workforce.example', TITAN_WORKFORCE_API_KEY: 'secret' })
    assert.deepEqual(result, { state: 'rejected', status: 404, message: 'Objective not found', correlationId: 'corr-2' })
  } finally {
    globalThis.fetch = originalFetch
  }
})
