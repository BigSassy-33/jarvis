# TITAN Commerce OS + JARVIS Integration

## Runtime ownership

- **TITAN Commerce OS** owns durable business state, Mission Control, agent execution, approvals, audit/evidence, and commerce operations.
- **JARVIS** owns the executive voice, browser face, local interaction, display surfaces, and local tool orchestration.
- **The JARVIS bridge** is the integration boundary. It holds the private TITAN owner token server-side and exposes TITAN to the agent through a narrow in-process MCP server named `titan`.

## Live tools

### `titan_health`

Checks:

- `/health`
- `/livez`
- `/readyz`
- `/version`

The tool reports only capability state and HTTP status. Credentials are never returned.

### `titan_command`

Submits to the verified Mission Control endpoint:

`POST /v1/mission-control/commands`

The request uses:

- `Authorization: Bearer $TITAN_OWNER_API_TOKEN`
- `x-titan-store-id: $TITAN_OWNER_STORE_ID`
- generated correlation ID
- idempotency key
- `source: jarvis`

A command is reported as queued only after TITAN returns a successful response.

## Fallback behavior

If TITAN is not configured or reachable, JARVIS does not fabricate a queued execution.

For tasks that can safely be completed with JARVIS's local/browser capabilities, the agent may continue using those capabilities. Durable TITAN execution must remain explicitly reported as unavailable until TITAN confirms it.

## Configuration

Server-side only:

- `TITAN_API_URL`
- `TITAN_OWNER_API_TOKEN`
- `TITAN_OWNER_STORE_ID`
- `TITAN_API_TIMEOUT_MS`

Production remote API URLs must use HTTPS.

## Verification boundary

Configured ≠ reachable ≠ healthy ≠ verified.

CI verifies the adapter syntax and deterministic request behavior. A real production TITAN health/command check additionally requires the owner API token, store ID, and a deployed reachable TITAN API.
