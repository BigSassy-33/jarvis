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

test('executeWorkforceObjective creates an objective then starts its run', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), correlation: init.headers['x-correlation-id'] })
    if (calls.length === 1) {
      return new Response(JSON.stringify({ data: { id: 'objective-1' }, correlation_id: 'corr-1' }), { status: 201 })
    }
    return new Response(JSON.stringify({ data: { id: 'run-1' }, correlation_id: 'corr-2' }), { status: 201 })
  }
  try {
    const result = await (await import('./workforce.mjs?execute-test')).executeWorkforceObjective('Run this objective', { TITAN_WORKFORCE_API_URL: 'https://workforce.example', TITAN_WORKFORCE_API_KEY: 'secret' }, 'corr-request')
    assert.equal(result.state, 'accepted')
    assert.equal(result.objectiveId, 'objective-1')
    assert.equal(result.runId, 'run-1')
    assert.equal(calls.length, 2)
    assert.equal(calls[0].body.text, 'Run this objective')
    assert.equal(calls[1].body.objective_id, 'objective-1')
    assert.equal(calls[0].correlation, 'corr-request')
    assert.equal(calls[1].correlation, 'corr-request')
  } finally {
    globalThis.fetch = originalFetch
  }
})
