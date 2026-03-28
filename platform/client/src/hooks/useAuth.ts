import { useUser as useClerkUser, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import type { User as DbUser } from "@shared/schema";
import { useEffect, useState, useRef } from "react";

/**
 * useAuth
 * - Returns the combined auth state from Clerk and the app DB user.
 * - Starts DB fetch only when Clerk is loaded and reports signed-in.
 */
export function useAuth() {
  // Modular auth: bypass Clerk if NEXT_PUBLIC_DISABLE_AUTH is set
  const disableAuth =
    typeof window !== 'undefined'
      ? window.NEXT_PUBLIC_DISABLE_AUTH === 'true' || import.meta.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'
      : import.meta.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

  if (disableAuth) {
    // Return a mock/fake user context for testing/dev
    return {
      user: {
        id: 'mock-user',
        email: 'mock@example.com',
        firstName: 'Mock',
        lastName: 'User',
        isAdmin: true,
      },
      isLoading: false,
      isAuthenticated: true,
      isAdmin: true,
      _clerk: {
        clerkLoaded: true,
        isSignedIn: true,
        clerkUser: {
          id: 'mock-user',
          primaryEmailAddress: { emailAddress: 'mock@example.com' },
        },
        clerkError: null,
      },
      _dbError: null,
    } as const;
  }

  // ...existing code...
}
