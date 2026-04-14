import pkg from 'pg';
declare const Client: typeof pkg.Client;
export declare function initializeDb(): Promise<void>;
export declare function getClient(): InstanceType<typeof Client>;
export declare function closeDb(): Promise<void>;
export declare function query(sql: string, params?: any[]): Promise<any>;
export {};
//# sourceMappingURL=db.d.ts.map