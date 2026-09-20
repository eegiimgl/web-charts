import data from './broker_profiles.json';

/**
 * PROCESSED — merged broker profiles from `process_brokers_info.py`
 * (listing + contact + staff + shareholders + board, by symbol).
 * Thin typed re-export only.
 */
export interface Contact {
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  timetable: string | null;
}

export interface Employee {
  fullName: string;
  position: string;
}

export interface Shareholder {
  fullName: string;
  position?: string;
  share: number | null;
}

export interface BoardMember {
  fullName: string;
  position: string;
}

export interface BrokerProfile {
  symbol: string;
  code: number | string;
  name: string;
  logo: string | null;
  activities: Record<string, boolean>;
  contact: Contact;
  staff_total: number;
  staff_by_category: Record<string, number>;
  employees: Employee[];
  shareholders_individual: Shareholder[];
  shareholders_org: Shareholder[];
  board: BoardMember[];
}

export const brokerProfiles: BrokerProfile[] = data as unknown as BrokerProfile[];
