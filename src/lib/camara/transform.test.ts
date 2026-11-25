import { describe, expect, it } from 'vitest';
import {
  extractDateKey,
  mergeProjects,
  normalizeYearDataset,
  pickPrimaryAuthor,
} from './transform';
import type { RawBulkAutor, RawBulkProposicao } from './types';

describe('camara/transform', () => {
  it('picks primary author by lowest ordemAssinatura and proponente tie-breaker', () => {
    const authors: RawBulkAutor[] = [
      { idProposicao: 1, nomeAutor: 'Coautor SP', siglaUFAutor: 'SP', ordemAssinatura: '2', proponente: '0' },
      { idProposicao: 1, nomeAutor: 'Autor BA', siglaUFAutor: 'BA', ordemAssinatura: '1', proponente: '1' },
      { idProposicao: 1, nomeAutor: 'Coautor MG', siglaUFAutor: 'MG', ordemAssinatura: '3', proponente: '0' },
    ];
    expect(pickPrimaryAuthor(authors)?.siglaUFAutor).toBe('BA');

    const tieAuthors: RawBulkAutor[] = [
      { idProposicao: 2, nomeAutor: 'A', siglaUFAutor: 'RJ', ordemAssinatura: '1', proponente: '0' },
      { idProposicao: 2, nomeAutor: 'B', siglaUFAutor: 'CE', ordemAssinatura: '1', proponente: '1' },
    ];
    expect(pickPrimaryAuthor(tieAuthors)?.siglaUFAutor).toBe('CE');
  });

  it('filters only PL/PLP presented in target year and discards non-UF primary authors', () => {
    const rawProps: RawBulkProposicao[] = [
      { id: 10, siglaTipo: 'PL', numero: 1, ano: 2026, dataApresentacao: '2026-01-02T10:11:00', ementa: 'PL válido' },
      { id: 11, siglaTipo: 'PLP', numero: 2, ano: 2026, dataApresentacao: '2026-02-15T14:00:00', ementa: 'PLP válido' },
      // Renumerado de ano anterior (deve ser excluído)
      { id: 12, siglaTipo: 'PL', numero: 99, ano: 2026, dataApresentacao: '2005-06-13T14:34:00', ementa: 'Antigo' },
      // Tipo não desejado (PEC)
      { id: 13, siglaTipo: 'PEC', numero: 3, ano: 2026, dataApresentacao: '2026-01-05T09:00:00', ementa: 'PEC' },
      // Autor sem UF (Poder Executivo) -> deve ser descartado mesmo tendo coautor ou não
      { id: 14, siglaTipo: 'PL', numero: 4, ano: 2026, dataApresentacao: '2026-03-01T11:00:00', ementa: 'Executivo' },
      // Coautoria multi-estado -> deve atribuir apenas ao 1º signatário (PE)
      { id: 15, siglaTipo: 'PL', numero: 5, ano: 2026, dataApresentacao: '2026-01-02T08:00:00', ementa: 'Multi UF' },
    ];

    const rawAuthors: RawBulkAutor[] = [
      { idProposicao: 10, nomeAutor: 'Dep SP', siglaUFAutor: 'sp', siglaPartidoAutor: 'PL', ordemAssinatura: '1', proponente: '1' },
      { idProposicao: 11, nomeAutor: 'Dep BA', siglaUFAutor: 'BA', siglaPartidoAutor: 'PT', ordemAssinatura: '1', proponente: '1' },
      { idProposicao: 12, nomeAutor: 'Dep MG', siglaUFAutor: 'MG', siglaPartidoAutor: 'MDB', ordemAssinatura: '1', proponente: '1' },
      { idProposicao: 13, nomeAutor: 'Dep RS', siglaUFAutor: 'RS', siglaPartidoAutor: 'PP', ordemAssinatura: '1', proponente: '1' },
      { idProposicao: 14, nomeAutor: 'Poder Executivo', siglaUFAutor: '', tipoAutor: 'Órgão do Poder Executivo', ordemAssinatura: '1', proponente: '1' },
      { idProposicao: 15, nomeAutor: 'Dep RJ', siglaUFAutor: 'RJ', siglaPartidoAutor: 'PSD', ordemAssinatura: '2', proponente: '0' },
      { idProposicao: 15, nomeAutor: 'Dep PE', siglaUFAutor: 'PE', siglaPartidoAutor: 'PSB', ordemAssinatura: '1', proponente: '1' },
    ];

    const ds = normalizeYearDataset(rawProps, rawAuthors, 2026, 'Wed, 25 Nov 2026 04:34:34 GMT');

    expect(ds.totalProjects).toBe(3);
    expect(ds.totalPL).toBe(2);
    expect(ds.totalPLP).toBe(1);
    // Ordenação cronológica: id 15 (08:00), id 10 (10:11), id 11 (15/02)
    expect(ds.projects.map((p) => p.id)).toEqual([15, 10, 11]);
    expect(ds.projects[0].uf).toBe('PE');
    expect(ds.projects[1].uf).toBe('SP');
    expect(ds.dailyCounts['2026-01-02']).toEqual({ pl: 2, plp: 0 });
    expect(ds.dailyCounts['2026-02-15']).toEqual({ pl: 0, plp: 1 });
  });

  it('preserves local dateKey without UTC shift and merges deduplicated projects', () => {
    expect(extractDateKey('2026-01-02T23:45:00')).toBe('2026-01-02');
    const ds = normalizeYearDataset(
      [{ id: 100, siglaTipo: 'PL', numero: 10, ano: 2026, dataApresentacao: '2026-01-10T22:30:00', ementa: 'Teste' }],
      [{ idProposicao: 100, nomeAutor: 'Dep', siglaUFAutor: 'DF', siglaPartidoAutor: 'UNIÃO', ordemAssinatura: 1, proponente: 1 }],
      2026,
    );

    const merged = mergeProjects(
      ds.projects,
      [
        {
          id: 101,
          tipo: 'PLP',
          numero: 1,
          ano: 2026,
          dataApresentacao: '2026-01-05T09:00',
          dateKey: '2026-01-05',
          timestamp: Date.parse('2026-01-05T09:00:00-03:00'),
          uf: 'AM',
          autorNome: 'Dep AM',
          autorPartido: 'MDB',
          ementa: 'Novo',
        },
        // Duplicado do 100
        ds.projects[0],
      ],
      2026,
    );

    expect(merged.totalProjects).toBe(2);
    expect(merged.totalPL).toBe(1);
    expect(merged.totalPLP).toBe(1);
    expect(merged.projects.map((p) => p.id)).toEqual([101, 100]);
  });
});
