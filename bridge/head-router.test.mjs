import assert from 'node:assert/strict'
import test from 'node:test'
import { createHeadRouter, resolveHead, TITAN_HEADS } from './head-router.mjs'

test('routes ordinary commerce commands to TITAN', async () => {
  let call
  const router = createHeadRouter({ titanRequest: async (args) => { call = args; return { state: 'queued', head: TITAN_HEADS.TITAN } } })
  const result = await router.route({ command: 'sync my Shopify orders' })
  assert.equal(resolveHead('sync my Shopify orders'), TITAN_HEADS.TITAN)
  assert.equal(result.state, 'queued')
  assert.equal(call.command, 'sync my Shopify orders')
  assert.ok(call.idempotencyKey)
})

test('routes research and creative commands to SOS without pretending execution', async () => {
  const router = createHeadRouter()
  assert.equal(resolveHead('research AI video generation'), TITAN_HEADS.TITAN_SOS)
  const result = await router.route({ command: 'research AI video generation' })
  assert.equal(result.state, 'interface-required')
  assert.equal(result.head, TITAN_HEADS.TITAN_SOS)
})

test('rejects JARVIS as an execution target', async () => {
  const router = createHeadRouter()
  const result = await router.route({ command: 'say hello', head: TITAN_HEADS.JARVIS })
  assert.equal(result.state, 'invalid')
})