// The directory profile shape is defined once in ./api as `DirectoryListItem`, matching the server's
// GET /api/directory/list response. It is re-exported here so components importing from './types'
// resolve to the real, server-backed shape instead of a hand-written one that could drift.
export type { DirectoryListItem } from './api';
