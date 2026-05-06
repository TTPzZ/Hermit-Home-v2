export interface RelayState {
  heater: boolean;
  mist: boolean;
  fan: boolean;
  light: boolean;
}

export interface ThresholdConfig {
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  lux_min: number;
  lux_max: number;
}

export interface CommandPayload {
  user_override: boolean;
  devices?: Partial<RelayState>;
  thresholds?: Partial<ThresholdConfig>;
}

export type DeviceMode = 'AUTO' | 'MANUAL';

export interface DeviceStateRecord {
  deviceId: string;
  mode: DeviceMode;
  user_override: boolean;
  relays: RelayState;
  lastTelemetryAt: string | null;
  lastCommandAt: string | null;
  updatedAt: string;
}

export interface DeviceStatePatch {
  mode?: DeviceMode;
  user_override?: boolean;
  relays?: Partial<RelayState>;
}
