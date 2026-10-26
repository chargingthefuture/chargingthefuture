export type SeInterfaceVersion = '3.0' | '3.1';
export declare const SE_INTERFACE_VERSIONS: readonly SeInterfaceVersion[];
export declare const SE_DEFAULT_INTERFACE_VERSION: SeInterfaceVersion;
export declare function isSeInterfaceVersion(value: unknown): value is SeInterfaceVersion;
export type SeTab = 'today' | 'people' | 'new' | 'activity' | 'me';
export declare const SE_TABS: readonly SeTab[];
export declare const SE_TAB_LABELS: Record<SeTab, string>;
