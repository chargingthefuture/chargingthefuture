import React, { ReactNode, FC } from 'react';

export const ClerkProvider: FC<{ children: ReactNode }> = ({ children }) => (
  <>{children}</>
);
export const SignIn: FC = () => <div style={{ padding: 20 }}>Auth disabled (SignIn)</div>;
export const SignUp: FC = () => <div style={{ padding: 20 }}>Auth disabled (SignUp)</div>;
export const SignedIn: FC<{ children: ReactNode }> = ({ children }) => <>{children}</>;
export const SignedOut: FC<{ children?: ReactNode }> = ({ children }) => null;
export const SignInButton: FC<{ children?: ReactNode }> = ({ children }) => <>{children}</>;
export const UserButton: FC = () => <button type="button">User</button>;
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
