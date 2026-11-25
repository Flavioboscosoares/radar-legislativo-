import { NextRequest, NextResponse } from 'next/server';
import { getLivePropositions } from '@/lib/camara/fetcher';
import { getBrasiliaDateKey, shiftDateKey } from '@/lib/timeline-utils';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sinceParam = request.nextUrl.searchParams.get('since') ?? undefined;
  const fallbackSince = shiftDateKey(getBrasiliaDateKey(), -3);
  const since =
    sinceParam && /^\d{4}-\d{2}-\d{2}$/.test(sinceParam) ? sinceParam : fallbackSince;

  try {
    const projects = await getLivePropositions(since);
    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        since,
        projects,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=45, stale-while-revalidate=60',
        },
      },
    );
  } catch (error) {
    console.error('[api/proposicoes/live] Erro ao consultar modo Ao Vivo:', error);
    return NextResponse.json(
      {
        error: 'Falha ao consultar proposições recentes na API da Câmara.',
      },
      { status: 502 },
    );
  }
}
