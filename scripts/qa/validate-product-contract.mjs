#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

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

function requirePattern(path, content, pattern, message) {
  if (!pattern.test(content)) failures.push(`${path}: ${message}`);
}

function walkMarkdown(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) return walkMarkdown(fullPath);
    return fullPath.endsWith('.md') ? [fullPath] : [];
  });
}

const constitutionPath = 'docs/product/PRODUCT_CONSTITUTION.md';
const archiveLockPath = 'docs/archive/product/PRODUCT_DIRECTION_LOCK.md';
const experiencePath = 'docs/design/PRODUCT_EXPERIENCE_DIRECTION.md';
const roadmapPath = 'docs/project/EXECUTION_ROADMAP.md';
const alphaPath = 'docs/project/COMMUNITY_ALPHA_PLAN.md';
const currentStatusPath =
  'docs/project/CURRENT_STATUS_AND_FUTURE_PLAN_REPORT.md';
const matrixPath = 'docs/management/DOCUMENT_STATUS_MATRIX.md';
const governancePath = 'docs/management/DOCUMENTATION_GOVERNANCE.md';
const gatesPath = 'scripts/qa/commercial-repo-gates.sh';
const packagePath = 'package.json';
const sharedTypesPath = 'packages/shared-types/src/index.ts';
const webProfilePath =
  'apps/web/src/shared/runtime/product-release-profile.ts';
const apiProfilePath = 'apps/api/src/config/product-release-profile.ts';
const webEntrypointPath = 'apps/web/docker-entrypoint.d/40-work-archive-config.sh';
const webIndexPath = 'apps/web/index.html';
const webViteConfigPath = 'apps/web/vite.config.ts';
const webRoutesPath = 'apps/web/src/app/router/routes.tsx';
const apiPolicyPath =
  'apps/api/src/modules/community/community-release-policy.ts';
const socialControllerPath =
  'apps/api/src/modules/community/community.controller.ts';
const reflectionControllerPath =
  'apps/api/src/modules/community/community-reflection.controller.ts';
const communityServicePath =
  'apps/api/src/modules/community/community.service.ts';
const prismaSchemaPath = 'apps/api/prisma/schema.prisma';
const surfaceMigrationPath =
  'apps/api/prisma/migrations/20260826210000_community_release_surface/migration.sql';
const composePath = 'compose.yml';
const productionComposePath = 'compose.prod.yml';


const constitution = readRequired(constitutionPath);
const archiveLock = readRequired(archiveLockPath);
const experience = readRequired(experiencePath);
const roadmap = readRequired(roadmapPath);
const alpha = readRequired(alphaPath);
const currentStatus = readRequired(currentStatusPath);
const matrix = readRequired(matrixPath);
const governance = readRequired(governancePath);
const gates = readRequired(gatesPath);
const packageJson = readRequired(packagePath);
const sharedTypes = readRequired(sharedTypesPath);
const webProfile = readRequired(webProfilePath);
const apiProfile = readRequired(apiProfilePath);
const webEntrypoint = readRequired(webEntrypointPath);
const webIndex = readRequired(webIndexPath);
const webViteConfig = readRequired(webViteConfigPath);
const webRoutes = readRequired(webRoutesPath);
const apiPolicy = readRequired(apiPolicyPath);
const socialController = readRequired(socialControllerPath);
const reflectionController = readRequired(reflectionControllerPath);
const communityService = readRequired(communityServicePath);
const prismaSchema = readRequired(prismaSchemaPath);
const surfaceMigration = readRequired(surfaceMigrationPath);
const compose = readRequired(composePath);
const productionCompose = readRequired(productionComposePath);

