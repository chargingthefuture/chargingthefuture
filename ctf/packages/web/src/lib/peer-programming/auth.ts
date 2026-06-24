// Generic plugin auth integration for PeerProgramming (web)
import { authenticatePluginUser, PluginAuthContext, PluginAuthResult } from '../../../../shared/auth/genericPluginAuth';

export async function requirePeerProgrammingAuth(context: PluginAuthContext): Promise<PluginAuthResult> {
  // Extend as needed for session/cookie/token extraction
  return authenticatePluginUser(context);
}
