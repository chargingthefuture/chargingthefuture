export function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.length > 0);
}

export function hasConfiguredValue(key: string): boolean {
  return typeof process.env[key] === 'string' && process.env[key]!.length > 0;
}
