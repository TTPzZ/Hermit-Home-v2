import { CommandPayload, DeviceStatePatch, RelayState } from '@smart-terrarium/shared-types';

function parseBooleanFlag(raw: string | undefined, fallback: boolean): boolean {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

// Temporary safety lock while mist hardware is faulty.
// Can be overridden by environment for local/integration testing.
export const MIST_SAFETY_LOCK_ENABLED = parseBooleanFlag(
  process.env.AGENT_MIST_SAFETY_LOCK_ENABLED || process.env.MIST_SAFETY_LOCK_ENABLED,
  true,
);

export function sanitizeRelayMap<T extends Partial<RelayState> | undefined>(relays: T): T {
  if (!MIST_SAFETY_LOCK_ENABLED || !relays) {
    return relays;
  }

  return {
    ...relays,
    mist: false,
  } as T;
}

export function sanitizeCommandPayload(payload: CommandPayload): CommandPayload {
  if (!MIST_SAFETY_LOCK_ENABLED) {
    return payload;
  }

  return {
    ...payload,
    devices: sanitizeRelayMap(payload.devices),
  };
}

export function sanitizeDeviceStatePatch(patch: DeviceStatePatch): DeviceStatePatch {
  if (!MIST_SAFETY_LOCK_ENABLED) {
    return patch;
  }

  return {
    ...patch,
    relays: sanitizeRelayMap(patch.relays),
  };
}
