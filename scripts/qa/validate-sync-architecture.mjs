#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function readRequired(path) {
  const fullPath = join(root, path);

  if (!existsSync(fullPath)) {
    failures.push(`${path} is missing.`);
    return '';
  }

  return readFileSync(fullPath, 'utf8');
}

function requireIncludes(path, content, needle) {
  if (!content.includes(needle)) {
    failures.push(`${path} must include "${needle}".`);
  }
}

function requireNotIncludes(path, content, needle) {
  if (content.includes(needle)) {
    failures.push(`${path} must not include "${needle}".`);
  }
}

function requireLineCountAtMost(path, content, maximum) {
  const lineCount = content.split('\n').length;

  if (lineCount > maximum) {
    failures.push(`${path} must stay at or below ${maximum} lines, found ${lineCount}.`);
  }
}

const syncServicePath = 'apps/api/src/modules/sync/sync.service.ts';
const syncPushServicePath =
  'apps/api/src/modules/sync/services/sync-push.service.ts';
const syncPullServicePath =
  'apps/api/src/modules/sync/services/sync-pull.service.ts';
const changeDispatcherPath =
  'apps/api/src/modules/sync/services/sync-push.change-dispatcher.ts';
const graphEntityEntrypointPath =
  'apps/api/src/modules/sync/services/sync-push.graph-entity-handler.ts';
const graphSeriesHandlerPath =
  'apps/api/src/modules/sync/services/sync-push.series-handler.ts';
const graphContributorHandlerPath =
  'apps/api/src/modules/sync/services/sync-push.contributor-handler.ts';
const tierBoardEntrypointPath =
  'apps/api/src/modules/sync/services/sync-push.tier-board-handler.ts';
const tierBoardRootHandlerPath =
  'apps/api/src/modules/sync/services/sync-push.tier-board-root-handler.ts';
const tierLaneHandlerPath =
  'apps/api/src/modules/sync/services/sync-push.tier-lane-handler.ts';
const tierBoardCardHandlerPath =
  'apps/api/src/modules/sync/services/sync-push.tier-board-card-handler.ts';
const tierBoardAssetHandlerPath =
  'apps/api/src/modules/sync/services/sync-push.tier-board-asset-handler.ts';
const tierBoardVersionGuardsPath =
  'apps/api/src/modules/sync/services/sync-push.tier-board-version-guards.ts';
const syncScalingPlanPath = 'docs/archive/backend/SYNC_SCALING_PLAN.md';
const commercialReadinessPath =
  'docs/commercial/COMMERCIAL_LAUNCH_READINESS.md';
const packagePath = 'package.json';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const localEvidencePath = 'scripts/qa/gate1-evidence-local.sh';

const syncService = readRequired(syncServicePath);
const syncPushService = readRequired(syncPushServicePath);
const syncPullService = readRequired(syncPullServicePath);
const changeDispatcher = readRequired(changeDispatcherPath);
const graphEntityEntrypoint = readRequired(graphEntityEntrypointPath);
const graphSeriesHandler = readRequired(graphSeriesHandlerPath);
const graphContributorHandler = readRequired(graphContributorHandlerPath);
const tierBoardEntrypoint = readRequired(tierBoardEntrypointPath);
const tierBoardRootHandler = readRequired(tierBoardRootHandlerPath);
const tierLaneHandler = readRequired(tierLaneHandlerPath);
const tierBoardCardHandler = readRequired(tierBoardCardHandlerPath);
const tierBoardAssetHandler = readRequired(tierBoardAssetHandlerPath);
const tierBoardVersionGuards = readRequired(tierBoardVersionGuardsPath);
const syncScalingPlan = readRequired(syncScalingPlanPath);
const commercialReadiness = readRequired(commercialReadinessPath);
const packageJson = readRequired(packagePath);
const gates = readRequired(gatesPath);
const localEvidence = readRequired(localEvidencePath);

requireLineCountAtMost(syncServicePath, syncService, 80);
for (const needle of [
  'private readonly pushService: SyncPushService',
  'private readonly pullService: SyncPullService',
  'return this.pushService.push(userId, pushSyncDto, requestId)',
  'return this.pullService.pull(userId, pullSyncDto, requestId)',
]) {
  requireIncludes(syncServicePath, syncService, needle);
}
for (const forbidden of ['PrismaService', '$transaction', '$queryRaw']) {
  requireNotIncludes(syncServicePath, syncService, forbidden);
}

for (const [path, content] of [
  [syncPushServicePath, syncPushService],
  [syncPullServicePath, syncPullService],
]) {
  requireIncludes(path, content, 'recordSync');
  requireIncludes(path, content, 'duration');
  requireIncludes(path, content, 'requestId');
}

