# Oracle VM Deployment Guide (API + MQTT + Worker)

This guide deploys the current backend stack to an Oracle VM using Docker Compose:

- API runtime (Vercel local runtime)
- MQTT worker
- MongoDB
- Mosquitto broker

## 1) Prepare Oracle VM

Ubuntu example:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 2) Clone repo and configure env

```bash
git clone <your-repo-url> hermit-home
cd hermit-home
cp infra/oracle.env.example infra/oracle.env
```

Edit `infra/oracle.env`:

- Set strong secrets:
  - `SERVICE_API_KEY`
  - `JWT_SECRET`
- Use separate DB name for new environment (example): `MONGODB_DB_NAME=hermit-home-prod`
- Choose broker mode you manage:
  - Broker in this compose stack: `MQTT_PROTOCOL=mqtt`, `MQTT_BROKER=mosquitto`, `MQTT_PORT=1883`
  - External broker you manage: set `MQTT_PROTOCOL`, `MQTT_BROKER`, `MQTT_PORT`, `MQTT_USER`, `MQTT_PASS`
- Optional: fill SMTP and OpenRouter values.

## 3) Start full stack

```bash
npm install
npm run oracle:stack:up
```

## 4) Verify services

```bash
curl http://<vm-public-ip>:3000/api/devices
curl http://<vm-public-ip>:10000/ping
```

Expected:

- API responds with route guidance JSON.
- Worker responds with `MQTT Worker is running`.

## 5) Run end-to-end test on server

```bash
LOCAL_API_BASE_URL=http://localhost:3000 npm run local:e2e
```

Expected output includes:

- `E2E PASS`
- `"hasTelemetryPass": true`
- `"hasAckPass": true`

## 6) Expose only required ports

Recommended Oracle NSG / firewall inbound rules:

- `3000/tcp` (API)
- `10000/tcp` (optional, worker health endpoint)
- `1883/tcp` only if ESP32 connects directly from internet

If possible, put API behind Nginx/Caddy with HTTPS and keep MQTT private/VPN.

## 7) Update ESP32 / clients for Oracle

- In `hardware/esp32/include/config.h`, set:
  - `MQTT_PROTOCOL` to `mqtt` or `mqtts`
  - `MQTT_BROKER` to your Oracle domain/IP (or broker host)
  - `MQTT_PORT` to your broker port
  - `MQTT_USER`/`MQTT_PASS` to broker credentials
- API base URL for app/agent: `http(s)://<your-domain-or-ip>:3000`

## 8) Logs and lifecycle

```bash
npm run oracle:stack:logs
npm run oracle:stack:down
```
