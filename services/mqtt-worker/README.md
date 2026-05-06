# MQTT Worker

Core responsibilities:

- Subscribe telemetry/confirm topics from MQTT broker.
- Persist telemetry and diagnostic logs to MongoDB.
- Expose `/ping` and `/` health endpoints.
- Optionally trigger an external AI agent API in a fixed loop.

## EMQX Cloud Serverless

Use the same MQTT values in Vercel API and this worker:

- `MQTT_PROTOCOL=mqtts`
- `MQTT_BROKER=<host from EMQX deployment overview>`
- `MQTT_PORT=8883`
- `MQTT_USER=<EMQX client username>`
- `MQTT_PASS=<EMQX client password>`
- `MQTT_CA_CERT=` optional, usually empty on Node runtimes

`MQTT_BROKER` must be the original EMQX host only. Do not include a protocol, path, IP address, or custom CNAME because EMQX Serverless uses TLS/SNI validation.

## Agent API Trigger Loop (Temporary Bridge)

Use this when your agent is not running as a continuous worker yet, and needs periodic HTTP triggers.

Environment variables:

- `AGENT_CONTROL_ENABLED=true`
- `AGENT_CONTROL_URL=https://hermit-home.vercel.app/api/agent/control/cycle`
- `AGENT_CONTROL_METHOD=POST` (or `GET`)
- `AGENT_CONTROL_API_KEY=<SERVICE_API_KEY on Vercel API>`
- `AGENT_CONTROL_INTERVAL_MS=20000`
- `AGENT_CONTROL_TIMEOUT_MS=8000`
- `AGENT_CONTROL_BODY_JSON={"source":"mqtt-worker","trigger":"interval"}`

Recommended interval:

- `20000` ms (20 seconds): good balance between responsiveness and API cost/load.

Behavior:

- First trigger runs immediately at worker startup.
- Next triggers run every `AGENT_CONTROL_INTERVAL_MS`.
- In-flight guard prevents overlapping calls.
- Worker does not auto-inject `deviceId` into POST body.
- If no `deviceId` is sent, Vercel endpoint auto-resolves multiple targets from latest telemetry.
