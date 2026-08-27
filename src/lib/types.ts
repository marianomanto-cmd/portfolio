export type Kind = 'fondo' | 'bono' | 'cedear' | 'usd' | 'ars';
export type Platform = 'fima' | 'broker';
export type Source = 'fima' | 'broker' | 'mixed';

export const KINDS: Kind[] = ['fondo', 'bono', 'cedear', 'usd', 'ars'];

export const KIND_LABEL: Record<Kind, string> = {
  fondo: 'Fondos',
  bono: 'Bonos',
  cedear: 'Cedears',
  usd: 'Dólares',
  ars: 'Pesos',
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  fima: 'FIMA',
  broker: 'Broker',
};

export interface Instrument {
  id: string;
  name: string;
  kind: Kind;
  platform: Platform;
  yahooSymbol: string | null;
  maturity: string | null;
  sortOrder: number;
  active: boolean;
}

export interface Position {
  instrumentId: string;
  name: string;
  kind: Kind;
  platform: Platform;
  arsValue: number;
  quantity: number | null;
}

export interface Snapshot {
  id: number;
  source: Source;
  takenAt: string;
  mep: number;
  notes: string | null;
  createdAt: string;
}

export interface Book {
  snapshot: Snapshot;
  positions: Position[];
}

export interface Settings {
  saveUsd: number;
  mep: number;
  months: number;
  usAnn: number;
  arsAnn: number;
  rebalance: boolean;
  targetWeights: Partial<Record<Kind, number>>;
}

export interface Memo {
  id: number;
  snapshotId: number | null;
  body: string;
  createdAt: string;
}
