# Changesets

Every PR with a user-facing change to a package carries a changeset (`bun run changeset`).
Versions are independent and all 0.x: a breaking change is a **minor**, anything else a
**patch** (PLAN §7). The release workflow turns the accumulated changesets into version bumps
and publishes.
