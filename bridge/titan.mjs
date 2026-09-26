import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const CAPABILITIES = ['sos:research', 'sos:creative', 'sos:request_production']

function config() {
  const baseUrl = (process.env.TITAN_API_URL ?? '').replace(/\/+$/, '')
  const token = process.env.TITAN_SOS_CROSS_HEAD_TOKEN ?? ''
  const organizationId = process.env.TITAN_SOS_CROSS_HEAD_ORGANIZATION_ID ?? ''
  return { baseUrl, token, organizationId }
}

const titanSosRequest = tool(
  'titan_sos_request',
  'Submit an authenticated, auditable JARVIS request to TITAN.SOS. Research and creative work are accepted by SOS; production requests are recorded as approval_required and never execute production mutations at this boundary.',
  {
    command: z.string().min(1).max(16384),
    capability: z.enum(['sos:research', 'sos:creative', 'sos:request_production']),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/),
    correlationId: z.string().min(1).max(255),
  },
  async ({ command, capability, idempotencyKey, correlationId }) => {
    const { baseUrl, token, organizationId } = config()
    if (!baseUrl || !token || !organizationId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'TITAN_SOS_NOT_CONFIGURED',
            required: ['TITAN_API_URL', 'TITAN_SOS_CROSS_HEAD_TOKEN', 'TITAN_SOS_CROSS_HEAD_ORGANIZATION_ID'],
          }),
        }],
        isError: true,
      }
    }

    const response = await fetch(`${baseUrl}/v1/cross-head/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
        'x-correlation-id': correlationId,
        'x-titan-source-head': 'jarvis',
        'x-titan-target-head': 'titan_sos',
      },
      body: JSON.stringify({
        organizationId,
        sourceHead: 'jarvis',
        targetHead: 'titan_sos',
        command,
        capability,
        idempotencyKey,
      }),
    })

    const text = await response.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text.slice(0, 2000) }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          httpStatus: response.status,
          ok: response.ok,
          ...body,
        }),
      }],
      isError: !response.ok,
    }
  },
  {
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
  },
)

export const titanSosServer = createSdkMcpServer({
  name: 'titan_sos',
  version: '1.0.0',
  tools: [titanSosRequest],
})
