import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import {
  exchangeCodeAsync,
  makeRedirectUri,
  refreshAsync,
  useAuthRequest,
  type DiscoveryDocument,
  type TokenResponse,
} from "expo-auth-session";
import { registerAuthTokenGetter } from "./authedFetch";
import { getClerkOAuthClientId, getClerkOAuthEndpoints } from "./clerkOAuth";
import {
  clearStoredSession,
  loadStoredSession,
  saveStoredSession,
  type StoredSession,
} from "./sessionStore";
import { decodeJwtClaims } from "./jwt";

// Lets the OAuth browser tab hand control back to the app.
WebBrowser.maybeCompleteAuthSession();

export interface AuthUser {
  id: string;
  username?: string | null;
  email?: string | null;
  /** Normalized lowercase role claim (e.g. 'admin', 'operations'), or null. */
  role?: string | null;
  isAdmin?: boolean;
  isApproved?: boolean;
  provider?: string | null;
}

export interface AuthContextType {
  user: AuthUser | null;
  provider: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Returns the current bearer token (Clerk-signed OIDC id_token), or null. */
  getToken: () => Promise<string | null>;
  signIn: () => Promise<void> | void;
  signOut: () => Promise<void> | void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type RuntimeConfig = {
  authProvider?: string;
  signInUrl?: string;
  appUrl?: string;
};

function getRuntimeConfig(): RuntimeConfig {
  return (Constants.expoConfig?.extra ?? Constants.manifest2?.extra ?? {}) as RuntimeConfig;
}

// OpenID Connect scopes: `openid` is required to receive an id_token; `profile`
// and `email` ask Clerk to include the standard profile/email claims.
const OAUTH_SCOPES = ["openid", "profile", "email"];

function resolveMetadata(claims: Record<string, unknown>): Record<string, unknown> {
  return (
    (claims.metadata as Record<string, unknown> | undefined) ??
    (claims.public_metadata as Record<string, unknown> | undefined) ??
    {}
  );
}

function resolveRole(
  claims: Record<string, unknown>,
  metadata: Record<string, unknown>,
): string | null {
  const rawRole =
    (typeof claims.role === "string" ? claims.role : undefined) ??
    (typeof metadata.role === "string" ? metadata.role : undefined);
  return rawRole ? rawRole.toLowerCase() : null;
}

function resolveUsername(
  claims: Record<string, unknown>,
  metadata: Record<string, unknown>,
): string | null {
  return (
    (typeof claims.username === "string" ? claims.username : null) ??
    (typeof metadata.username === "string" ? (metadata.username as string) : null)
  );
}

function resolveApproved(
  claims: Record<string, unknown>,
  metadata: Record<string, unknown>,
): boolean {
  const approved = claims.is_approved ?? metadata.is_approved ?? metadata.isApproved;
  return typeof approved === "boolean"
    ? approved
    : ["1", "true", "yes", "approved"].includes(String(approved ?? "").toLowerCase());
}

function deriveUserFromClaims(claims: Record<string, unknown> | null): AuthUser | null {
  if (!claims) return null;
  const sub = typeof claims.sub === "string" ? claims.sub : null;
  if (!sub) return null;
  const metadata = resolveMetadata(claims);
  const role = resolveRole(claims, metadata);
  return {
    id: sub,
    username: resolveUsername(claims, metadata),
    email: typeof claims.email === "string" ? claims.email : null,
    role,
    isAdmin: role === "admin",
    isApproved: resolveApproved(claims, metadata),
    provider: getRuntimeConfig().authProvider ?? "clerk",
  };
}

// Build a refreshed StoredSession from a token refresh response, preserving the
// previous session's values wherever the refresh did not return a new one.
function buildRefreshedSession(refreshed: TokenResponse, current: StoredSession): StoredSession {
  return {
    idToken: refreshed.idToken ?? current.idToken,
    refreshToken: refreshed.refreshToken ?? current.refreshToken,
    expiresAt:
      typeof refreshed.expiresIn === "number"
        ? Date.now() + refreshed.expiresIn * 1000
        : current.expiresAt,
  };
}

// Build a StoredSession from a fresh code-exchange token response. `idToken` is
// passed in already narrowed to a non-null string by the caller's guard.
function buildStoredSession(idToken: string, tokenResponse: TokenResponse): StoredSession {
  return {
    idToken,
    refreshToken: tokenResponse.refreshToken ?? null,
    expiresAt:
      typeof tokenResponse.expiresIn === "number"
        ? Date.now() + tokenResponse.expiresIn * 1000
        : null,
  };
}

/**
 * AuthProvider — real mobile sign-in with no `@clerk/clerk-js`.
 *
 * Sign-in runs an OAuth 2.0 authorization-code flow with PKCE (a way to do OAuth
 * safely from an app that cannot keep a secret) against Clerk, which acts as an
 * OpenID Connect provider, using `expo-auth-session` + `expo-web-browser`. The
 * token endpoint returns a Clerk-signed OpenID Connect `id_token` (a JWT). We
 * store it in the device keychain via `expo-secure-store` and attach it to every
 * backend call as `Authorization: Bearer <id_token>`. The backend verifies it
 * with `@clerk/backend`'s `verifyToken` — the same signing keys as a web session
 * token — so the verifier needs no change.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const endpoints = getClerkOAuthEndpoints();
  const clientId = getClerkOAuthClientId();
  const discovery: DiscoveryDocument | null = useMemo(
    () =>
      endpoints
        ? {
            authorizationEndpoint: endpoints.authorizationEndpoint,
            tokenEndpoint: endpoints.tokenEndpoint,
          }
        : null,
    [endpoints],
  );

  // The redirect URI the browser returns to. Uses the app scheme (ctf://) in a
  // standalone build and an Expo proxy URL in Expo Go; register both on the
  // Clerk OAuth application.
  const redirectUri = useMemo(() => makeRedirectUri({ scheme: "ctf", path: "oauth-callback" }), []);

  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const sessionRef = useRef<StoredSession | null>(null);
  sessionRef.current = session;

  const [request, , promptAsync] = useAuthRequest(
    {
      clientId: clientId ?? "missing-client-id",
      scopes: OAUTH_SCOPES,
      redirectUri,
      usePKCE: true,
    },
    discovery ?? { authorizationEndpoint: "", tokenEndpoint: "" },
  );

  // Restore any previously stored session on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadStoredSession();
      if (!cancelled) {
        setSession(stored);
        setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = useCallback(async (next: StoredSession | null) => {
    setSession(next);
    if (next) {
      await saveStoredSession(next);
    } else {
      await clearStoredSession();
    }
  }, []);

  // `getToken` returns the stored id_token, refreshing it first when it is
  // expired (or about to expire) and a refresh token is available.
  const getToken = useCallback(async (): Promise<string | null> => {
    const current = sessionRef.current;
    if (!current) return null;
    const skewMs = 30_000;
    const stillValid =
      typeof current.expiresAt !== "number" || current.expiresAt - skewMs > Date.now();
    if (stillValid) return current.idToken;

    if (!current.refreshToken || !discovery || !clientId) {
      // No way to refresh — drop the stale session so the UI shows signed-out.
      await persistSession(null);
      return null;
    }
    try {
      const refreshed = await refreshAsync(
        { clientId, refreshToken: current.refreshToken, scopes: OAUTH_SCOPES },
        discovery,
      );
      const next = buildRefreshedSession(refreshed, current);
      await persistSession(next);
      return next.idToken;
    } catch {
      await persistSession(null);
      return null;
    }
  }, [clientId, discovery, persistSession]);

  // Make the live token available to the plain (non-React) API modules.
  useEffect(() => {
    registerAuthTokenGetter(session ? getToken : null);
    return () => registerAuthTokenGetter(null);
  }, [session, getToken]);

  const user = useMemo<AuthUser | null>(() => {
    if (!session) return null;
    return deriveUserFromClaims(decodeJwtClaims(session.idToken));
  }, [session]);

  const handleSignIn = useCallback(async () => {
    if (!discovery || !clientId || !request) {
      Alert.alert(
        "Sign in not configured",
        "Set NEXT_PUBLIC_AUTH_PUBLISHABLE_KEY and EXPO_PUBLIC_CLERK_OAUTH_CLIENT_ID, and register the Clerk OAuth application, to enable sign-in.",
      );
      return;
    }
    try {
      const result = await promptAsync();
      if (result.type !== "success" || !result.params.code) {
        return;
      }
      const tokenResponse = await exchangeCodeAsync(
        {
          clientId,
          code: result.params.code,
          redirectUri,
          extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
        },
        discovery,
      );
      if (!tokenResponse.idToken) {
        Alert.alert("Sign in failed", "No id token was returned by the sign-in server.");
        return;
      }
      await persistSession(buildStoredSession(tokenResponse.idToken, tokenResponse));
    } catch {
      Alert.alert("Sign in failed", "Could not complete sign-in. Please try again.");
    }
  }, [clientId, discovery, persistSession, promptAsync, redirectUri, request]);

  const handleSignOut = useCallback(async () => {
    await persistSession(null);
    registerAuthTokenGetter(null);
  }, [persistSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        provider: user?.provider ?? getRuntimeConfig().authProvider ?? "clerk",
        isLoading,
        isAuthenticated: Boolean(session && user),
        getToken,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
