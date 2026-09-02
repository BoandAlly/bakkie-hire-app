# How we work together on the Bakkie app

Two of us build this app. GitHub keeps us in sync. This note is the plain-English "how".

## The big idea

Think of the app as one book everyone shares. That shared book is called **main** — it's the real app.

- We **never** scribble half-done work straight into the real book.
- Instead, each of us photocopies the book (a **branch**), scribbles on our own copy, and only glues the good, finished pages back into the real book when they actually work.

```
main (the real app):  ●────●────●──────────────●
                              \                /
your branch (a copy):          ●──●──●──●──●──┘   (experiment freely,
                                                    glue back in when done)
```

## The everyday habit

**Pull before you start. Push when you finish.**

- **Pull** = grab the other person's latest changes onto your computer.
- **Push** = send your changes up so the other person can pull them.

Nothing syncs by itself. Changes only cross over when someone pushes and the other pulls.

## Working with Claude Code (just say it in plain words)

You don't type git commands — tell your Claude Code chat things like:

- **Start a new piece of work:**
  > "make me a branch called new-map and work on that"
- **Save + share what you've done:**
  > "push my changes"
- **Get the other person's latest:**
  > "pull the latest"
- **Put finished work into the real app:**
  > "merge new-map into main"

## Naming your branches

Name the branch after what you're building, so we can tell at a glance:
`friend-feature`, `fix-login`, `new-map`, `driver-notifications`.

## The one thing to avoid

If we **both** edit the **exact same lines** at the same time, GitHub pauses and asks which version to keep (a "conflict"). Not dangerous, just fiddly.

**How to dodge it:** tell each other what you're working on, and pull before you start.

## First-time setup for a new person

1. Make a free GitHub account: https://github.com/signup — tell Megan your username so she can invite you.
2. Accept the email invite from GitHub.
3. Install git: https://git-scm.com/downloads
4. In Claude Code, say: "clone https://github.com/BoandAlly/bakkie-hire-app.git for me"
5. Sign in to GitHub when it asks (first time only).

That's it — you're now working on the same app.
