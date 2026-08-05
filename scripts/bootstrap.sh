#!/usr/bin/env bash
set -Eeuo pipefail

command -v node >/dev/null 2>&1 || {
  echo "Node.js is required."
  exit 1
}

command -v pnpm >/dev/null 2>&1 || {
  echo "pnpm is required."
  exit 1
}

pnpm install --frozen-lockfile
pnpm prisma:generate

cat <<'EOF'
Bootstrap complete.

Next steps:
1. Copy .env.example to .env and fill required values.
2. Start infrastructure with docker compose up -d postgres redis.
3. Run scripts/migrate.sh to apply migrations.
4. Start the app with pnpm start:dev.
EOF
