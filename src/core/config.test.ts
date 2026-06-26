import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { getGatherer, dataDir } from './config.js';
import { WebGatherer } from './search/web.js';
import * as core from './index.js';

describe('getGatherer', () => {
  it('defaults to (and explicitly selects) the DuckDuckGo web gatherer', () => {
    expect(getGatherer({})).toBeInstanceOf(WebGatherer);
    expect(getGatherer({ SEARCH_PROVIDER: 'duckduckgo' })).toBeInstanceOf(WebGatherer);
  });

  it('honors SEARCH_PROVIDER=none (the NullGatherer) case-insensitively and trimmed', () => {
    for (const v of ['none', 'NONE', 'None', 'none ', ' none', '  none  ', 'NONE\n']) {
      expect(getGatherer({ SEARCH_PROVIDER: v }), v).not.toBeInstanceOf(WebGatherer);
    }
  });

  it('the none gatherer returns no hits and refuses to fetch', async () => {
    const g = getGatherer({ SEARCH_PROVIDER: 'none' });
    expect(await g.search('anything')).toEqual([]);
    await expect(g.fetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/disabled/i);
  });
});

describe('dataDir', () => {
  it('uses OPENDOSSIER_DATA_DIR when set, else <cwd>/data', () => {
    expect(dataDir({ OPENDOSSIER_DATA_DIR: '/custom/x' })).toBe('/custom/x');
    expect(dataDir({})).toBe(join(process.cwd(), 'data'));
    expect(dataDir({ OPENDOSSIER_DATA_DIR: '' })).toBe(join(process.cwd(), 'data')); // empty → default
  });
});

describe('core barrel (index.ts)', () => {
  it('re-exports the public surface and keeps NullGatherer private', () => {
    for (const name of [
      'getGatherer',
      'dataDir',
      'WebGatherer',
      'Corpus',
      'researchCompany',
      'slugify',
      'getProvider',
      'parseProfile',
      'HeuristicProvider',
    ]) {
      expect(typeof (core as Record<string, unknown>)[name], name).toBe('function');
    }
    expect((core as Record<string, unknown>).NullGatherer).toBeUndefined();
  });
});
