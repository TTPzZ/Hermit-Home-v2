#!/usr/bin/env node
/* eslint-disable no-console */

const mqtt = require('mqtt');

const BASE_URL = (process.env.LOCAL_API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const MQTT_URL = process.env.LOCAL_MQTT_URL || 'mqtt://localhost:1883';
const MQTT_USER = process.env.LOCAL_MQTT_USER || '';
const MQTT_PASS = process.env.LOCAL_MQTT_PASS || '';
const MQTT_REJECT_UNAUTHORIZED =
  (process.env.LOCAL_MQTT_REJECT_UNAUTHORIZED || 'false').toLowerCase() === 'true';
const WAIT_MS_AFTER_TELEMETRY = Number.parseInt(process.env.E2E_WAIT_TELEMETRY_MS || '800', 10);
const WAIT_MS_AFTER_ACK = Number.parseInt(process.env.E2E_WAIT_ACK_MS || '1000', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomEmail() {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return `local-e2e-${suffix}@test.local`;
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    text,
    json,
  };
}

function assertStatus(result, expectedStatuses, step) {
  if (!expectedStatuses.includes(result.status)) {
    const bodyPreview = result.json || result.text;
    throw new Error(
      `${step} failed. Expected ${expectedStatuses.join(', ')}, got ${result.status}. Body: ${JSON.stringify(bodyPreview)}`,
    );
  }
}

async function publishMqtt(topic, payload) {
  const connectOptions = {
    rejectUnauthorized: MQTT_REJECT_UNAUTHORIZED,
  };
  if (MQTT_USER) {
    connectOptions.username = MQTT_USER;
  }
  if (MQTT_PASS) {
    connectOptions.password = MQTT_PASS;
  }
  const client = mqtt.connect(MQTT_URL, connectOptions);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error(`MQTT publish timeout for topic ${topic}`));
    }, 5000);

    client.on('connect', () => {
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        clearTimeout(timeout);
        client.end();
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}

async function main() {
  const startedAt = Date.now();
  const email = randomEmail();
  const password = 'Test12345!';

  console.log(`[1/8] Register user: ${email}`);
  const registerResult = await request('/api/auth?action=register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      email,
      password,
    },
  });
  assertStatus(registerResult, [201], 'Register');

  console.log('[2/8] Login user');
  const loginResult = await request('/api/auth?action=login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      email,
      password,
    },
  });
  assertStatus(loginResult, [200], 'Login');

  const token = loginResult.json?.token;
  const deviceId = loginResult.json?.user?._id;
  if (!token || !deviceId) {
    throw new Error(`Login response missing token/deviceId: ${JSON.stringify(loginResult.json)}`);
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  console.log(`[3/8] Publish telemetry to MQTT topic terrarium/telemetry/${deviceId}`);
  await publishMqtt(`terrarium/telemetry/${deviceId}`, {
    temperature: 27.1,
    humidity: 79.2,
    lux: 320,
    sensor_fault: false,
    user_override: false,
    user_id: deviceId,
    relays: {
      heater: false,
      mist: false,
      fan: true,
      light: false,
    },
  });
  await sleep(WAIT_MS_AFTER_TELEMETRY);

  console.log('[4/8] Read latest telemetry from API');
  const latestResult = await request(`/api/devices/${deviceId}/data?type=latest`, {
    headers: authHeaders,
  });
  assertStatus(latestResult, [200], 'Get latest telemetry');

  console.log('[5/8] Read telemetry history from API');
  const historyResult = await request(`/api/devices/${deviceId}/data?type=history&limit=5`, {
    headers: authHeaders,
  });
  assertStatus(historyResult, [200], 'Get telemetry history');

  console.log('[6/8] Send control command (light=true)');
  const controlResult = await request(`/api/devices/${deviceId}/action?type=control`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: {
      light: true,
    },
  });
  assertStatus(controlResult, [200, 207], 'Control command');

  console.log('[7/8] Publish confirm ack to MQTT');
  await publishMqtt(`terrarium/confirm/${deviceId}`, {
    event: 'override_ack',
    device: 'light',
    state: true,
    user_id: deviceId,
  });
  await sleep(WAIT_MS_AFTER_ACK);

  console.log('[8/8] Read diagnostic logs');
  const logsResult = await request(`/api/logs?deviceId=${deviceId}&limit=30`);
  assertStatus(logsResult, [200], 'Get logs');

  const logs = Array.isArray(logsResult.json?.logs) ? logsResult.json.logs : [];
  const hasTelemetryPass = logs.some(
    (item) => item?.category === 'TELEMETRY' && item?.status === 'PASS',
  );
  const hasAckPass = logs.some(
    (item) => item?.category === 'ACK' && item?.status === 'PASS' && item?.relay === 'light',
  );

  const finishedAt = Date.now();
  const summary = {
    baseUrl: BASE_URL,
    mqttUrl: MQTT_URL,
    deviceId,
    email,
    hasTelemetryPass,
    hasAckPass,
    elapsedMs: finishedAt - startedAt,
  };

  if (!hasTelemetryPass || !hasAckPass) {
    throw new Error(
      `E2E completed but expected logs missing. Summary: ${JSON.stringify(summary, null, 2)}`,
    );
  }

  console.log('\nE2E PASS');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error('\nE2E FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
