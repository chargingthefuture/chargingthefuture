export type SeDaysWonTrend = {
    points: string;
    end: {
        x: number;
        y: number;
    };
};
export declare function seDaysWonTrend(days: number[] | null | undefined, width: number, height: number, pad?: number): SeDaysWonTrend | null;
