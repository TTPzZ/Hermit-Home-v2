# Local Backend Setup (Mongo + MQTT + API + Worker)

This guide runs the current backend stack fully on local machine before Oracle deployment.

## 1) Start local infra (MongoDB + MQTT broker)

From repo root:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

Check containers:

```powershell
docker ps
```

Expected services:
- `hermit-home-mongo` on `localhost:27017`
- `hermit-home-mosquitto` on `localhost:1883`

## 2) Create local env files

Copy root `.env.example` into:
- `.env` (repo root, required by `vercel dev` in monorepo mode)
- `services/api/.env`
- `services/mqtt-worker/.env`

Then set local values:

```env
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB_NAME="hermit-home-local"
TZ="Asia/Ho_Chi_Minh"

MQTT_PROTOCOL="mqtt"
MQTT_BROKER="localhost"
MQTT_PORT=1883
MQTT_USER=""
MQTT_PASS=""
MQTT_CA_CERT=""

JWT_SECRET="change_me_local_jwt_secret"
SERVICE_API_KEY="change_me_local_service_key"
FIREBASE_SERVICE_ACCOUNT_KEY=""

AGENT_CONTROL_ENABLED=false
ENFORCE_ALLOWED_DEVICE_IDS=false
```

Optional for password reset routes:

```env
PASSWORD_RESET_URL="http://localhost:3000/reset-password"
SMTP_HOST=""
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
```

## 3) Install dependencies

From repo root:

```powershell
npm install
npm --prefix packages/shared-types run build
```

## 4) Run API locally

```powershell
cd D:\Hermit-Home
npm run local:api:dev
```

By default Vercel local runtime serves at `http://localhost:3000`.

## 5) Run mqtt-worker locally

Open terminal 2:

```powershell
cd D:\Hermit-Home
npm run local:worker:dev
```

Worker health endpoint:
- `http://localhost:10000/ping`

## 6) Quick smoke test

Use existing flow script from repo root:

```powershell
$env:BENCH_BASE_URL="http://localhost:3000"
$env:DEVICE_ID="<your_24_hex_device_id>"
$env:SERVICE_API_KEY="change_me_local_service_key"
node scripts/test-server-flows.cjs
```

Or run the compact local end-to-end script:

```powershell
cd D:\Hermit-Home
npm run local:e2e
```

## 7) Oracle-like stack in one command (recommended)

This runs API + worker + Mongo + Mosquitto in Docker using production-like wiring.

```powershell
cd D:\Hermit-Home
npm run local:stack:up
npm run local:stack:e2e
```

Stop stack:

```powershell
npm run local:stack:down
```

## 8) Test with FE + hardware (ESP32)

Recommended path: hardware follows backend on your self-managed broker.

1) Keep backend defaults in `infra/oracle.env.local`:
- `MONGODB_URI=` (empty = use local Mongo container)
- `MONGODB_DB_NAME=hermit-home-local`
- `MQTT_PROTOCOL=mqtt`
- `MQTT_BROKER=mosquitto`
- `MQTT_PORT=1883`

2) Configure ESP32 to same broker in `hardware/esp32/include/config.h`:
- `MQTT_PROTOCOL` must match backend (`mqtt` or `mqtts`)
- `MQTT_BROKER` must point to your broker host/IP
- `MQTT_PORT` must match broker port
- `MQTT_USER`/`MQTT_PASS` must match broker auth

3) Reflash ESP32, then restart backend stack:
```powershell
npm run local:stack:down
npm run local:stack:up
```

4) Run FE with local API:
```powershell
cd D:\Hermit-Home\apps\mobile
flutter run --dart-define=API_BASE_URL=http://<your-lan-ip>:3000
```

If phone and backend are on same Wi-Fi, use backend machine LAN IP (not `localhost`) for `API_BASE_URL`.
You can also change backend URL directly inside app (Login/Dashboard backend settings).

To write local stack data directly to MongoDB Atlas:

1) Set in `infra/oracle.env.local`:
```env
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority&appName=<name>
MONGODB_DB_NAME=hermit-home-staging
```
2) Restart stack:
```powershell
npm run local:stack:down
npm run local:stack:up
```

## 9) Copy local DB to server DB later

When Oracle is available again, create a separate server DB (example: `hermit-home-prod`) and copy data from local:

```powershell
cd D:\Hermit-Home
npm run db:copy -- `
  --from-uri mongodb://localhost:27017 `
  --from-db hermit-home-local `
  --to-uri "mongodb+srv://<user>:<pass>@<cluster>/?retryWrites=true&w=majority" `
  --to-db hermit-home-prod `
  --drop-target true
```

Notes:
- `--drop-target true` will replace target data with local snapshot.
- Omit `--drop-target` if you only want upsert without deleting old docs.
- Use `--collections users,telemetry,device_states` to copy selected collections only.
- Time fields are stored as Mongo `Date` (UTC) for reliable sorting/filtering, and major runtime collections also include human-readable VN fields (`*Vn`) for easier inspection.

## 10) Stop local infra (legacy minimal stack)

```powershell
docker compose -f infra/docker-compose.yml down
```

To delete data volumes too:

```powershell
docker compose -f infra/docker-compose.yml down -v
```