requireIncludes(
  changeDispatcherPath,
  changeDispatcher,
  "} from './sync-push.tier-board-handler'",
);

requireLineCountAtMost(graphEntityEntrypointPath, graphEntityEntrypoint, 20);
for (const needle of [
  "export { applyContributorChange } from './sync-push.contributor-handler'",
  "export { applySeriesChange } from './sync-push.series-handler'",
]) {
  requireIncludes(graphEntityEntrypointPath, graphEntityEntrypoint, needle);
}
for (const forbidden of [
  'client.userContributor',
  'client.userSeries',
  'buildContributor',
  'buildSeries',
]) {
  requireNotIncludes(graphEntityEntrypointPath, graphEntityEntrypoint, forbidden);
}
for (const [path, content, maximum, needle] of [
  [graphSeriesHandlerPath, graphSeriesHandler, 150, 'applySeriesChange'],
  [
    graphContributorHandlerPath,
    graphContributorHandler,
    140,
    'applyContributorChange',
  ],
]) {
  requireLineCountAtMost(path, content, maximum);
  requireIncludes(path, content, needle);
  requireIncludes(path, content, 'buildGraphRemoteNewerConflict');
  requireIncludes(path, content, 'getMissingRemoteGraphResult');
}

requireLineCountAtMost(tierBoardEntrypointPath, tierBoardEntrypoint, 20);
for (const needle of [
  "export { applyTierBoardAssetChange } from './sync-push.tier-board-asset-handler'",
  "export { applyTierBoardCardChange } from './sync-push.tier-board-card-handler'",
  "export { applyTierBoardChange } from './sync-push.tier-board-root-handler'",
  "export { applyTierLaneChange } from './sync-push.tier-lane-handler'",
]) {
  requireIncludes(tierBoardEntrypointPath, tierBoardEntrypoint, needle);
}
for (const forbidden of ['client.userTier', 'buildTierBoard', 'validateTier']) {
  requireNotIncludes(tierBoardEntrypointPath, tierBoardEntrypoint, forbidden);
}

for (const [path, content, maximum] of [
  [tierBoardRootHandlerPath, tierBoardRootHandler, 140],
  [tierLaneHandlerPath, tierLaneHandler, 140],
  [tierBoardCardHandlerPath, tierBoardCardHandler, 150],
  [tierBoardAssetHandlerPath, tierBoardAssetHandler, 150],
]) {
  requireLineCountAtMost(path, content, maximum);
  requireIncludes(path, content, 'PushSyncResultDto');
}
requireLineCountAtMost(
  tierBoardVersionGuardsPath,
  tierBoardVersionGuards,
  190,
);
for (const [path, content, needle] of [
  [tierBoardRootHandlerPath, tierBoardRootHandler, 'applyTierBoardChange'],
  [tierLaneHandlerPath, tierLaneHandler, 'applyTierLaneChange'],
  [tierBoardCardHandlerPath, tierBoardCardHandler, 'applyTierBoardCardChange'],
  [tierBoardAssetHandlerPath, tierBoardAssetHandler, 'applyTierBoardAssetChange'],
]) {
  requireIncludes(path, content, needle);
  requireIncludes(path, content, 'buildTierBoardRemoteNewerConflict');
}
for (const needle of [
  'updateTierBoardWithVersionGuard',
  'updateTierLaneWithVersionGuard',
  'updateTierBoardCardWithVersionGuard',
  'updateTierBoardAssetWithVersionGuard',
]) {
  requireIncludes(tierBoardVersionGuardsPath, tierBoardVersionGuards, needle);
}

for (const [path, content] of [
  [syncScalingPlanPath, syncScalingPlan],
  [commercialReadinessPath, commercialReadiness],
]) {
  requireIncludes(path, content, 'qa:sync-architecture');
  requireIncludes(path, content, 'sync-push.tier-board-handler.ts');
  requireIncludes(path, content, 'sync-push.graph-entity-handler.ts');
}

requireIncludes(packagePath, packageJson, '"qa:sync-architecture"');
requireIncludes(gatesPath, gates, 'node --check scripts/qa/validate-sync-architecture.mjs');
requireIncludes(gatesPath, gates, 'npm run qa:sync-architecture');
requireIncludes(
  localEvidencePath,
  localEvidence,
  'node --check scripts/qa/validate-sync-architecture.mjs',
);
requireIncludes(localEvidencePath, localEvidence, 'npm run qa:sync-architecture');

if (failures.length > 0) {
  console.error('Sync architecture check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Sync architecture check passed.');
