import ResearchClient from './ResearchClient';

export const dynamic = 'force-dynamic';

export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <ResearchClient initialQuery={q ?? ''} />;
}
