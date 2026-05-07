const OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

const RELAY_KEYS = ['heater', 'mist', 'fan', 'light'] as const;

export type RelayKey = (typeof RELAY_KEYS)[number];
export type RelayState = Record<RelayKey, boolean>;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

export function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function tryParseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function extractPayloadObject(body: Record<string, unknown>): Record<string, unknown> {
  const payload = body.payload;
  if (isPlainObject(payload)) {
    return payload;
  }
  if (typeof payload === 'string') {
    const parsedPayload = tryParseJsonObject(payload);
    if (parsedPayload) {
      return parsedPayload;
    }
  }
  return body;
}

export function extractTopic(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
): string | null {
  return asString(body.topic) ?? asString(body.mqtt_topic) ?? asString(payload.topic);
}

export function extractDeviceIdFromTopic(topic: string, prefix: string): string | null {
  if (!topic.startsWith(prefix)) {
    return null;
  }

  const parts = topic.split('/');
  if (parts.length !== 3) {
    return null;
  }

  const candidate = parts[2]?.trim();
  if (!candidate || !OBJECT_ID_REGEX.test(candidate)) {
    return null;
  }
  return candidate;
}

function normalizeObjectId(value: unknown): string | null {
  const candidate = asString(value);
  if (!candidate || !OBJECT_ID_REGEX.test(candidate)) {
    return null;
  }
  return candidate;
}

export function resolveDeviceId(params: {
  body: Record<string, unknown>;
  payload: Record<string, unknown>;
  topicPrefix: string;
}): string | null {
  const fromBody =
    normalizeObjectId(params.body.deviceId) ??
    normalizeObjectId(params.body.userId) ??
    normalizeObjectId(params.body.user_id);
  if (fromBody) {
    return fromBody;
  }

  const fromPayload =
    normalizeObjectId(params.payload.deviceId) ??
    normalizeObjectId(params.payload.userId) ??
    normalizeObjectId(params.payload.user_id);
  if (fromPayload) {
    return fromPayload;
  }

  const topic = extractTopic(params.body, params.payload);
  if (!topic) {
    return null;
  }

  return extractDeviceIdFromTopic(topic, params.topicPrefix);
}

export function extractRelayState(value: unknown): RelayState | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const heater = coerceBoolean(value.heater);
  const mist = coerceBoolean(value.mist);
  const fan = coerceBoolean(value.fan);
  const light = coerceBoolean(value.light);

  if (heater === null || mist === null || fan === null || light === null) {
    return null;
  }

  return { heater, mist, fan, light };
}

export function isRelayKey(value: string): value is RelayKey {
  return (RELAY_KEYS as readonly string[]).includes(value);
}
