// Shared Clerk secret key util for plugin auth
export function getClerkSecretKey(): string | undefined {
  return process.env.AUTH_SECRET_KEY;
}
