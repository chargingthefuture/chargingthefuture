import pkg, { QueryResult } from 'pg';
declare const Client: typeof pkg.Client;
export declare function initializeDb(): Promise<void>;
export declare function getClient(): InstanceType<typeof Client>;
export declare function closeDb(): Promise<void>;
export declare function query<T extends object = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
export {};
//# sourceMappingURL=db.d.ts.map