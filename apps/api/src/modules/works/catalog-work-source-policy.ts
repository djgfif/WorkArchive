import { CatalogWorkSource } from '@prisma/client';

export function canMutateCatalogWorkForUserRecord(record: {
  catalogWork: {
    source: CatalogWorkSource;
  };
  catalogWorkId: string;
  id: string;
}) {
  return (
    record.catalogWorkId === record.id &&
    (record.catalogWork.source === CatalogWorkSource.legacy_flat ||
      record.catalogWork.source === CatalogWorkSource.catalog_title_snapshot)
  );
}
