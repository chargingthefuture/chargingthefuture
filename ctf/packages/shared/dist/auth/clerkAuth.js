// Clerk authentication logic for genericPluginAuth.
import { jwtDecode } from 'jwt-decode';
/**
 * DECODE-ONLY structural check. Reads the `sub` claim WITHOUT verifying the
 * signature, so it can be forged trivially.
 *
 * SECURITY: never use this to authenticate a request. It exists only for
 * non-security uses (e.g. reading a claim for display/telemetry). Real
 * authentication must verify the signature server-side — see
 * `lib/auth/verify-bearer.ts` in the web package, which uses
 * `@clerk/backend`'s `verifyToken`.
 */
export function decodeClerkTokenSubject(token) {
    if (!token) {
        return null;
    }
    try {
        const decoded = jwtDecode(token);
        return decoded.sub ?? null;
    }
    catch {
        return null;
    }
}
/**
 * @deprecated Renamed to {@link decodeClerkTokenSubject} to make clear it does
 * NOT verify the signature. Kept as an alias so existing imports keep compiling;
 * do not use it for authentication.
 */
export const verifyClerkToken = decodeClerkTokenSubject;
