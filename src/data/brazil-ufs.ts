export type BrazilianRegion =
  | 'Norte'
  | 'Nordeste'
  | 'Sudeste'
  | 'Sul'
  | 'Centro-Oeste';

export interface BrazilUfMeta {
  ibgeCode: string;
  sigla: string;
  nome: string;
  regiao: BrazilianRegion;
  capital: string;
  cadeiras: number;
  labelOffset?: [number, number];
}

export const SUPPORTED_YEARS = [2023, 2024, 2025, 2026] as const;
export type SupportedYear = (typeof SUPPORTED_YEARS)[number];

export const BRAZIL_UFS: readonly BrazilUfMeta[] = [
  { ibgeCode: '11', sigla: 'RO', nome: 'Rondônia', regiao: 'Norte', capital: 'Porto Velho', cadeiras: 8 },
  { ibgeCode: '12', sigla: 'AC', nome: 'Acre', regiao: 'Norte', capital: 'Rio Branco', cadeiras: 8 },
  { ibgeCode: '13', sigla: 'AM', nome: 'Amazonas', regiao: 'Norte', capital: 'Manaus', cadeiras: 8 },
  { ibgeCode: '14', sigla: 'RR', nome: 'Roraima', regiao: 'Norte', capital: 'Boa Vista', cadeiras: 8 },
  { ibgeCode: '15', sigla: 'PA', nome: 'Pará', regiao: 'Norte', capital: 'Belém', cadeiras: 17 },
  { ibgeCode: '16', sigla: 'AP', nome: 'Amapá', regiao: 'Norte', capital: 'Macapá', cadeiras: 8 },
  { ibgeCode: '17', sigla: 'TO', nome: 'Tocantins', regiao: 'Norte', capital: 'Palmas', cadeiras: 8 },
  { ibgeCode: '21', sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste', capital: 'São Luís', cadeiras: 18 },
  { ibgeCode: '22', sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste', capital: 'Teresina', cadeiras: 10 },
  { ibgeCode: '23', sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste', capital: 'Fortaleza', cadeiras: 22 },
  { ibgeCode: '24', sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste', capital: 'Natal', cadeiras: 8, labelOffset: [22, -6] },
  { ibgeCode: '25', sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste', capital: 'João Pessoa', cadeiras: 12, labelOffset: [24, 0] },
  { ibgeCode: '26', sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste', capital: 'Recife', cadeiras: 25, labelOffset: [24, 6] },
  { ibgeCode: '27', sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste', capital: 'Maceió', cadeiras: 9, labelOffset: [24, 10] },
  { ibgeCode: '28', sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste', capital: 'Aracaju', cadeiras: 8, labelOffset: [22, 14] },
  { ibgeCode: '29', sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste', capital: 'Salvador', cadeiras: 39 },
  { ibgeCode: '31', sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste', capital: 'Belo Horizonte', cadeiras: 53 },
  { ibgeCode: '32', sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste', capital: 'Vitória', cadeiras: 10, labelOffset: [18, 4] },
  { ibgeCode: '33', sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste', capital: 'Rio de Janeiro', cadeiras: 46, labelOffset: [16, 12] },
  { ibgeCode: '35', sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste', capital: 'São Paulo', cadeiras: 70 },
  { ibgeCode: '41', sigla: 'PR', nome: 'Paraná', regiao: 'Sul', capital: 'Curitiba', cadeiras: 30 },
  { ibgeCode: '42', sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul', capital: 'Florianópolis', cadeiras: 16 },
  { ibgeCode: '43', sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul', capital: 'Porto Alegre', cadeiras: 31 },
  { ibgeCode: '50', sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste', capital: 'Campo Grande', cadeiras: 8 },
  { ibgeCode: '51', sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste', capital: 'Cuiabá', cadeiras: 8 },
  { ibgeCode: '52', sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste', capital: 'Goiânia', cadeiras: 17 },
  { ibgeCode: '53', sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste', capital: 'Brasília', cadeiras: 8, labelOffset: [14, -14] },
] as const;

export const UF_BY_IBGE_CODE: Record<string, BrazilUfMeta> = Object.fromEntries(
  BRAZIL_UFS.map((uf) => [uf.ibgeCode, uf]),
);

export const UF_BY_SIGLA: Record<string, BrazilUfMeta> = Object.fromEntries(
  BRAZIL_UFS.map((uf) => [uf.sigla, uf]),
);

export const VALID_UF_SET: ReadonlySet<string> = new Set(BRAZIL_UFS.map((uf) => uf.sigla));
