import data from './brokers.json';

/**
 * PROCESSED — canonical broker list from `process.py` (committed output).
 * Thin typed re-export only; all shaping happens in Python.
 */
export interface Broker {
  code: string;
  name: string;
  name_variants: string[];
  first_seen: string;
  last_seen: string;
  months_active: number;
}

export const brokerList: Broker[] = data as Broker[];
