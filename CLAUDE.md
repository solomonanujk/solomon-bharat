# Project rules

- **Keep `prd.md` (repo root) up to date.** Any change that adds, removes or changes a feature must update `prd.md` in the same commit/PR: the relevant section, the §18 "Not built yet" list if affected, and a line in the §18.16 change log. Bump the version in the header and §16.1 revision history for larger releases.
- Owner decisions are in `docs/BUSINESS_DECISIONS.md`; update it too when the owner makes a new decision.
- Never commit `backend/.env`.
