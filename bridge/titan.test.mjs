import assert from 'node:assert/strict'
import test from 'node:test'
import { configuration, request } from './titan.mjs'

test('TITAN configuration rejects missing credentials', () => {
  assert.equal(configuration({ NODE_ENV: 'production' }).ok, false)
})

test('TITAN production configuration requires HTTPS', () => {
  assert.equal(configuration({
    NODE_ENV: 'production',
    TITAN_API_URL: 'http://titan.example.com',
    TITAN_OWNER_API_TOKEN: 'secret',
    TITAN_OWNER_STORE_ID: 'store-1',
  }).ok, false)
})

test('TITAN request sends private owner headers and JSON response', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://titan.example.com/health')
    assert.equal(init.headers.authorization, 'Bearer secret')
    assert.equal(init.headers['x-titan-store-id'], 'store-1')
    assert.equal(init.headers['content-type'], 'application/json')
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const result = await request('/health', {
      headers: { 'content-type': 'application/json' },
    }, {
      NODE_ENV: 'production',
      TITAN_API_URL: 'https://titan.example.com',
      TITAN_OWNER_API_TOKEN: 'secret',
      TITAN_OWNER_STORE_ID: 'store-1',
    })
    assert.equal(result.ok, true)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { ok: true })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('TITAN mission-control source uses an accepted application source', async () => {
  const source = (await import('node:fs/promises')).readFile
  const content = await source(new URL('./titan.mjs', import.meta.url), 'utf8')
  assert.match(content, /source: 'app_intent'/)
})
