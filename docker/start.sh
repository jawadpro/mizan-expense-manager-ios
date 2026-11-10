#!/bin/sh
# Starts Mizan inside Docker: applies migrations, adds sample data for demos, then serves the app.
# With DEMO_PASSWORD set the demo signs in as DEMO_EMAIL (default demo@mizan.local) with it; without one
# it opens the first-run setup, like a brand-new install.
set -e
node scripts/migrate.mjs
if [ -n "$DEMO_PASSWORD" ]; then node scripts/create-admin.mjs "${DEMO_EMAIL:-demo@mizan.local}" "$DEMO_PASSWORD"; fi
if [ "$SEED_DEMO" = "true" ]; then node scripts/seed-demo.mjs; fi
exec node_modules/.bin/next start -p "${PORT:-3000}" -H 0.0.0.0
