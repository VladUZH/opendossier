import { join } from 'node:path';
import { WebGatherer } from './search/web.js';
import type { SourceGatherer, SearchHit, FetchedPage } from './search/types.js';

/** Root directory of the dossier corpus (contains `companies/`). */
export function dataDir(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENDOSSIER_DATA_DIR || join(process.cwd(), 'data');
}

/** A gatherer that finds nothing — used when SEARCH_PROVIDER=none. */
class NullGatherer implements SourceGatherer {
  async search(): Promise<SearchHit[]> {
    return [];
  }
  async fetch(url: string): Promise<FetchedPage> {
    throw new Error(`web fetching is disabled (SEARCH_PROVIDER=none); cannot fetch ${url}`);
  }
}

export function getGatherer(env: NodeJS.ProcessEnv = process.env): SourceGatherer {
  if ((env.SEARCH_PROVIDER || 'duckduckgo').toLowerCase() === 'none') return new NullGatherer();
  return new WebGatherer();
}
