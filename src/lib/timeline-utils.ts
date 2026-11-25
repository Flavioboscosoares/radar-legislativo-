import { BRAZIL_UFS } from '@/data/brazil-ufs';
import type { MetricMode, ProjetoLei, TipoFilter, UfAggregate } from '@/lib/camara/types';

const MONTHS_SHORT_PT = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

export function getBrasiliaDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

export function getBrasiliaTimeLabel(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(utc.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Gera todas as datas ("YYYY-MM-DD") de 1º de janeiro até 31 de dezembro do ano,
 * ou até a data limite informada (para o ano corrente).
 */
export function buildYearCalendar(year: number, maxDateKey?: string): string[] {
  const startKey = `${year}-01-01`;
  const yearEndKey = `${year}-12-31`;
  const endKey = maxDateKey && maxDateKey < yearEndKey && maxDateKey >= startKey ? maxDateKey : yearEndKey;

  const days: string[] = [];
  let cursor = startKey;
  while (cursor <= endKey) {
    days.push(cursor);
    cursor = shiftDateKey(cursor, 1);
  }
  return days;
}

/**
 * Busca binária: retorna o maior índice `i` tal que `projects[i].dateKey <= targetDateKey`,
 * ou `-1` se nenhum projeto foi apresentado até `targetDateKey`.
 */
export function findLastIndexAtOrBeforeDate(
  projects: readonly ProjetoLei[],
  targetDateKey: string,
): number {
  let low = 0;
  let high = projects.length - 1;
  let answer = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (projects[mid].dateKey <= targetDateKey) {
      answer = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

export interface SnapshotStats {
  total: number;
  totalPL: number;
  totalPLP: number;
  byUf: Record<string, UfAggregate>;
  ranking: UfAggregate[];
  leaderUf: UfAggregate | null;
  maxMetricValue: number;
}

export function computeSnapshotStats(
  projects: readonly ProjetoLei[],
  endIndex: number,
  tipoFilter: TipoFilter,
  metricMode: MetricMode = 'ABSOLUTE',
): SnapshotStats {
  const byUf: Record<string, UfAggregate> = {};
  for (const meta of BRAZIL_UFS) {
    byUf[meta.sigla] = {
      uf: meta.sigla,
      total: 0,
      pl: 0,
      plp: 0,
      perDeputy: 0,
      cadeiras: meta.cadeiras,
    };
  }

  let totalPL = 0;
  let totalPLP = 0;
  const upperBound = Math.min(endIndex, projects.length - 1);

  for (let i = 0; i <= upperBound; i++) {
    const p = projects[i];
    if (tipoFilter !== 'ALL' && p.tipo !== tipoFilter) continue;

    const bucket = byUf[p.uf];
    if (!bucket) continue;

    bucket.total++;
    if (p.tipo === 'PL') {
      bucket.pl++;
      totalPL++;
    } else {
      bucket.plp++;
      totalPLP++;
    }
  }

  const ranking = Object.values(byUf).map((item) => ({
    ...item,
    perDeputy: item.cadeiras > 0 ? item.total / item.cadeiras : 0,
  }));

  for (const item of ranking) {
    byUf[item.uf] = item;
  }

  ranking.sort((a, b) => {
    const valA = metricMode === 'PER_DEPUTY' ? a.perDeputy : a.total;
    const valB = metricMode === 'PER_DEPUTY' ? b.perDeputy : b.total;
    if (valB !== valA) return valB - valA;
    if (b.total !== a.total) return b.total - a.total;
    return a.uf.localeCompare(b.uf);
  });

  const leaderUf = ranking[0] && ranking[0].total > 0 ? ranking[0] : null;
  const maxMetricValue =
    ranking.length > 0
      ? metricMode === 'PER_DEPUTY'
        ? ranking[0].perDeputy
        : ranking[0].total
      : 0;

  return {
    total: totalPL + totalPLP,
    totalPL,
    totalPLP,
    byUf,
    ranking,
    leaderUf,
    maxMetricValue,
  };
}

export function formatDateHud(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  const monthIdx = Number(m) - 1;
  const monthLabel = MONTHS_SHORT_PT[monthIdx] ?? m;
  return `${d} ${monthLabel} ${y}`;
}

export function formatDateTimeBr(dataApresentacao: string): string {
  if (!dataApresentacao || dataApresentacao.length < 10) return '';
  const [datePart, timePart] = dataApresentacao.split('T');
  const [y, m, d] = datePart.split('-');
  if (timePart && timePart.length >= 5) {
    return `${d}/${m}/${y} ${timePart.slice(0, 5)}`;
  }
  return `${d}/${m}/${y}`;
}
