// The summary another member reads of a member's trust. The function lives in @ctf/shared, so the
// Android app's Me → Trust preview runs the same projection as the route that serves it; see
// packages/shared/src/design/se-trust.ts for the two rules that define it.
export { summarizeTrustEvidenceForPeer, TRUST_SUMMARY_BREADTH_TYPE } from '@ctf/shared';
