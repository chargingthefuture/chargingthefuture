'use client';

import { useEffect, useState } from 'react';
import { SE_PEOPLE_PAGE_SIZE, SE_PEOPLE_WORDS as W, type SePeoplePage } from '@ctf/shared';
import { PersonCard } from './person-card';
import { readPage, usePeople, writePage } from './use-people';
import styles from './people.module.css';

// People: the Directory, with who offers what now. Approved members only, like the Directory.

function Pager({ people, onPage }: { people: SePeoplePage; onPage: (_page: number) => void }) {
  const from = people.total === 0 ? 0 : (people.page - 1) * SE_PEOPLE_PAGE_SIZE + 1;
  const to = Math.min(people.page * SE_PEOPLE_PAGE_SIZE, people.total);
  const last = Math.max(1, Math.ceil(people.total / SE_PEOPLE_PAGE_SIZE));
  return (
    <nav className={styles.pager} aria-label="Pages">
      <button type="button" className={styles.button} disabled={people.page <= 1} onClick={() => onPage(people.page - 1)}>
        {W.previous}
      </button>
      <span className={styles.meta}>{W.range(from, to, people.total)}</span>
      <button type="button" className={styles.button} disabled={people.page >= last} onClick={() => onPage(people.page + 1)}>
        {W.next}
      </button>
    </nav>
  );
}

function Results({ state, onPage, onRetry }: { state: ReturnType<typeof usePeople>; onPage: (_page: number) => void; onRetry: () => void }) {
  if (state.kind === 'loading') return <p className={styles.meta}>{W.loading}</p>;
  if (state.kind === 'error') {
    return (
      <p role="alert" className={styles.meta}>
        {W.failed} {state.message}{' '}
        <button type="button" className={styles.linkButton} onClick={onRetry}>
          {W.tryAgain}
        </button>
      </p>
    );
  }
  if (state.people.items.length === 0) return <p className={styles.meta}>{W.empty}</p>;
  return (
    <>
      {state.people.items.map((person) => (
        <PersonCard key={person.id} person={person} />
      ))}
      <Pager people={state.people} onPage={onPage} />
    </>
  );
}

export function PeopleScreen() {
  const [page, setPage] = useState(1);
  const [offeringOnly, setOfferingOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const state = usePeople(page, offeringOnly, query, attempt);

  useEffect(() => setPage(readPage()), []);

  const goTo = (next: number) => {
    setPage(next);
    writePage(next);
    window.scrollTo(0, 0);
  };
  const reset = () => goTo(1);

  return (
    <>
      <input
        type="search"
        className={styles.search}
        placeholder={W.search}
        aria-label={W.search}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          reset();
        }}
      />
      <div className={styles.filters} role="radiogroup" aria-label={W.offeringNow}>
        {[false, true].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={offeringOnly === value}
            className={styles.filter}
            onClick={() => {
              setOfferingOnly(value);
              reset();
            }}
          >
            {value ? W.offeringNow : W.everyone}
          </button>
        ))}
      </div>
      <Results state={state} onPage={goTo} onRetry={() => setAttempt((n) => n + 1)} />
    </>
  );
}
