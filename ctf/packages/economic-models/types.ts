// Types for raw records in economic-models ETL

export interface RawTransactionRecord {
  id: string;
  user_id: string;
  counterparty_id: string;
  community_id: string;
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface RawRegionalFlowRecord {
  id: string;
  from_region: string;
  to_region: string;
  value: number;
  type: string;
  timestamp: string;
}

export interface RawInputOutputRecord {
  id: string;
  from_sector: string;
  to_sector: string;
  value: number;
  type: string;
  timestamp: string;
}
