'use client';

import { useEffect, useState } from 'react';
import { SE_PEOPLE_FILTERS, SE_PEOPLE_PAGE_SIZE, SE_PEOPLE_WORDS as W, type SePeopleFilter, type SePeoplePage } from '@ctf/shared';
import { PeopleLocked } from './people-locked';
import { PersonCard } from './person-card';
import { readPage, usePeople, usePeopleCount, writePage, type PeopleState } from './use-people';
import styles from './people.module.css';

// People, built to the approved boards "People, verified" and "People, not yet verified": the
// Directory with who offers what now for an approved member, and for a member not approved yet the
// number listed and the way to Unlock. Lists are paged, never an endless scroll.

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

function Results({ state, onPage, onRetry }: { state: PeopleState; onPage: (_page: number) => void; onRetry: () => void }) {
  if (state.kind === 'loading' || state.kind === 'locked') return <p className={styles.meta}>{W.loading}</p>;
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

function Header({ count }: { count: number | null }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{W.title}</h1>
      {count !== null ? <span className={styles.count}>{W.listedCount(count)}</span> : null}
    </header>
  );
}

function Filters({ filter, onFilter }: { filter: SePeopleFilter; onFilter: (_next: SePeopleFilter) => void }) {
  return (
    <div className={styles.chips} role="radiogroup" aria-label={W.filters}>
      {SE_PEOPLE_FILTERS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          role="radio"
          aria-checked={filter === chip.id}
          className={styles.chip}
          onClick={() => onFilter(chip.id)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function PeopleScreen({ onToday }: { onToday: () => void }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<SePeopleFilter>('all');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const state = usePeople(page, filter, query, attempt);
  const count = usePeopleCount();

  useEffect(() => setPage(readPage()), []);

  const goTo = (next: number) => {
    setPage(next);
    writePage(next);
    window.scrollTo(0, 0);
  };

  if (state.kind === 'locked') {
    return (
      <div className={styles.lockedScreen}>
        <Header count={null} />
        <PeopleLocked count={count} onToday={onToday} />
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Header count={count} />
      <label className={styles.searchField}>
        <span className={styles.hidden}>{W.searchLabel}</span>
        <input
          type="search"
          className={styles.search}
          placeholder={W.search}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            goTo(1);
          }}
        />
      </label>
      <Filters
        filter={filter}
        onFilter={(next) => {
          setFilter(next);
          goTo(1);
        }}
      />
      <Results state={state} onPage={goTo} onRetry={() => setAttempt((n) => n + 1)} />
    </div>
  );
}
