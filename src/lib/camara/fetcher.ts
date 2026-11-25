import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SUPPORTED_YEARS, VALID_UF_SET, type SupportedYear } from '@/data/brazil-ufs';
import { getBrasiliaDateKey, shiftDateKey } from '@/lib/timeline-utils';
import {
  extractDateKey,
  isPlOrPlp,
  mergeProjects,
  normalizeUf,
  normalizeYearDataset,
  parseBrasiliaTimestamp,
  pickPrimaryAuthor,
  truncateEmenta,
} from './transform';
import type {
  ProjetoLei,
  RawBulkAutor,
  RawBulkProposicao,
  RawRestAutor,
  YearDataset,
} from './types';

const CAMARA_BASE = 'https://dadosabertos.camara.leg.br';
const CACHE_DIR = path.join(os.tmpdir(), 'radar-legislativo-cache');

interface CachedEntry<T> {
  value: T;
  expiresAt: number;
}

interface DeputyInfo {
  uf: string;
  partido: string;
}

const yearMemoryCache = new Map<number, CachedEntry<YearDataset>>();
const yearInFlight = new Map<number, Promise<YearDataset>>();

let deputadosMapCache: CachedEntry<Map<number, DeputyInfo>> | null = null;
let deputadosMapInFlight: Promise<Map<number, DeputyInfo>> | null = null;

// Autoria de proposição individual pode ser cacheada em memória por algumas horas
const propPrimaryAuthorCache = new Map<number, CachedEntry<ProjetoLei | null>>();

export function isSupportedYear(year: number): year is SupportedYear {
  return (SUPPORTED_YEARS as readonly number[]).includes(year);
}

export function getCurrentBrasiliaYear(): number {
  return Number(getBrasiliaDateKey().slice(0, 4));
}

function getYearTtlMs(year: number): number {
  return year >= getCurrentBrasiliaYear() ? 15 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 45000): Promise<{
  data: T;
  lastModified: string | null;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'RadarLegislativo/1.0 (https://github.com/radar-legislativo)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ao consultar ${url}`);
    }
    const data = (await res.json()) as T;
    return {
      data,
      lastModified: res.headers.get('last-modified'),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readDiskCache(year: number, ttlMs: number): Promise<YearDataset | null> {
  try {
    const filePath = path.join(CACHE_DIR, `camara-${year}.json`);
    const stat = await fs.stat(filePath);
    if (Date.now() - stat.mtimeMs > ttlMs) {
      return null;
    }
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as YearDataset;
  } catch {
    return null;
  }
}

async function writeDiskCache(year: number, dataset: YearDataset): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const filePath = path.join(CACHE_DIR, `camara-${year}.json`);
    await fs.writeFile(filePath, JSON.stringify(dataset), 'utf8');
  } catch {
    // Cache em disco é apenas otimização local/warm-container
  }
}

export async function getDeputadosMap(): Promise<Map<number, DeputyInfo>> {
  const now = Date.now();
  if (deputadosMapCache && deputadosMapCache.expiresAt > now) {
    return deputadosMapCache.value;
  }
  if (deputadosMapInFlight) {
    return deputadosMapInFlight;
  }

  deputadosMapInFlight = (async () => {
    try {
      const map = new Map<number, DeputyInfo>();
      // Carrega legislatura 57 (atual) e também todos em exercício
      const urls = [
        `${CAMARA_BASE}/api/v2/deputados?idLegislatura=57&itens=1000`,
        `${CAMARA_BASE}/api/v2/deputados?itens=1000`,
      ];

      const results = await Promise.allSettled(
        urls.map((u) =>
          fetchJsonWithTimeout<{
            dados?: Array<{ id: number; siglaUf?: string; siglaPartido?: string }>;
          }>(u, 20000),
        ),
      );

      for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        for (const dep of result.value.data.dados ?? []) {
          const uf = normalizeUf(dep.siglaUf);
          if (!VALID_UF_SET.has(uf)) continue;
          map.set(dep.id, {
            uf,
            partido: (dep.siglaPartido ?? '').trim(),
          });
        }
      }

      deputadosMapCache = {
        value: map,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      return map;
    } finally {
      deputadosMapInFlight = null;
    }
  })();

  return deputadosMapInFlight;
}

async function resolveDeputyInfo(
  deputyId: number,
  deputadosMap: Map<number, DeputyInfo>,
): Promise<DeputyInfo | null> {
  const existing = deputadosMap.get(deputyId);
  if (existing) return existing;

  try {
    const { data } = await fetchJsonWithTimeout<{
      dados?: {
        ultimoStatus?: { siglaUf?: string; siglaPartido?: string };
      };
    }>(`${CAMARA_BASE}/api/v2/deputados/${deputyId}`, 10000);
    const uf = normalizeUf(data.dados?.ultimoStatus?.siglaUf);
    if (!VALID_UF_SET.has(uf)) return null;
    const info: DeputyInfo = {
      uf,
      partido: (data.dados?.ultimoStatus?.siglaPartido ?? '').trim(),
    };
    deputadosMap.set(deputyId, info);
    return info;
  } catch {
    return null;
  }
}

