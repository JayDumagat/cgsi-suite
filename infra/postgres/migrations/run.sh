#!/bin/sh
set -eu

: "${PGHOST:=postgres}"
: "${PGPORT:=5432}"
: "${PGDATABASE:=cgsi}"
: "${PGUSER:=cgsi_admin}"
: "${PGPASSWORD:?POSTGRES_PASSWORD is required for migrations}"
: "${IDENTITY_DB_PASSWORD:?IDENTITY_DB_PASSWORD is required for migrations}"

export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD

psql --no-psqlrc --set=ON_ERROR_STOP=1 --quiet <<'SQL'
CREATE SCHEMA IF NOT EXISTS platform;
CREATE TABLE IF NOT EXISTS platform.schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
SQL

for migration in /migrations/[0-9][0-9][0-9]_*.sql; do
  [ -f "$migration" ] || continue
  filename=${migration##*/}
  version=${filename%.sql}
  case "$version" in
    [0-9][0-9][0-9]_[a-z0-9_]*) ;;
    *) printf 'Invalid migration filename: %s\n' "$filename" >&2; exit 1 ;;
  esac

  applied=$(psql --no-psqlrc --tuples-only --no-align --set=ON_ERROR_STOP=1 \
    --command="SELECT EXISTS (SELECT 1 FROM platform.schema_migrations WHERE version = '$version')")
  if [ "$applied" = "t" ]; then
    printf 'Migration %s already applied\n' "$version"
    continue
  fi

  printf 'Applying migration %s\n' "$version"
  combined=/tmp/cgsi-migration.sql
  umask 077
  {
    printf 'SELECT pg_advisory_xact_lock(714299180, 1);\n'
    cat "$migration"
    printf '\nINSERT INTO platform.schema_migrations (version) VALUES (\047%s\047);\n' "$version"
  } > "$combined"
  psql --no-psqlrc --single-transaction --set=ON_ERROR_STOP=1 \
    --set="identity_db_password=$IDENTITY_DB_PASSWORD" --file="$combined"
  rm -f "$combined"
done

printf 'PostgreSQL migrations complete\n'
