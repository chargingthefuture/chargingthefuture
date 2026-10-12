// The readable reason behind a caught value, shared by the server half (`failure.ts`) and the client
// half (`client-failure.ts`) of rule 137. Pure: no server-only or browser-only imports.
//
// An Error's own message is often not the reason. Node's built-in fetch rejects with
// `TypeError: fetch failed` and puts what went wrong (refused connection, DNS failure, reset,
// certificate error) in `error.cause`; a connection error can arrive as an `AggregateError` with an
// empty message and the real errors inside it. Both are unwrapped here so the reason names the cause.
//
// Error.cause and AggregateError are read structurally because this package's TypeScript library
// setting (ES2020) declares neither.

function codeOf(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === 'string' && code.trim().length > 0 ? code.trim() : null;
}

// "ENOTFOUND: getaddrinfo failed", or just the message when it already names the code.
function describeOne(value: unknown): string | null {
  if (value instanceof Error) {
    const message = value.message.trim();
    const code = codeOf(value);
    if (code && message.length > 0 && !message.includes(code)) return `${code}: ${message}`;
    if (message.length > 0) return message;
    return code;
  }
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

// The first inner error of an AggregateError.
function firstInner(error: unknown): unknown {
  if (typeof error !== 'object' || error === null) return undefined;
  const errors = (error as { errors?: unknown }).errors;
  return Array.isArray(errors) && errors.length > 0 ? errors[0] : undefined;
}

function causeOf(error: unknown): unknown {
  return error instanceof Error ? (error as { cause?: unknown }).cause : undefined;
}

export function describeFailure(error: unknown, maxLength: number): string {
  let raw = (error instanceof Error ? error.message : String(error)).trim();

  if (raw.length === 0) {
    raw = describeOne(firstInner(error)) ?? codeOf(error) ?? '';
  }

  const cause = causeOf(error);
  const causeText = describeOne(cause) ?? describeOne(firstInner(cause));
  if (causeText && causeText !== raw) {
    raw = raw.length > 0 ? `${raw} (${causeText})` : causeText;
  }

  if (raw.length === 0) {
    return error instanceof Error ? `${error.name} with no message` : 'unknown error';
  }
  return raw.length > maxLength ? `${raw.slice(0, maxLength)}…` : raw;
}
