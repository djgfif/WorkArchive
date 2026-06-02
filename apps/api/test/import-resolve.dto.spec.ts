import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from '@jest/globals';
import { WorkType } from '@prisma/client';

import {
  IMPORT_RESOLVE_ARRAY_MAX_SIZE,
  IMPORT_RESOLVE_TEXT_MAX_LENGTH,
  IMPORT_RESOLVE_TITLE_MAX_LENGTH,
  IMPORT_RESOLVE_URL_MAX_LENGTH,
  ResolveImportCandidateDto,
} from '../src/modules/imports/dto/resolve-import-candidate.dto';

describe('resolve import candidate DTO', () => {
  it('accepts bounded candidate resolve payloads', async () => {
    const dto = plainToInstance(ResolveImportCandidateDto, {
      confidence: 0.86,
      contributors: [
        {
          name: 'Frank Herbert',
          role: 'author',
        },
      ],
      externalId: 'volume-1',
      externalRefs: [
        {
          externalId: 'volume-1',
          provider: 'google_books',
          rawType: 'volume',
          url: 'https://books.example/dune',
        },
      ],
      mediumType: WorkType.novel,
      releaseCandidates: [
        {
          externalRefs: [
            {
              externalId: '9780441172719',
              provider: 'isbn',
              rawType: 'isbn13',
            },
          ],
          isbn: '9780441172719',
          releaseDate: '1965-08-01',
          title: 'Dune',
        },
      ],
      releaseYear: 1965,
      sourceId: 'google_books',
      title: 'Dune',
      titleAliases: ['Dune Messiah'],
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects missing titles and oversized arrays at the API boundary', async () => {
    const missingTitle = plainToInstance(ResolveImportCandidateDto, {
      mediumType: WorkType.novel,
    });
    const oversizedAliases = plainToInstance(ResolveImportCandidateDto, {
      mediumType: WorkType.novel,
      title: 'Dune',
      titleAliases: Array.from(
        { length: IMPORT_RESOLVE_ARRAY_MAX_SIZE + 1 },
        (_value, index) => `alias-${index}`,
      ),
    });

    await expect(validate(missingTitle)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'title',
        }),
      ]),
    );
    await expect(validate(oversizedAliases)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'titleAliases',
        }),
      ]),
    );
  });

  it('rejects oversized nested strings before service normalization', async () => {
    const dto = plainToInstance(ResolveImportCandidateDto, {
      description: 'd'.repeat(IMPORT_RESOLVE_TEXT_MAX_LENGTH + 1),
      externalRefs: [
        {
          externalId: 'volume-1',
          provider: 'google_books',
          url: 'https://books.example/'.padEnd(
            IMPORT_RESOLVE_URL_MAX_LENGTH + 1,
            'a',
          ),
        },
      ],
      mediumType: WorkType.novel,
      title: 'D'.repeat(IMPORT_RESOLVE_TITLE_MAX_LENGTH + 1),
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'description',
        }),
        expect.objectContaining({
          property: 'title',
        }),
        expect.objectContaining({
          property: 'externalRefs',
        }),
      ]),
    );
  });

  it('strips response-only decoration fields with the global validation settings', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
    });

    const transformed = (await pipe.transform(
      {
        catalogMatch: {
          id: 'catalog-1',
          title: 'Dune',
          verificationStatus: 'verified',
        },
        existingRecord: {
          id: 'record-1',
          status: 'planned',
        },
        mediumType: WorkType.novel,
        sourceCoverage: {
          externalIdentityCount: 99,
          providerCount: 99,
          providers: ['forged'],
          releaseCandidateCount: 99,
        },
        title: 'Dune',
      },
      {
        metatype: ResolveImportCandidateDto,
        type: 'body',
      },
    )) as ResolveImportCandidateDto & {
      catalogMatch?: unknown;
      existingRecord?: unknown;
      sourceCoverage?: unknown;
    };

    expect(transformed).toBeInstanceOf(ResolveImportCandidateDto);
    expect(transformed.catalogMatch).toBeUndefined();
    expect(transformed.existingRecord).toBeUndefined();
    expect(transformed.sourceCoverage).toBeUndefined();
  });

  it('returns a bad request for malformed nested payloads through ValidationPipe', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
    });

    await expect(
      pipe.transform(
        {
          externalRefs: [
            {
              externalId: 'volume-1',
            },
          ],
          mediumType: WorkType.novel,
          title: 'Dune',
        },
        {
          metatype: ResolveImportCandidateDto,
          type: 'body',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
