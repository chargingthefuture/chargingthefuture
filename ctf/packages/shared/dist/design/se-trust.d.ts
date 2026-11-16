export type SeTrustItem = {
    type: string;
    summary: string;
    details?: string;
    createdAt?: string;
};
export type SeTrustDisclosure = 'full' | 'summary';
export type SeTrustView = {
    evidence: SeTrustItem[];
    disclosure: SeTrustDisclosure;
};
export declare const SE_TRUST_WORDS: {
    readonly title: "Trust";
    readonly meRow: "What others can see of your part in the Avenhood.";
    readonly open: "Open Trust";
    readonly yours: "Your trust";
    readonly membersSee: "What members see";
    readonly membersSeeText: "Any member who opens your profile sees this, and only this. You cannot change it and neither can they.";
    readonly membersSeeEmpty: "Nothing yet — a line appears here once you have taken part somewhere.";
    readonly summaryNote: "This member shares a summary of their participation, not the detail.";
    readonly emptyTitle: "No trust signals yet";
    readonly emptyOwn: "Trust signals appear as you participate in the community";
    readonly emptyOther: "This member has not taken part anywhere yet, so there is nothing to go on";
    readonly steps: readonly ["Complete your profile", "Make your first transaction", "Use at least one plugin"];
    readonly loading: "Reading trust…";
    readonly failed: "Could not read trust this time.";
    readonly locked: "Trust opens once Unlock is done.";
    readonly tryAgain: "Try again";
};
export declare const SE_TRUST_SELF_PATH = "/api/trust/user/self";
export declare function seTrustPath(userId: string, own: boolean): string;
export declare function seTrustViewFrom(body: unknown): SeTrustView | null;
export declare function seTrustLineText(item: SeTrustItem): string;
export declare function seTrustLineDate(item: SeTrustItem): string | null;
export declare const TRUST_SUMMARY_BREADTH_TYPE = "summary-plugin-breadth";
export declare function summarizeTrustEvidenceForPeer(evidence: readonly SeTrustItem[]): SeTrustItem[];
