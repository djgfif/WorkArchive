export { CatalogModule } from './catalog.module';
export { CatalogService } from './catalog.service';
export { CatalogIngestionService } from './catalog-ingestion.service';
export {
  hasCatalogReleaseIdentity,
  normalizeCatalogExternalRef,
  normalizeCatalogReleaseCandidate,
  type CatalogExternalRefInput,
  type CatalogReleaseCandidateInput,
  type NormalizedExternalRef,
  type NormalizedReleaseCandidate,
} from './catalog-ingestion-normalization';
export {
  getCatalogVerificationScore,
  hasMatchingCatalogTitleName,
  normalizeForCatalogMatch,
  pickBestCatalogTitleMatch,
  type CatalogTitleMatchCandidate,
  type CatalogTitleMatchContributor,
  type ContributorMatchInput,
} from './catalog-title-matching';
export {
  buildCatalogReleaseCreateData,
  buildCatalogReleaseUpdateData,
  buildCatalogTitleUpdateData,
  toCatalogMatchView,
  type CatalogMatchView,
  type CatalogMatchViewSource,
  type CatalogTitleUpdateSource,
} from './catalog-ingestion-payloads';
export {
  assertCatalogModerationAccess,
  assertPendingCatalogSubmission,
  buildCatalogSubmissionCreateData,
  buildCatalogSubmissionListArgs,
  buildUserCatalogSubmissionListArgs,
  type CatalogSubmissionInput,
} from './catalog-submissions';
export {
  buildLegacyCatalogTitleUpsertData,
  normalizeCatalogWorkGenres,
  type CreateTitleFromLegacyWorkInput,
} from './catalog-legacy-work';
