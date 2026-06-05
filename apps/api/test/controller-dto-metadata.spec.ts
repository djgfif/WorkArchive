import 'reflect-metadata';

import { describe, expect, it } from '@jest/globals';

import { CatalogController } from '../src/modules/catalog/catalog.controller';
import { CatalogSearchQueryDto } from '../src/modules/catalog/dto/catalog-search-query.dto';
import {
  CreateCatalogSubmissionDto,
  MergeCatalogTitleDto,
  ReviewCatalogSubmissionDto,
} from '../src/modules/catalog/dto/catalog-submission.dto';
import { CatalogSubmissionsQueryDto } from '../src/modules/catalog/dto/catalog-submissions-query.dto';
import { ImportSearchQueryDto } from '../src/modules/imports/dto/import-search-query.dto';
import { ResolveImportCandidateDto } from '../src/modules/imports/dto/resolve-import-candidate.dto';
import { ImportsController } from '../src/modules/imports/imports.controller';
import { UserReleaseRecordsController } from '../src/modules/user-records/user-release-records.controller';
import { UserRecordsController } from '../src/modules/user-records/user-records.controller';
import {
  CreateUserRecordDto,
  CreateUserRecordFromImportDto,
  UpdateProgressDto,
  UpdateUserRecordDto,
} from '../src/modules/user-records/dto/user-record.dto';
import { UpsertUserReleaseRecordDto } from '../src/modules/user-records/dto/user-release-record.dto';
import { GroupedWorksQueryDto } from '../src/modules/works/dto/grouped-works-query.dto';
import { WorksController } from '../src/modules/works/works.controller';

interface ControllerConstructor {
  name: string;
  prototype: object;
}

interface DtoMetadataCase {
  controller: ControllerConstructor;
  methodName: string;
  parameterIndex: number;
  expectedType: unknown;
}

const dtoMetadataCases: DtoMetadataCase[] = [
  {
    controller: CatalogController,
    methodName: 'search',
    parameterIndex: 0,
    expectedType: CatalogSearchQueryDto,
  },
  {
    controller: CatalogController,
    methodName: 'submit',
    parameterIndex: 1,
    expectedType: CreateCatalogSubmissionDto,
  },
  {
    controller: CatalogController,
    methodName: 'listSubmissions',
    parameterIndex: 1,
    expectedType: CatalogSubmissionsQueryDto,
  },
  {
    controller: CatalogController,
    methodName: 'listMySubmissions',
    parameterIndex: 1,
    expectedType: CatalogSubmissionsQueryDto,
  },
  {
    controller: CatalogController,
    methodName: 'approveSubmission',
    parameterIndex: 2,
    expectedType: ReviewCatalogSubmissionDto,
  },
  {
    controller: CatalogController,
    methodName: 'rejectSubmission',
    parameterIndex: 2,
    expectedType: ReviewCatalogSubmissionDto,
  },
  {
    controller: CatalogController,
    methodName: 'mergeTitle',
    parameterIndex: 2,
    expectedType: MergeCatalogTitleDto,
  },
  {
    controller: UserRecordsController,
    methodName: 'findGrouped',
    parameterIndex: 1,
    expectedType: GroupedWorksQueryDto,
  },
  {
    controller: UserRecordsController,
    methodName: 'updateProgress',
    parameterIndex: 2,
    expectedType: UpdateProgressDto,
  },
  {
    controller: UserRecordsController,
    methodName: 'upsertReleaseRecord',
    parameterIndex: 3,
    expectedType: UpsertUserReleaseRecordDto,
  },
  {
    controller: UserRecordsController,
    methodName: 'create',
    parameterIndex: 1,
    expectedType: CreateUserRecordDto,
  },
  {
    controller: UserRecordsController,
    methodName: 'update',
    parameterIndex: 2,
    expectedType: UpdateUserRecordDto,
  },
  {
    controller: UserRecordsController,
    methodName: 'createFromImport',
    parameterIndex: 1,
    expectedType: CreateUserRecordFromImportDto,
  },
  {
    controller: UserReleaseRecordsController,
    methodName: 'update',
    parameterIndex: 2,
    expectedType: UpsertUserReleaseRecordDto,
  },
  {
    controller: WorksController,
    methodName: 'findGrouped',
    parameterIndex: 1,
    expectedType: GroupedWorksQueryDto,
  },
  {
    controller: ImportsController,
    methodName: 'saveAladinKey',
    parameterIndex: 1,
    expectedType: Object,
  },
  {
    controller: ImportsController,
    methodName: 'saveProviderKey',
    parameterIndex: 2,
    expectedType: Object,
  },
  {
    controller: ImportsController,
    methodName: 'search',
    parameterIndex: 1,
    expectedType: ImportSearchQueryDto,
  },
  {
    controller: ImportsController,
    methodName: 'resolve',
    parameterIndex: 1,
    expectedType: ResolveImportCandidateDto,
  },
];

describe('controller DTO metadata', () => {
  it.each(dtoMetadataCases)(
    'emits DTO metadata for $controller.name.$methodName parameter $parameterIndex',
    ({ controller, methodName, parameterIndex, expectedType }) => {
      const paramTypes = Reflect.getMetadata(
        'design:paramtypes',
        controller.prototype,
        methodName,
      ) as unknown[] | undefined;

      expect(paramTypes?.[parameterIndex]).toBe(expectedType);
    },
  );
});
