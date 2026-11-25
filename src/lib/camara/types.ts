import type { SupportedYear } from '@/data/brazil-ufs';

export type TipoProposicao = 'PL' | 'PLP';
export type TipoFilter = 'ALL' | 'PL' | 'PLP';
export type MetricMode = 'ABSOLUTE' | 'PER_DEPUTY';

export interface ProjetoLei {
  id: number;
  tipo: TipoProposicao;
  numero: number;
  ano: number;
  /** ISO local da Câmara, ex: "2026-01-02T10:11" */
  dataApresentacao: string;
  /** "YYYY-MM-DD" para indexação diária na timeline */
  dateKey: string;
  /** Timestamp em ms para ordenação cronológica exata */
  timestamp: number;
  /** Sigla da UF do 1º signatário ("SP", "BA", ...) */
  uf: string;
  autorNome: string;
  autorPartido: string;
  ementa: string;
}

export interface DailyCount {
  pl: number;
  plp: number;
}

export interface YearDataset {
  year: SupportedYear | number;
  generatedAt: string;
  sourceLastModified: string | null;
  totalProjects: number;
  totalPL: number;
  totalPLP: number;
  /** Projetos ordenados cronologicamente (timestamp ASC, id ASC) */
  projects: ProjetoLei[];
  /** Produção diária pré-calculada para o sparkline da timeline */
  dailyCounts: Record<string, DailyCount>;
}

export interface LiveFeedResponse {
  checkedAt: string;
  since: string;
  projects: ProjetoLei[];
}

export interface UfAggregate {
  uf: string;
  total: number;
  pl: number;
  plp: number;
  perDeputy: number;
  cadeiras: number;
}

export interface MapSignal {
  uid: string;
  uf: string;
  tipo: TipoProposicao;
  label: string;
  burstCount: number;
  createdAt: number;
  projectId: number;
}

export interface RawBulkProposicao {
  id: number;
  uri?: string;
  siglaTipo?: string;
  numero?: number;
  ano?: number;
  ementa?: string;
  dataApresentacao?: string;
}

export interface RawBulkAutor {
  idProposicao: number;
  idDeputadoAutor?: number;
  uriAutor?: string;
  tipoAutor?: string;
  nomeAutor?: string;
  siglaPartidoAutor?: string;
  siglaUFAutor?: string;
  ordemAssinatura?: string | number;
  proponente?: string | number;
}

export interface RawRestAutor {
  uri?: string;
  nome?: string;
  codTipo?: number;
  tipo?: string;
  ordemAssinatura?: string | number;
  proponente?: string | number;
}