function extractDeputyIdFromUri(uri: string | undefined): number | null {
  if (!uri) return null;
  const match = uri.match(/\/deputados\/(\d+)(?:$|\?)/);
  return match ? Number(match[1]) : null;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

/**
 * Busca proposições PL e PLP recentes diretamente da API REST v2 da Câmara
 * (usado pelo Modo Ao Vivo e para complementar o dia atual antes da geração do arquivo em massa).
 */
export async function getLivePropositions(sinceDateKey?: string): Promise<ProjetoLei[]> {
  const todayKey = getBrasiliaDateKey();
  const effectiveSince =
    sinceDateKey && /^\d{4}-\d{2}-\d{2}$/.test(sinceDateKey)
      ? sinceDateKey
      : shiftDateKey(todayKey, -3);

  const url = `${CAMARA_BASE}/api/v2/proposicoes?siglaTipo=PL&siglaTipo=PLP&dataApresentacaoInicio=${effectiveSince}&ordem=DESC&ordenarPor=id&itens=100`;

  const [{ data }, deputadosMap] = await Promise.all([
    fetchJsonWithTimeout<{ dados?: RawBulkProposicao[] }>(url, 20000),
    getDeputadosMap(),
  ]);

  const rawProps = (data.dados ?? []).filter((p) => {
    if (!isPlOrPlp(p.siglaTipo)) return false;
    const dKey = extractDateKey(p.dataApresentacao);
    return dKey >= effectiveSince;
  });

  const now = Date.now();
  const resolved = await mapWithConcurrency(rawProps, 8, async (prop): Promise<ProjetoLei | null> => {
    const cached = propPrimaryAuthorCache.get(prop.id);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    try {
      const { data: autRes } = await fetchJsonWithTimeout<{ dados?: RawRestAutor[] }>(
        `${CAMARA_BASE}/api/v2/proposicoes/${prop.id}/autores`,
        12000,
      );
      const primary = pickPrimaryAuthor(autRes.dados ?? []);
      if (!primary) {
        propPrimaryAuthorCache.set(prop.id, { value: null, expiresAt: now + 6 * 60 * 60 * 1000 });
        return null;
      }

      const deputyId = extractDeputyIdFromUri(primary.uri);
      if (!deputyId) {
        // Autor não é deputado (Executivo, Comissão, etc.) -> descartar conforme regra
        propPrimaryAuthorCache.set(prop.id, { value: null, expiresAt: now + 6 * 60 * 60 * 1000 });
        return null;
      }

      const depInfo = await resolveDeputyInfo(deputyId, deputadosMap);
      if (!depInfo || !VALID_UF_SET.has(depInfo.uf)) {
        propPrimaryAuthorCache.set(prop.id, { value: null, expiresAt: now + 6 * 60 * 60 * 1000 });
        return null;
      }

      const dataApresentacao = prop.dataApresentacao ?? '';
      const dateKey = extractDateKey(dataApresentacao);
      const yearFromDate = Number(dateKey.slice(0, 4)) || getCurrentBrasiliaYear();

      const item: ProjetoLei = {
        id: prop.id,
        tipo: prop.siglaTipo as 'PL' | 'PLP',
        numero: Number(prop.numero) || 0,
        ano: Number(prop.ano) || yearFromDate,
        dataApresentacao,
        dateKey,
        timestamp: parseBrasiliaTimestamp(dataApresentacao),
        uf: depInfo.uf,
        autorNome: (primary.nome ?? 'Deputado(a)').trim(),
        autorPartido: depInfo.partido,
        ementa: truncateEmenta(prop.ementa),
      };

      propPrimaryAuthorCache.set(prop.id, {
        value: item,
        expiresAt: now + 6 * 60 * 60 * 1000,
      });
      return item;
    } catch {
      return null;
    }
  });

  return resolved
    .filter((item): item is ProjetoLei => item !== null)
    .sort((a, b) => a.timestamp - b.timestamp || a.id - b.id);
}

/**
 * Carrega e normaliza todos os PLs e PLPs de um ano (2023–2026) a partir dos arquivos em massa da Câmara.
 */
export async function getYearDataset(year: number): Promise<YearDataset> {
  const ttlMs = getYearTtlMs(year);
  const now = Date.now();

  const mem = yearMemoryCache.get(year);
  if (mem && mem.expiresAt > now) {
    return mem.value;
  }

  const disk = await readDiskCache(year, ttlMs);
  if (disk) {
    yearMemoryCache.set(year, { value: disk, expiresAt: now + ttlMs });
    return disk;
  }

  const inFlight = yearInFlight.get(year);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async () => {
    try {
      const propsUrl = `${CAMARA_BASE}/arquivos/proposicoes/json/proposicoes-${year}.json`;
      const authorsUrl = `${CAMARA_BASE}/arquivos/proposicoesAutores/json/proposicoesAutores-${year}.json`;

      const [propsRes, authorsRes] = await Promise.all([
        fetchJsonWithTimeout<{ dados?: RawBulkProposicao[] }>(propsUrl, 45000),
        fetchJsonWithTimeout<{ dados?: RawBulkAutor[] }>(authorsUrl, 45000),
      ]);

      let dataset = normalizeYearDataset(
        propsRes.data.dados ?? [],
        authorsRes.data.dados ?? [],
        year,
        propsRes.lastModified,
      );

      // Para o ano corrente, mescla proposições dos últimos 2 dias via API REST v2
      // para contemplar protocolos feitos após a geração diária do arquivo em massa.
      if (year === getCurrentBrasiliaYear()) {
        try {
          const recentSince = shiftDateKey(getBrasiliaDateKey(), -2);
          const recentProjects = await getLivePropositions(recentSince);
          if (recentProjects.length > 0) {
            const merged = mergeProjects(dataset.projects, recentProjects, year);
            dataset = {
              ...dataset,
              ...merged,
            };
          }
        } catch {
          // Segue com o arquivo em massa caso a API REST oscile
        }
      }

      yearMemoryCache.set(year, { value: dataset, expiresAt: Date.now() + ttlMs });
      await writeDiskCache(year, dataset);
      return dataset;
    } finally {
      yearInFlight.delete(year);
    }
  })();

  yearInFlight.set(year, promise);
  return promise;
}
