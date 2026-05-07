import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withAuth, type AuthenticatedRequest } from '../../lib/authMiddleware';
import {
  acknowledgePendingCommand,
  insertDiagnosticLog,
} from '../../lib/diagnosticLogRepo';
import {
  asString,
  coerceBoolean,
  extractPayloadObject,
  extractTopic,
  isPlainObject,
  isRelayKey,
  resolveDeviceId,
} from '../../lib/emqxIngest';
import { handleApiPreflight, methodNotAllowed } from '../../lib/http';

const ALLOWED_METHODS = ['POST'] as const;
const CONFIRM_TOPIC_PREFIX = 'terrarium/confirm/';

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
    topicPrefix: CONFIRM_TOPIC_PREFIX,
  });

  if (!deviceId) {
    res.status(400).json({
      error: 'Cannot resolve deviceId. Include deviceId/user_id or use topic terrarium/confirm/{deviceId}.',
    });
    return;
  }

  const status = asString(payload.status)?.toLowerCase() ?? null;

  if (status === 'offline') {
    await insertDiagnosticLog({
      deviceId,
      userId: null,
      source: 'system',
      category: 'ACK',
      status: 'FAIL',
      message: '[FAIL] Edge Device reported offline status via EMQX.',
      metadata: {
        topic: topic ?? null,
        payload,
        ingress: 'emqx-rule-http',
      },
    });
    res.status(202).json({ success: true, deviceId, status: 'offline' });
    return;
  }

  if (status === 'online') {
    await insertDiagnosticLog({
      deviceId,
      userId: null,
      source: 'system',
      category: 'ACK',
      status: 'INFO',
      message: '[INFO] Edge Device reported online status via EMQX.',
      metadata: {
        topic: topic ?? null,
        ingress: 'emqx-rule-http',
      },
    });
    res.status(200).json({ success: true, deviceId, status: 'online' });
    return;
  }

  const event = asString(payload.event)?.toLowerCase() ?? '';
  const relay = asString(payload.device)?.toLowerCase() ?? '';
  const relayState = coerceBoolean(payload.state);

  if (event !== 'override_ack') {
    res.status(400).json({ error: '`event` must be "override_ack" for confirm ingestion.' });
    return;
  }

  if (!isRelayKey(relay)) {
    res.status(400).json({ error: '`device` must be one of heater|mist|fan|light.' });
    return;
  }

  if (relayState === null) {
    res.status(400).json({ error: '`state` must be a boolean.' });
    return;
  }

  try {
    const matched = await acknowledgePendingCommand({
      deviceId,
      relay,
      acknowledgedState: relayState,
      source: 'system',
      metadata: {
        topic: topic ?? null,
        ingress: 'emqx-rule-http',
      },
    });

    res.status(200).json({
      success: true,
      deviceId,
      matched,
    });
  } catch (error: unknown) {
    await insertDiagnosticLog({
      deviceId,
      userId: null,
      source: 'system',
      category: 'ACK',
      status: 'FAIL',
      message: '[FAIL] Confirm ingestion from EMQX failed.',
      metadata: {
        topic: topic ?? null,
        payload,
        ingress: 'emqx-rule-http',
        error: (error as Error).message,
      },
    });

    res.status(500).json({ error: 'Failed to process confirm message.' });
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
