import { Injectable } from '@nestjs/common';

export interface ImportCandidate {
  externalId: string;
  source: string;
  title: string;
  type: string;
}

export interface ImportSourceAdapter {
  readonly source: string;
  search(query: string): Promise<ImportCandidate[]>;
}

@Injectable()
export class ImportsService {
  private readonly adapters = new Map<string, ImportSourceAdapter>();

  registerAdapter(adapter: ImportSourceAdapter) {
    this.adapters.set(adapter.source, adapter);
  }

  listRegisteredSources() {
    return [...this.adapters.keys()];
  }

  async search(query: string) {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return [];
    }

    const results = await Promise.all(
      [...this.adapters.values()].map((adapter) => adapter.search(normalizedQuery)),
    );

    return results.flat();
  }
}
