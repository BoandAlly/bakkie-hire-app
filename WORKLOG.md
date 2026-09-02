# Work log — what changed last

Newest entry goes at the TOP. Write it like a note to the other person (and to their Claude):
plain English — what you changed, why, and anything half-finished they should know about.

When you (or Claude) make a meaningful change, add a short entry here before pushing.

---

## 2026-09-03 — Megan
Deleted the `friend-feature` branch. **From now on we only use the `main` branch — please put all your work on `main`.**
- Don't create or push other branches. Just `main`, so we both stay on the same page.
- The deleted branch had nothing unique on it (it was just an older copy of `main`), so nothing was lost.
- **If your side still shows `friend-feature`, run `git fetch --prune` (or `git pull`) to clear it.**
- Heads up: the backend that was built locally hasn't landed on GitHub yet — GitHub still only has the app with no backend. When you push the backend, put it on `main` and tell Megan so it can be pulled and turned into a test APK.

---

## 2026-09-02 — Megan
Set up collaboration so two of us can work on this app together.
- Added `COLLABORATION.md` (plain-English guide to push/pull/branches).
- Created the `friend-feature` branch as a starter example.
- Added this work log and a `CLAUDE.md` so each person's Claude reads what happened last.
- Nothing about the app itself changed yet — this was all setup.
- Next: friend (supercheese420) accepts the GitHub invite and clones the repo.
