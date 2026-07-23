/**
 * Chyme mobile API — canonical entry-point for the chyme feature.
 * Delegates to ChymeApi for the actual request logic; re-exported here
 * so callers can use the standard `./api` import convention.
 *
 * Identity comes from the signed-in Clerk session (a verified bearer token
 * attached by authedFetch), not from any caller-supplied identity object.
 */
export {
  getChymeRoom,
  getChymeMessages,
  postChymeMessage,
  deleteChymeMessage,
  postChymeJoin,
  postChymeTip,
  deleteChymeProfile,
  deleteFullAccount,
  chymeHandle,
} from './ChymeApi';
