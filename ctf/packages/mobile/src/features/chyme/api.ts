/**
 * Chyme mobile API — canonical entry-point for the chyme feature.
 * Delegates to ChymeApi for the actual request logic; re-exported here
 * so callers can use the standard `./api` import convention.
 */
export {
  getChymeMobileIdentity,
  getChymeRoom,
  getChymeMessages,
  postChymeMessage,
  postChymeJoin,
  deleteChymeProfile,
  deleteFullAccount,
} from './ChymeApi';

export type { MobileRequestIdentity } from './ChymeApi';
