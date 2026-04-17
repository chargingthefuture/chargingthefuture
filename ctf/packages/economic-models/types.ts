// Types for raw records in economic-models ETL

export interface RawTransactionRecord {
  id: string;
  timestamp: string;
  from: string;
  to: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface RawRegionalFlowRecord {
  id: string;
  region: string;
  inflow: number;
  outflow: number;
  net: number;
  period: string;
}

export interface RawInputOutputRecord {
  id: string;
  sector: string;
  input: number;
  output: number;
  period: string;
}
