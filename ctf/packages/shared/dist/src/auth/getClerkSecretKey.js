// Shared Clerk secret key util for plugin auth
export function getClerkSecretKey() {
    return process.env.CLERK_SECRET_KEY || process.env.AUTH_SECRET_KEY;
}
