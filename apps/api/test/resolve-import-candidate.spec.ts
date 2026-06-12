import { BadRequestException } from '@nestjs/common';
import { WorkType } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';

import { buildResolvedImportCandidate } from '../src/modules/imports/resolve-import-candidate';

describe('buildResolvedImportCandidate', () => {
  it('normalizes import candidate resolve payloads for preview', () => {
    const candidate = buildResolvedImportCandidate({
      externalId: '  dune-1  ',
      externalRefs: [
        {
          externalId: '  dune-1 ',
          provider: ' google_books ',
          rawType: ' volume ',
          url: ' https://books.example/dune ',
        },
      ],
      mediumType: WorkType.novel,
      releaseCandidates: [
        {
          displayLabel: ' 1권 ',
          externalRefs: [
            {
              externalId: '  rel-1 ',
              provider: ' google_books ',
            },
          ],
          isbn: ' 9780000000001 ',
          releaseDate: ' 1965-08-01 ',
          releaseType: ' volume ',
          sequence: 1,
          thumbnailUrl: ' https://books.example/dune.jpg ',
          title: ' Dune ',
        },
      ],
      scoreBreakdown: [{ label: 'title', weight: 0.7 }],
      sourceId: ' google_books ',
      title: ' <b>Dune</b> ',
      titleAliases: ['Dune', ' Dune '],
    });

    expect(candidate).toEqual(
      expect.objectContaining({
        externalId: 'dune-1',
        mediumType: WorkType.novel,
        sourceId: 'google_books',
        title: 'Dune',
        titleAliases: ['Dune'],
        type: WorkType.novel,
      }),
    );
    expect(candidate.externalRefs).toEqual([
      {
        externalId: 'dune-1',
        provider: 'google_books',
        rawType: 'volume',
        url: 'https://books.example/dune',
      },
    ]);
    expect(candidate.releaseCandidates).toEqual([
      expect.objectContaining({
        displayLabel: '1권',
        isbn: '9780000000001',
        releaseDate: '1965-08-01',
        releaseType: 'volume',
        sequence: 1,
        title: 'Dune',
      }),
    ]);
    expect(candidate.scoreBreakdown).toEqual([
      {
        label: 'title',
        weight: 0.7,
      },
    ]);
  });

  it('rejects invalid resolve payloads', () => {
    expect(() => buildResolvedImportCandidate(null)).toThrow(
      BadRequestException,
    );
    expect(() =>
      buildResolvedImportCandidate({
        mediumType: WorkType.novel,
        title: '   ',
      }),
    ).toThrow('Import candidate title is required.');
    expect(() =>
      buildResolvedImportCandidate({
        title: 'Dune',
      }),
    ).toThrow('Import candidate type is required.');
  });
});
