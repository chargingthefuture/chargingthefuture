// Wrapper that conditionally re-exports Clerk or provides lightweight mocks when
// NEXT_PUBLIC_DISABLE_AUTH=true. Keeps import surface stable for components.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';

const DISABLE = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

if (!DISABLE) {
  // Re-export the real Clerk client-side package when auth is enabled.
  // eslint-disable-next-line import/no-extraneous-dependencies, @typescript-eslint/consistent-type-imports
  import * as clerk from '@clerk/nextjs';
  export const ClerkProvider = clerk.ClerkProvider;
  export const SignIn = clerk.SignIn;
  export const SignUp = clerk.SignUp;
  export const SignedIn = clerk.SignedIn;
  export const SignedOut = clerk.SignedOut;
  export const SignInButton = clerk.SignInButton;
  export const UserButton = clerk.UserButton;
  export const useUser = clerk.useUser;
}
} else {
  // Provide simple no-op/mocked implementations so the app can run without Clerk.
  import { ReactNode, FC } from 'react';
  export const ClerkProvider: FC<{ children: ReactNode }> = ({ children }) => React.createElement(React.Fragment, null, children);
  export const SignIn: FC = () => React.createElement('div', { style: { padding: 20 } }, 'Auth disabled (SignIn)');
  export const SignUp: FC = () => React.createElement('div', { style: { padding: 20 } }, 'Auth disabled (SignUp)');
  export const SignedIn: FC<{ children: ReactNode }> = ({ children }) => React.createElement(React.Fragment, null, children);
  export const SignedOut: FC = () => null;
  export const SignInButton: FC<{ children?: ReactNode }> = ({ children }) => React.createElement(React.Fragment, null, children);
  export const UserButton: FC = () => React.createElement('button', { type: 'button' }, 'User');
  export function useUser() {
    return {
      user: {
        id: 'dev_user',
        firstName: 'Dev',
        username: 'dev',
        imageUrl: null,
      },
    };
  }
}
