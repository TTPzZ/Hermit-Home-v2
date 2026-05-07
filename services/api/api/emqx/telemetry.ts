import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase } from '../../lib/mongoClient';
import { withAuth, type AuthenticatedRequest } from '../../lib/authMiddleware';
import { insertDiagnosticLog } from '../../lib/diagnosticLogRepo';
import {
  coerceBoolean,
  coerceFiniteNumber,
  extractPayloadObject,
  extractRelayState,
  extractTopic,
  isPlainObject,
  resolveDeviceId,
} from '../../lib/emqxIngest';
import { handleApiPreflight, methodNotAllowed } from '../../lib/http';
import { toVietnamDateTime } from '../../lib/timezone';

const ALLOWED_METHODS = ['POST'] as const;
const TELEMETRY_TOPIC_PREFIX = 'terrarium/telemetry/';

function coerceNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return coerceFiniteNumber(value);
}

const authenticatedHandler = withAuth(async (
  req: AuthenticatedRequest,
  res: VercelResponse,
): Promise<void> => {
  if (req.method !== 'POST') {
    methodNotAllowed(req, res, ALLOWED_METHODS);
    return;
  }

  if (!isPlainObject(req.body)) {
    res.status(400).json({ error: 'Request body must be a JSON object.' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const payload = extractPayloadObject(body);
  const topic = extractTopic(body, payload);
  const deviceId = resolveDeviceId({
    body,
    payload,
    topicPrefix: TELEMETRY_TOPIC_PREFIX,
  });

  if (!deviceId) {
    res.status(400).json({
      error: 'Cannot resolve deviceId. Include deviceId/user_id or use topic terrarium/telemetry/{deviceId}.',
    });
    return;
  }

  const temperature = coerceNullableNumber(payload.temperature);
  const humidity = coerceNullableNumber(payload.humidity);
  const lux = coerceFiniteNumber(payload.lux);
  const sensorFault = coerceBoolean(payload.sensor_fault);
  const userOverride = coerceBoolean(payload.user_override);
  const relays = extractRelayState(payload.relays);

  if (
    temperature === null && payload.temperature !== null && payload.temperature !== undefined
  ) {
    res.status(400).json({ error: '`temperature` must be a finite number or null.' });
    return;
  }

  if (humidity === null && payload.humidity !== null && payload.humidity !== undefined) {
    res.status(400).json({ error: '`humidity` must be a finite number or null.' });
    return;
  }

  if (lux === null) {
    res.status(400).json({ error: '`lux` must be a finite number.' });
    return;
  }

  if (sensorFault === null) {
    res.status(400).json({ error: '`sensor_fault` must be a boolean.' });
    return;
  }

  if (userOverride === null) {
    res.status(400).json({ error: '`user_override` must be a boolean.' });
    return;
  }

  if (!relays) {
    res.status(400).json({
      error: '`relays` must contain boolean heater, mist, fan, and light fields.',
    });
    return;
  }

  const now = new Date();
  const nowVn = toVietnamDateTime(now);

  try {
    const { db } = await connectToDatabase();

    await db.collection('telemetry').insertOne({
      userId: deviceId,
      timestamp: now,
      timestampVn: nowVn,
      temperature,
      humidity,
      lux,
      sensor_fault: sensorFault,
      user_override: userOverride,
      relays,
    });

    await db.collection('devices').updateOne(
      { deviceId },
      {
        $set: {
          deviceId,
          lastTelemetryAt: now,
          lastTelemetryAtVn: nowVn,
          updatedAt: now,
          updatedAtVn: nowVn,
        },
      },
      { upsert: true },
    );

    await insertDiagnosticLog({
      deviceId,
      userId: null,
      source: 'system',
      category: 'TELEMETRY',
      status: 'PASS',
      message: '[PASS] Telemetry ingested from EMQX HTTP Rule Engine.',
      metadata: {
        topic: topic ?? null,
        ingress: 'emqx-rule-http',
      },
    });

    res.status(201).json({
      success: true,
      deviceId,
      timestamp: now.toISOString(),
    });
  } catch (error: unknown) {
    await insertDiagnosticLog({
      deviceId,
      userId: null,
      source: 'system',
      category: 'TELEMETRY',
      status: 'FAIL',
      message: '[FAIL] Telemetry ingestion from EMQX failed.',
      metadata: {
        topic: topic ?? null,
        ingress: 'emqx-rule-http',
        error: (error as Error).message,
      },
    });

    res.status(500).json({ error: 'Failed to persist telemetry.' });
  }
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (handleApiPreflight(req, res, ALLOWED_METHODS)) {
    return;
  }

  if (req.method !== 'POST') {
    methodNotAllowed(req, res, ALLOWED_METHODS);
    return;
  }

  await authenticatedHandler(req, res);
}
