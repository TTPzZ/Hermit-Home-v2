import { ObjectId } from 'mongodb';
import { connectToDatabase } from './mongoClient';
import { toVietnamDateTime } from './timezone';

const COLLECTION_NAME = 'user_override_windows';
const DEFAULT_USER_OVERRIDE_GRACE_SECONDS = 300;
const MIN_USER_OVERRIDE_GRACE_SECONDS = 30;
const MAX_USER_OVERRIDE_GRACE_SECONDS = 3600;

export type UserOverrideWindowDocument = {
  _id?: ObjectId;
  deviceId: string;
  userId: string;
  active: boolean;
  startedAt: Date;
  startedAtVn?: string | null;
  expiresAt: Date;
  expiresAtVn?: string | null;
  activatedBy: 'control' | 'override';
  clearedAt?: Date;
  clearedAtVn?: string | null;
  clearReason?: string;
  createdAt: Date;
  createdAtVn?: string | null;
  updatedAt: Date;
  updatedAtVn?: string | null;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getUserOverrideGraceSeconds(): number {
  const parsed = Number.parseInt(process.env.USER_OVERRIDE_GRACE_SECONDS || '', 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_USER_OVERRIDE_GRACE_SECONDS;
  }

  return clamp(parsed, MIN_USER_OVERRIDE_GRACE_SECONDS, MAX_USER_OVERRIDE_GRACE_SECONDS);
}

export async function startUserOverrideWindow(params: {
  deviceId: string;
  userId: string;
  activatedBy: 'control' | 'override';
}): Promise<UserOverrideWindowDocument> {
  const { db } = await connectToDatabase();
  const now = new Date();
  const graceSeconds = getUserOverrideGraceSeconds();
  const expiresAt = new Date(now.getTime() + graceSeconds * 1000);
  const nowVn = toVietnamDateTime(now);
  const expiresAtVn = toVietnamDateTime(expiresAt);

  await db.collection<UserOverrideWindowDocument>(COLLECTION_NAME).updateOne(
    { deviceId: params.deviceId },
    {
      $set: {
        deviceId: params.deviceId,
        userId: params.userId,
        active: true,
        startedAt: now,
        startedAtVn: nowVn,
        expiresAt,
        expiresAtVn,
        activatedBy: params.activatedBy,
        updatedAt: now,
        updatedAtVn: nowVn,
      },
      $unset: {
        clearedAt: '',
        clearedAtVn: '',
        clearReason: '',
      },
      $setOnInsert: {
        createdAt: now,
        createdAtVn: nowVn,
      },
    },
    { upsert: true },
  );

  return {
    deviceId: params.deviceId,
    userId: params.userId,
    active: true,
    startedAt: now,
    startedAtVn: nowVn,
    expiresAt,
    expiresAtVn,
    activatedBy: params.activatedBy,
    createdAt: now,
    createdAtVn: nowVn,
    updatedAt: now,
    updatedAtVn: nowVn,
  };
}

export async function getActiveUserOverrideWindow(
  deviceId: string,
): Promise<UserOverrideWindowDocument | null> {
  const { db } = await connectToDatabase();
  const now = new Date();
  const nowVn = toVietnamDateTime(now);

  const active = await db
    .collection<UserOverrideWindowDocument>(COLLECTION_NAME)
    .findOne({
      deviceId,
      active: true,
      expiresAt: { $gt: now },
    });

  if (active) {
    return active;
  }

  await db.collection<UserOverrideWindowDocument>(COLLECTION_NAME).updateOne(
    {
      deviceId,
      active: true,
      expiresAt: { $lte: now },
    },
    {
      $set: {
        active: false,
        clearedAt: now,
        clearedAtVn: nowVn,
        clearReason: 'expired',
        updatedAt: now,
        updatedAtVn: nowVn,
      },
    },
  );

  return null;
}

export async function clearUserOverrideWindow(
  deviceId: string,
  reason: string,
): Promise<boolean> {
  const { db } = await connectToDatabase();
  const now = new Date();
  const nowVn = toVietnamDateTime(now);
  const result = await db.collection<UserOverrideWindowDocument>(COLLECTION_NAME).updateOne(
    {
      deviceId,
      active: true,
    },
    {
      $set: {
        active: false,
        clearedAt: now,
        clearedAtVn: nowVn,
        clearReason: reason.slice(0, 200),
        updatedAt: now,
        updatedAtVn: nowVn,
      },
    },
  );

  return result.modifiedCount > 0;
}
