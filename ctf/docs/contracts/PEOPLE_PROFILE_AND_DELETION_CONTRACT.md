# People Profile and Deletion Contract

## 1) Plugin Metadata

- Plugin Name: People (the 3.1 People screen read)
- Service Key (lowercase, stable): `people`
- Owner Team: chargingthefuture
- Rollout Stage: 3.1.0 build

## 2) Canonical Profile Usage

Rule 114 baseline: People uses the Directory's profiles and the canonical account by `user_id`.
There is no People-local profile.

- Read fields:
  - Directory profile id, first and last name, headline, job title, listed skills, and whether it is
    claimed
  - the skills a claimed profile's owner offers through Foundation (`foundation_provider_skills`)
- Write fields:
  - none

## 3) Plugin Extension Fields

People stores nothing. It reads the Directory and Foundation tables and writes no row.

## 4) Deletion Scopes

- Service deletion: nothing to delete.
- Full account deletion: nothing to delete; the Directory and Foundation contracts cover their rows,
  and a deleted profile stops appearing because the read keeps only live profiles.

## 5) Retention

None.
