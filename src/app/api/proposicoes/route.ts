import { NextRequest, NextResponse } from 'next/server';
import { getCurrentBrasiliaYear, getYearDataset, isSupportedYear } from '@/lib/camara/fetcher';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const yearParam = request.nextUrl.searchParams.get('year');
  const parsedYear = yearParam ? Number(yearParam) : getCurrentBrasiliaYear();

  if (!Number.isInteger(parsedYear) || !isSupportedYear(parsedYear)) {
    return NextResponse.json(
      { error: 'Ano inválido. Selecione entre 2023, 2024, 2025 ou 2026.' },
      { status: 400 },
    );
  }

  try {
    const dataset = await getYearDataset(parsedYear);
    const isCurrentYear = parsedYear >= getCurrentBrasiliaYear();
    const cacheHeader = isCurrentYear
      ? 'public, s-maxage=900, stale-while-revalidate=1800'
      : 'public, s-maxage=86400, stale-while-revalidate=604800';

    return NextResponse.json(dataset, {
      status: 200,
      headers: {
        'Cache-Control': cacheHeader,
      },
    });
  } catch (error) {
    console.error('[api/proposicoes] Erro ao buscar dataset anual:', error);
    return NextResponse.json(
      {
        error:
          'Não foi possível obter os dados da Câmara dos Deputados neste momento. Tente novamente em instantes.',
      },
      { status: 502 },
    );
  }
}
