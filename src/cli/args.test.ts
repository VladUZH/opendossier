import { describe, it, expect } from 'vitest';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('joins positional tokens into the company name and collects flags', () => {
    const { name, flags } = parseArgs(['Acme', 'Corp', '--save']);
    expect(name).toBe('Acme Corp');
    expect(flags.has('--save')).toBe(true);
    expect(flags.has('--json')).toBe(false);
  });

  it('drops a leading "research" subcommand only when a name follows it', () => {
    expect(parseArgs(['research', 'Acme']).name).toBe('Acme');
    expect(parseArgs(['research']).name).toBe('research'); // a company literally named "research"
  });

  it('parses order-independently with respect to flags', () => {
    expect(parseArgs(['research', '--json']).name).toBe(parseArgs(['--json', 'research']).name);
  });

  it('keeps single-dash tokens as part of the name (only -- are flags)', () => {
    expect(parseArgs(['-json', 'Acme']).name).toBe('-json Acme');
  });

  it('treats an unknown --flag as an (ignored) flag, never part of the name', () => {
    const { name, flags } = parseArgs(['Acme', '--svae']);
    expect(name).toBe('Acme');
    expect(flags.has('--save')).toBe(false);
    expect(flags.has('--svae')).toBe(true);
  });

  it('returns an empty name when no positional is given', () => {
    expect(parseArgs(['--json']).name).toBe('');
    expect(parseArgs([]).name).toBe('');
  });
});
