export function getAppUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_APP_URL || undefined;
}
