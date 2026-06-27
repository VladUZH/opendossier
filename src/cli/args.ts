export interface ParsedArgs {
  name: string;
  flags: Set<string>;
}

/**
 * Parse CLI argv into a company name + flag set. Supports both invocation styles:
 *   opendossier research "Acme"   (global bin — `research` is a subcommand)
 *   npm run research -- "Acme"    (npm forwards only the name)
 * The leading `research` token is treated as a subcommand and dropped ONLY when another
 * positional follows it, so a company literally named "research" survives, and parsing is
 * order-independent w.r.t. flags.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  let positionals = argv.filter((a) => !a.startsWith('--'));
  if (positionals[0] === 'research' && positionals.length > 1) positionals = positionals.slice(1);
  return { name: positionals.join(' ').trim(), flags };
}
