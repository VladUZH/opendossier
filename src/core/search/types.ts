import type { SourceKind } from '../schema/profile.js';

export interface SearchHit {
  url: string;
  title: string;
  snippet: string;
}

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
  kind: SourceKind;
}

/** Gathers raw web evidence. The pipeline depends only on this interface, so the
 *  transport (DuckDuckGo, Wikipedia, a fixture in tests) is fully swappable. */
export interface SourceGatherer {
  search(query: string): Promise<SearchHit[]>;
  fetch(url: string): Promise<FetchedPage>;
}
