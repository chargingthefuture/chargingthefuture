// Clerk authentication logic for genericPluginAuth
import { getClerkSecretKey } from './getClerkSecretKey';
import jwt from 'jsonwebtoken';
/**
 * Verifies Clerk JWT and returns user ID if valid.
 * @param token Clerk JWT
 * @returns userId or null
 */
export function verifyClerkToken(token) {
    const secret = getClerkSecretKey();
    if (!secret)
        return null;
    try {
        const decoded = jwt.verify(token, secret);
        return decoded.sub || null;
    }
    catch {
        return null;
    }
}