requirePattern(
  constitutionPath,
  constitution,
  /\| Status\s+\| `canonical`\s+\|/,
  'must be canonical.',
);
requirePattern(
  constitutionPath,
  constitution,
  /sole product-direction authority/,
  'must declare sole product-direction authority.',
);
requirePattern(
  constitutionPath,
  constitution,
  /revocable, not fully recoverable/,
  'must state the honest publication revocation limit.',
);
requirePattern(
  archiveLockPath,
  archiveLock,
  /\| Status\s+\| `archived`\s+\|/,
  'retired lock must be archived.',
);
requirePattern(
  archiveLockPath,
  archiveLock,
  /PRODUCT_CONSTITUTION\.md/,
  'retired lock must point to the active constitution.',
);
requirePattern(
  experiencePath,
  experience,
  /\| Status\s+\| `active`\s+\|/,
  'experience direction must be subordinate active guidance.',
);
requirePattern(
  experiencePath,
  experience,
  /PRODUCT_CONSTITUTION\.md/,
  'experience direction must cite the constitution.',
);
requirePattern(
  roadmapPath,
  roadmap,
  /\.\.\/product\/PRODUCT_CONSTITUTION\.md/,
  'roadmap must cite the constitution.',
);
requirePattern(
  roadmapPath,
  roadmap,
  /production blocked/,
  'roadmap must preserve the social expansion release block.',
);
requirePattern(
  alphaPath,
  alpha,
  /production blocked/,
  'Community alpha must remain production blocked.',
);
requirePattern(
  alphaPath,
  alpha,
  /boards,[\s\S]{0,180}public\s+profiles,[\s\S]{0,180}comments,[\s\S]{0,180}follows,[\s\S]{0,180}taste\/trending/,
  'Community alpha must name non-approved expansion surfaces.',
);
if (roadmap.includes('public/community 기능은 현재 roadmap에서 제거한다')) {
  failures.push(
    `${roadmapPath}: stale blanket Community removal rule must not return.`,
  );
}
requirePattern(
  currentStatusPath,
  currentStatus,
  /\/community\/boards[\s\S]{0,220}\/community\/taste[\s\S]{0,220}\/u\/:handle/,
  'current reality must record the implemented social expansion routes.',
);
requirePattern(
  currentStatusPath,
  currentStatus,
  /boards, public profiles, comments, follows, taste\/trending[^\n]*production blocked/,
  'current reality must separate implemented social expansion from approval.',
);
requirePattern(
  matrixPath,
  matrix,
  /product\/PRODUCT_CONSTITUTION\.md[^\n]*`canonical`/,
  'status matrix must list the constitution as canonical.',
);
requirePattern(
  matrixPath,
  matrix,
  /design\/PRODUCT_EXPERIENCE_DIRECTION\.md[^\n]*`active`/,
  'status matrix must demote experience direction to active.',
);
requirePattern(
  governancePath,
  governance,
  /archive[^\n]*source of truth/,
  'governance must forbid archive source-of-truth authority.',
);
requirePattern(
  governancePath,
  governance,
  /제품 방향[^\n]*하나/,
  'governance must require one product-direction authority.',
);
requirePattern(
  gatesPath,
  gates,
  /npm run qa:product-contract/,
  'commercial repository gates must run the product contract check.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:product-contract":\s*"node scripts\/qa\/validate-product-contract\.mjs"/,
  'package.json must expose qa:product-contract.',
);
requirePattern(
  constitutionPath,
  constitution,
  /personal-archive[\s\S]{0,500}community-reflection-alpha[\s\S]{0,500}community-social-experiment/,
  'must define the exact runtime release profile identifiers.',
);
requirePattern(
  constitutionPath,
  constitution,
  /CommunityPost\.surface[\s\S]{0,180}board/,
  'must record the reflection versus board storage boundary.',
);
requirePattern(
  sharedTypesPath,
  sharedTypes,
  /PRODUCT_RELEASE_PROFILES[\s\S]{0,240}'personal-archive'[\s\S]{0,240}'community-reflection-alpha'[\s\S]{0,240}'community-social-experiment'/,
  'shared types must define the three release profiles.',
);
requirePattern(
  sharedTypesPath,
  sharedTypes,
  /'community-reflection-alpha':[\s\S]{0,180}communityReflection: true,[\s\S]{0,100}communitySocial: false/,
  'reflection alpha must not inherit social capability.',
);
requirePattern(
  webProfilePath,
  webProfile,
  /DEFAULT_PRODUCT_RELEASE_PROFILE[\s\S]{0,100}'personal-archive'/,
  'web profile resolution must fail closed to personal archive.',
);
requirePattern(
  webIndexPath,
  webIndex,
  /<script src="\/work-archive-config\.js"><\/script>[\s\S]{0,160}<script type="module" src="\/src\/main\.tsx"><\/script>/,
  'runtime release config must load before the application module.',
);
requirePattern(
  webViteConfigPath,
  webViteConfig,
  /globIgnores:\s*\['\*\*\/work-archive-config\.js'\][\s\S]{0,300}url\.pathname === '\/work-archive-config\.js'[\s\S]{0,100}handler: 'NetworkOnly'/,
  'runtime release config must bypass PWA precache and runtime caches.',
);
requirePattern(
  webRoutesPath,
  webRoutes,
  /reflectionEnabled[\s\S]{0,200}socialEnabled[\s\S]{0,300}communityRoutes/,
  'web Community routes must be capability-gated.',
);
requirePattern(
  apiProfilePath,
  apiProfile,
  /DEFAULT_PRODUCT_RELEASE_PROFILE[\s\S]{0,100}'personal-archive'/,
  'API profile resolution must fail closed to personal archive.',
);
requirePattern(
  webEntrypointPath,
  webEntrypoint,
  /PRODUCT_RELEASE_PROFILE:-personal-archive[\s\S]{0,500}productReleaseProfile/,
  'web container must generate fail-closed runtime config.',
);
requirePattern(
  packagePath,
  packageJson,
  /"qa:product-release-runtime":\s*"node scripts\/qa\/validate-product-release-runtime\.mjs"/,
  'package.json must expose the runtime profile matrix check.',
);
requirePattern(
  socialControllerPath,
  socialController,
  /@RequireCommunityRelease\('social'\)[\s\S]{0,100}@UseGuards\(CommunityReleaseGuard\)/,
  'social controller must require the social release capability.',
);
requirePattern(
  reflectionControllerPath,
  reflectionController,
  /@Controller\('community\/reflections'\)[\s\S]{0,140}@RequireCommunityRelease\('reflection'\)/,
  'reflection controller must use a separate guarded API surface.',
);
requirePattern(
  communityServicePath,
  communityService,
  /listPosts\([\s\S]{0,260}surface: CommunityPostSurface[\s\S]{0,260}surface,/,
  'post lists must filter by surface.',
);
requirePattern(
  communityServicePath,
  communityService,
  /createPost\([\s\S]{0,300}surface: CommunityPostSurface[\s\S]{0,1500}surface,/,
  'post writes must persist an explicit surface.',
);
requirePattern(
  communityServicePath,
  communityService,
  /addReaction\([\s\S]{0,420}surface[\s\S]{0,900}removeReaction\([\s\S]{0,420}surface/,
  'post reactions must remain surface-scoped.',
);
requirePattern(
  communityServicePath,
  communityService,
  /reportPost\([\s\S]{0,360}surface[\s\S]{0,1800}postSurface/,
  'post reports must remain surface-scoped.',
);
requirePattern(
  prismaSchemaPath,
  prismaSchema,
  /enum CommunityPostSurface[\s\S]{0,100}reflection[\s\S]{0,100}board[\s\S]*surface\s+CommunityPostSurface\s+@default\(reflection\)/,
  'Prisma must distinguish reflection and board rows.',
);
requirePattern(
  surfaceMigrationPath,
  surfaceMigration,
  /ADD COLUMN "surface"[\s\S]{0,120}DEFAULT 'board'[\s\S]{0,160}SET DEFAULT 'reflection'/,
  'migration must classify existing rows as board before changing the default.',
);
for (const [path, content] of [
  [composePath, compose],
  [productionComposePath, productionCompose],
]) {
  requirePattern(
    path,
    content,
    /PRODUCT_RELEASE_PROFILE:[^\n]*personal-archive[\s\S]{0,6000}PRODUCT_RELEASE_PROFILE:[^\n]*personal-archive/,
    'Compose must pass one fail-closed runtime profile to API and web.',
  );
}


for (const fullPath of walkMarkdown(join(root, 'docs'))) {
  const path = relative(root, fullPath).replaceAll('\\\\', '/');
  if (path.startsWith('docs/archive/') || path === 'docs/product/README.md')
    continue;
  const content = readFileSync(fullPath, 'utf8');
  if (content.includes('archive/product/PRODUCT_DIRECTION_LOCK.md')) {
    failures.push(
      `${path} must not cite the archived product lock as current authority.`,
    );
  }
}

if (failures.length > 0) {
  console.error('Product contract validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Product contract passed.');
