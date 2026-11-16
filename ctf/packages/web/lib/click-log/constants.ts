// The limits live in @ctf/shared (ctf/packages/shared/src/click-log/limits.ts) so the 3.1 sheet on
// web and Android caps the same fields the server does. Re-exported here for existing imports.
export { MAX_NOTES_LENGTH, MAX_SCHEME_SUGGESTION_LENGTH, MAX_TAGS_PER_KIND } from '@ctf/shared';
export const DEFAULT_METADATA: Readonly<Record<string, never>> = Object.freeze({});
