import { describe, expect, it } from 'vitest';
import type { ProjetoLei } from './camara/types';
import {
  buildYearCalendar,
  computeSnapshotStats,
  findLastIndexAtOrBeforeDate,
} from './timeline-utils';

function makeProject(
  id: number,
  dateKey: string,
  uf: string,
  tipo: 'PL' | 'PLP' = 'PL',
): ProjetoLei {
  return {
    id,
    tipo,
    numero: id,
    ano: Number(dateKey.slice(0, 4)),
    dataApresentacao: `${dateKey}T10:00`,
    dateKey,
    timestamp: Date.parse(`${dateKey}T10:00:00-03:00`),
    uf,
    autorNome: `Deputado ${uf}`,
    autorPartido: 'ABC',
    ementa: 'Ementa de teste',
  };
}

describe('timeline-utils', () => {
  it('builds full calendar for leap and non-leap years and respects maxDateKey', () => {
    const leapDays = buildYearCalendar(2024);
    expect(leapDays.length).toBe(366);
    expect(leapDays[0]).toBe('2024-01-01');
    expect(leapDays[365]).toBe('2024-12-31');

    const partial = buildYearCalendar(2026, '2026-01-05');
    expect(partial).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
    ]);
  });

  it('finds last index at or before target date via binary search', () => {
    const projects = [
      makeProject(1, '2026-01-02', 'SP'),
      makeProject(2, '2026-01-02', 'BA'),
      makeProject(3, '2026-01-05', 'MG'),
      makeProject(4, '2026-02-01', 'DF'),
    ];

    expect(findLastIndexAtOrBeforeDate(projects, '2026-01-01')).toBe(-1);
    expect(findLastIndexAtOrBeforeDate(projects, '2026-01-02')).toBe(1);
    expect(findLastIndexAtOrBeforeDate(projects, '2026-01-04')).toBe(1);
    expect(findLastIndexAtOrBeforeDate(projects, '2026-01-05')).toBe(2);
    expect(findLastIndexAtOrBeforeDate(projects, '2026-12-31')).toBe(3);
  });

  it('computes cumulative UF stats, type filters, and per-deputy ranking', () => {
    const projects = [
      makeProject(1, '2026-01-02', 'SP', 'PL'),
      makeProject(2, '2026-01-03', 'SP', 'PL'),
      makeProject(3, '2026-01-04', 'DF', 'PLP'),
      makeProject(4, '2026-01-04', 'DF', 'PL'),
    ];

    // SP tem 70 cadeiras (2/70 = 0.0285), DF tem 8 cadeiras (2/8 = 0.25)
    const absStats = computeSnapshotStats(projects, 3, 'ALL', 'ABSOLUTE');
    expect(absStats.total).toBe(4);
    expect(absStats.totalPL).toBe(3);
    expect(absStats.totalPLP).toBe(1);
    expect(absStats.byUf.DF.total).toBe(2);
    expect(absStats.byUf.SP.total).toBe(2);

    const perDepStats = computeSnapshotStats(projects, 3, 'ALL', 'PER_DEPUTY');
    expect(perDepStats.leaderUf?.uf).toBe('DF');
    expect(perDepStats.byUf.DF.perDeputy).toBeCloseTo(0.25, 4);
    expect(perDepStats.byUf.SP.perDeputy).toBeCloseTo(2 / 70, 4);

    const plpOnly = computeSnapshotStats(projects, 3, 'PLP', 'ABSOLUTE');
    expect(plpOnly.total).toBe(1);
    expect(plpOnly.leaderUf?.uf).toBe('DF');
  });
});
