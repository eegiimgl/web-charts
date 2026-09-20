import data from './employee_stats.json';

/**
 * PROCESSED — broker × category headcount matrix from `process_brokers_info.py`.
 * Thin typed re-export only.
 */
export interface StaffCategory {
  category: string;
  label: string;
}

export interface BrokerStaffRow {
  symbol: string;
  name: string;
  total: number;
  [category: string]: string | number;
}

interface EmployeeStatsFile {
  total: number;
  categories: StaffCategory[];
  by_broker: BrokerStaffRow[];
}

const stats = data as unknown as EmployeeStatsFile;

export const staffCategories: StaffCategory[] = stats.categories;
export const brokerStaff: BrokerStaffRow[] = stats.by_broker;
export const totalStaff: number = stats.total;
