# Bakkie app — notes for Claude

Two people build this app together (Megan and a friend). We stay in sync through GitHub.

## Before you start working — catch up on what happened last

At the start of a session, read these so you know the current state:

1. **`WORKLOG.md`** — the newest entry (top of the file) says what the other person changed last and why.
2. **Recent git history** — run `git log --oneline -10` to see the last handful of changes.
3. Pull the latest before making changes: `git pull`

## After you make a meaningful change — leave a note for the other person

1. Add a short, plain-English entry to the TOP of `WORKLOG.md`: what you changed, why, and anything half-finished.
2. Write a clear commit message describing the change.
3. Push so the other person can pull it.

Keep entries plain and friendly — the other person may not be technical, and their Claude reads these too.

## How the app works (quick orientation)

- React + Vite app, wrapped with Capacitor to run as an Android APK.
- No backend. All data lives on the device in localStorage — see `src/lib/storage.js`.
  Swapping in a real backend later means replacing that one file, nothing else.
- Full collaboration guide for humans: `COLLABORATION.md`.
