import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveServiceConsumer } from './service-consumer';

// A machine caller is the only identity in this app that is not a person, so the rules around it
// are not the ones every other test here checks. What matters is that the credential is bound to
// one named consumer, that a wrong name with a right secret gets nothing, and that a Clerk
// session token falls through untouched -- the mobile app sends one on this same header.

const KEPT = process.env.TAXONOMY_SERVICE_TOKENS;

function configure(value: string | undefined) {
  if (value === undefined) delete process.env.TAXONOMY_SERVICE_TOKENS;
  else process.env.TAXONOMY_SERVICE_TOKENS = value;
}

describe('resolveServiceConsumer', () => {
  beforeEach(() => configure('one-percent:a-secret-that-is-long-enough-0123456789'));
  afterEach(() => configure(KEPT));

  it('names the consumer behind a credential that matches', () => {
    const consumer = resolveServiceConsumer(
      'Bearer one-percent.a-secret-that-is-long-enough-0123456789',
    );
    expect(consumer).toEqual({ name: 'one-percent' });
  });

  // The binding is the point. A secret that is correct for one consumer authenticates that
  // consumer and nothing else, which is what the access policy contract's
  // `unauthorized_consumer_binding` deny condition means.
  it('refuses the right secret under the wrong name', () => {
    expect(
      resolveServiceConsumer('Bearer somebody-else.a-secret-that-is-long-enough-0123456789'),
    ).toBeNull();
  });

  it('refuses the right name with the wrong secret', () => {
    expect(resolveServiceConsumer('Bearer one-percent.not-the-secret')).toBeNull();
  });

  // Falling through rather than refusing, so the member path still runs. A Clerk session token
  // has no dot-separated consumer name in front of it and must not be treated as a failed
  // service credential.
  it('ignores a token that is not a service credential at all', () => {
    expect(resolveServiceConsumer('Bearer eyJhbGciOiJSUzI1NiJ9-not-ours')).toBeNull();
    expect(resolveServiceConsumer('Bearer .no-name')).toBeNull();
    expect(resolveServiceConsumer('Bearer one-percent.')).toBeNull();
  });

  it('ignores anything that is not a bearer header', () => {
    expect(resolveServiceConsumer(null)).toBeNull();
    expect(resolveServiceConsumer('')).toBeNull();
    expect(resolveServiceConsumer('Basic one-percent.a-secret')).toBeNull();
  });

  // No credential configured is the correct state for an environment that was never given one,
  // and it has to mean nobody rather than everybody.
  it('lets nobody in when nothing is configured', () => {
    configure(undefined);
    expect(
      resolveServiceConsumer('Bearer one-percent.a-secret-that-is-long-enough-0123456789'),
    ).toBeNull();
    configure('');
    expect(
      resolveServiceConsumer('Bearer one-percent.a-secret-that-is-long-enough-0123456789'),
    ).toBeNull();
  });

  // A secret may hold a colon. Splitting on the first one keeps the rest of it intact rather
  // than silently authenticating against a truncated value.
  it('keeps a secret that contains a colon intact', () => {
    configure('one-percent:part-one:part-two');
    expect(resolveServiceConsumer('Bearer one-percent.part-one:part-two')).toEqual({
      name: 'one-percent',
    });
    expect(resolveServiceConsumer('Bearer one-percent.part-one')).toBeNull();
  });

  // Same for the token: the name is up to the first dot and the secret is everything after it.
  it('keeps a secret that contains a dot intact', () => {
    configure('one-percent:has.dots.in.it');
    expect(resolveServiceConsumer('Bearer one-percent.has.dots.in.it')).toEqual({
      name: 'one-percent',
    });
  });

  it('reads more than one configured consumer', () => {
    configure('one-percent:first-secret,another:second-secret');
    expect(resolveServiceConsumer('Bearer another.second-secret')).toEqual({ name: 'another' });
    expect(resolveServiceConsumer('Bearer one-percent.first-secret')).toEqual({
      name: 'one-percent',
    });
    expect(resolveServiceConsumer('Bearer another.first-secret')).toBeNull();
  });

  it('skips a malformed entry rather than failing the entire list', () => {
    configure('rubbish,one-percent:a-good-secret');
    expect(resolveServiceConsumer('Bearer one-percent.a-good-secret')).toEqual({
      name: 'one-percent',
    });
  });
});
