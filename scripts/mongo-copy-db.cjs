#!/usr/bin/env node
/* eslint-disable no-console */

const { MongoClient } = require('mongodb');

function printUsage() {
  console.log(`
Usage:
  node scripts/mongo-copy-db.cjs \\
    --from-uri mongodb://localhost:27017 \\
    --from-db hermit-home-local \\
    --to-uri mongodb+srv://<user>:<pass>@cluster.mongodb.net/?retryWrites=true&w=majority \\
    --to-db hermit-home-prod \\
    [--drop-target true] \\
    [--collections users,telemetry,device_states] \\
    [--batch-size 500]
`);
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    i += 1;
  }
  return result;
}

function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'n'].includes(normalized)) {
    return false;
  }
  throw new Error(`Invalid boolean value: ${value}`);
}

function parseNumber(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid number value: ${value}`);
  }
  return parsed;
}

async function copyCollection({ sourceDb, targetDb, collectionName, batchSize, dropTarget }) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  if (dropTarget) {
    try {
      await targetDb.dropCollection(collectionName);
      console.log(`  - Dropped target collection: ${collectionName}`);
    } catch (error) {
      if (error?.codeName !== 'NamespaceNotFound') {
        throw error;
      }
    }
  }

  const total = await sourceCollection.countDocuments();
  const cursor = sourceCollection.find({}, { batchSize });

  let copied = 0;
  let ops = [];

  for await (const doc of cursor) {
    ops.push({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    });

    if (ops.length >= batchSize) {
      await targetCollection.bulkWrite(ops, { ordered: false });
      copied += ops.length;
      ops = [];
    }
  }

  if (ops.length > 0) {
    await targetCollection.bulkWrite(ops, { ordered: false });
    copied += ops.length;
  }

  const indexes = await sourceCollection.indexes();
  for (const index of indexes) {
    if (index.name === '_id_') {
      continue;
    }

    const { key, v, ns, background, ...options } = index;
    try {
      await targetCollection.createIndex(key, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes('already exists')) {
        continue;
      }
      throw error;
    }
  }

  return { total, copied };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printUsage();
    return;
  }

  const fromUri = args['from-uri'] || process.env.MONGO_FROM_URI;
  const fromDb = args['from-db'] || process.env.MONGO_FROM_DB;
  const toUri = args['to-uri'] || process.env.MONGO_TO_URI;
  const toDb = args['to-db'] || process.env.MONGO_TO_DB;
  const dropTarget = parseBoolean(args['drop-target'], false);
  const batchSize = parseNumber(args['batch-size'], 500);
  const collectionListRaw = args.collections || process.env.MONGO_COLLECTIONS || '';

  if (!fromUri || !fromDb || !toUri || !toDb) {
    printUsage();
    throw new Error('Missing required args: --from-uri, --from-db, --to-uri, --to-db');
  }

  const selectedCollections = collectionListRaw
    ? new Set(
        String(collectionListRaw)
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      )
    : null;

  const sourceClient = new MongoClient(fromUri);
  const targetClient = new MongoClient(toUri);

  const startedAt = Date.now();

  try {
    console.log(`[mongo-copy-db] Connecting source: ${fromUri}`);
    await sourceClient.connect();
    console.log(`[mongo-copy-db] Connecting target: ${toUri}`);
    await targetClient.connect();

    const sourceDb = sourceClient.db(fromDb);
    const targetDb = targetClient.db(toDb);

    const allCollections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    const collections = allCollections
      .map((item) => item.name)
      .filter((name) => !name.startsWith('system.'))
      .filter((name) => !selectedCollections || selectedCollections.has(name));

    if (collections.length === 0) {
      throw new Error('No collections found to copy.');
    }

    console.log(
      `[mongo-copy-db] Copy ${collections.length} collection(s) from ${fromDb} -> ${toDb} (dropTarget=${dropTarget})`,
    );

    let totalDocs = 0;
    let copiedDocs = 0;

    for (const collectionName of collections) {
      console.log(`\n[mongo-copy-db] Collection: ${collectionName}`);
      const result = await copyCollection({
        sourceDb,
        targetDb,
        collectionName,
        batchSize,
        dropTarget,
      });
      totalDocs += result.total;
      copiedDocs += result.copied;
      console.log(`  - Source docs: ${result.total}`);
      console.log(`  - Copied docs: ${result.copied}`);
    }

    const elapsedMs = Date.now() - startedAt;
    console.log('\n[mongo-copy-db] DONE');
    console.log(
      JSON.stringify(
        {
          fromDb,
          toDb,
          collections: collections.length,
          totalDocs,
          copiedDocs,
          elapsedMs,
        },
        null,
        2,
      ),
    );
  } finally {
    await sourceClient.close();
    await targetClient.close();
  }
}

main().catch((error) => {
  console.error('\n[mongo-copy-db] FAIL');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

