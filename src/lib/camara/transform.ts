import { VALID_UF_SET } from '@/data/brazil-ufs';
import type {
  DailyCount,
  ProjetoLei,
  RawBulkAutor,
  RawBulkProposicao,
  TipoProposicao,
  YearDataset,
} from './types';

export interface AuthorSortable {
  ordemAssinatura?: string | number;
  proponente?: string | number;
}

/**
 * Seleciona o 1º signatário (autor principal) ordenando pela menor ordemAssinatura
 * e desempatando por proponente === 1.
 */
export function pickPrimaryAuthor<T extends AuthorSortable>(authors: readonly T[]): T | null {
  if (!authors || authors.length === 0) return null;

  let best = authors[0];
  let bestOrder = normalizeOrder(best.ordemAssinatura);
  let bestProp = Number(best.proponente) === 1 ? 0 : 1;

  for (let i = 1; i < authors.length; i++) {
    const candidate = authors[i];
    const order = normalizeOrder(candidate.ordemAssinatura);
    const prop = Number(candidate.proponente) === 1 ? 0 : 1;

    if (order < bestOrder || (order === bestOrder && prop < bestProp)) {
      best = candidate;
      bestOrder = order;
      bestProp = prop;
    }
  }

  return best;
}

function normalizeOrder(value: string | number | undefined): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 9999;
}

/**
 * Extrai "YYYY-MM-DD" diretamente da string de dataApresentacao da Câmara
 * para evitar desvios de fuso horário ao converter via UTC.
 */
export function extractDateKey(dataApresentacao: string | undefined): string {
  if (!dataApresentacao || dataApresentacao.length < 10) return '';
  return dataApresentacao.slice(0, 10);
}

/**
 * Converte dataApresentacao ("YYYY-MM-DDTHH:mm" ou "YYYY-MM-DDTHH:mm:ss")
 * considerando o fuso oficial de Brasília (-03:00).
 */
export function parseBrasiliaTimestamp(dataApresentacao: string | undefined): number {
  if (!dataApresentacao) return 0;
  const trimmed = dataApresentacao.trim();
  if (!trimmed) return 0;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T00:00:00-03:00`);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  // Já possui offset explícito (Z ou ±HH:MM)
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}:00-03:00`
    : `${trimmed}-03:00`;

  const parsed = Date.parse(withSeconds);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function truncateEmenta(ementa: string | undefined, maxLen = 280): string {
  const clean = (ementa ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
}

export function normalizeUf(rawUf: string | undefined): string {
  return (rawUf ?? '').trim().toUpperCase();
}

export function isPlOrPlp(siglaTipo: string | undefined): siglaTipo is TipoProposicao {
  return siglaTipo === 'PL' || siglaTipo === 'PLP';
}

export function computeDailyCountsAndTotals(projects: readonly ProjetoLei[]): {
  totalProjects: number;
  totalPL: number;
  totalPLP: number;
  dailyCounts: Record<string, DailyCount>;
} {
  let totalPL = 0;
  let totalPLP = 0;
  const dailyCounts: Record<string, DailyCount> = {};

  for (const p of projects) {
    if (p.tipo === 'PL') {
      totalPL++;
    } else {
      totalPLP++;
    }

    let bucket = dailyCounts[p.dateKey];
    if (!bucket) {
      bucket = { pl: 0, plp: 0 };
      dailyCounts[p.dateKey] = bucket;
    }

    if (p.tipo === 'PL') {
      bucket.pl++;
    } else {
      bucket.plp++;
    }
  }

  return {
    totalProjects: projects.length,
    totalPL,
    totalPLP,
    dailyCounts,
  };
}

/**
 * Normaliza os arquivos brutos da Câmara para o dataset anual:
 * - Mantém apenas PL e PLP
 * - Filtra estritamente pela data de apresentação no ano alvo
 * - Atribui apenas ao 1º signatário
 * - Descarta projetos cujo 1º signatário não possui UF válida
 */
export function normalizeYearDataset(
  rawProps: readonly RawBulkProposicao[],
  rawAuthors: readonly RawBulkAutor[],
  year: number,
  sourceLastModified: string | null = null,
): YearDataset {
  const yearPrefix = `${year}-`;

  // Pré-indexa autores somente de proposições PL/PLP apresentadas no ano
  const eligiblePropIds = new Set<number>();
  for (const prop of rawProps) {
    if (!isPlOrPlp(prop.siglaTipo)) continue;
    const dateKey = extractDateKey(prop.dataApresentacao);
    if (!dateKey.startsWith(yearPrefix)) continue;
    eligiblePropIds.add(prop.id);
  }

  const authorsByProp = new Map<number, RawBulkAutor[]>();
  for (const author of rawAuthors) {
    if (!eligiblePropIds.has(author.idProposicao)) continue;
    let list = authorsByProp.get(author.idProposicao);
    if (!list) {
      list = [];
      authorsByProp.set(author.idProposicao, list);
    }
    list.push(author);
  }

  const projects: ProjetoLei[] = [];

  for (const prop of rawProps) {
    if (!isPlOrPlp(prop.siglaTipo)) continue;
    const dataApresentacao = prop.dataApresentacao ?? '';
    const dateKey = extractDateKey(dataApresentacao);
    if (!dateKey.startsWith(yearPrefix)) continue;

    const authors = authorsByProp.get(prop.id);
    if (!authors || authors.length === 0) continue;

    const primary = pickPrimaryAuthor(authors);
    if (!primary) continue;

    const uf = normalizeUf(primary.siglaUFAutor);
    if (!VALID_UF_SET.has(uf)) continue;

    projects.push({
      id: prop.id,
      tipo: prop.siglaTipo,
      numero: Number(prop.numero) || 0,
      ano: Number(prop.ano) || year,
      dataApresentacao,
      dateKey,
      timestamp: parseBrasiliaTimestamp(dataApresentacao),
      uf,
      autorNome: (primary.nomeAutor ?? 'Autor não informado').trim(),
      autorPartido: (primary.siglaPartidoAutor ?? '').trim(),
      ementa: truncateEmenta(prop.ementa),
    });
  }

  projects.sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);

  const summary = computeDailyCountsAndTotals(projects);

  return {
    year,
    generatedAt: new Date().toISOString(),
    sourceLastModified,
    ...summary,
    projects,
  };
}

/**
 * Mescla proposições recém-obtidas (ex: API REST do dia) no dataset anual,
 * deduplicando por ID e mantendo ordenação cronológica e contagens consistentes.
 */
export function mergeProjects(
  base: readonly ProjetoLei[],
  incoming: readonly ProjetoLei[],
  year: number,
): {
  projects: ProjetoLei[];
  totalProjects: number;
  totalPL: number;
  totalPLP: number;
  dailyCounts: Record<string, DailyCount>;
} {
  const yearPrefix = `${year}-`;
  const byId = new Map<number, ProjetoLei>();

  for (const p of base) {
    if (p.dateKey.startsWith(yearPrefix) && VALID_UF_SET.has(p.uf)) {
      byId.set(p.id, p);
    }
  }

  for (const p of incoming) {
    if (p.dateKey.startsWith(yearPrefix) && VALID_UF_SET.has(p.uf)) {
      byId.set(p.id, p);
    }
  }

  const projects = Array.from(byId.values()).sort(
    (a, b) => a.timestamp - b.timestamp || a.id - b.id,
  );

  return {
    projects,
    ...computeDailyCountsAndTotals(projects),
  };
}
