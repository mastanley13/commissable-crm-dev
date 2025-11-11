#!/usr/bin/env bash
set -euo pipefail

# Requires: pg_dump, pg_restore, psql
# Usage:
#   bash scripts/clone_prod_to_staging.sh \
#     --prod "$PROD_URL" \
#     --staging-admin "$STAGING_ADMIN_URL" \
#     --db commissable_crm_staging \
#     --user commissable_staging \
#     --pass '<strong-password>' \
#     --out backups/backup_$(date +%Y%m%d_%H%M)_prod.dump

PROD_URL=""
STAGING_ADMIN=""
DB_NAME="commissable_crm_staging"
APP_USER="commissable_staging"
APP_PASS=""
OUT_FILE="backups/backup_$(date +%Y%m%d_%H%M)_prod.dump"
DROP_EXISTING=false
SKIP_CREATE_USER=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod) PROD_URL="$2"; shift 2;;
    --staging-admin) STAGING_ADMIN="$2"; shift 2;;
    --db) DB_NAME="$2"; shift 2;;
    --user) APP_USER="$2"; shift 2;;
    --pass) APP_PASS="$2"; shift 2;;
    --out) OUT_FILE="$2"; shift 2;;
    --drop-existing) DROP_EXISTING=true; shift;;
    --skip-create-user) SKIP_CREATE_USER=true; shift;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

mkdir -p "$(dirname "$OUT_FILE")"

echo "[1/5] Backing up prod -> $OUT_FILE"
pg_dump "$PROD_URL" --format=custom --no-owner --no-privileges --file="$OUT_FILE"

echo "[2/5] Creating staging database: $DB_NAME"
[[ "$DROP_EXISTING" == true ]] && psql "$STAGING_ADMIN" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
psql "$STAGING_ADMIN" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\" WITH TEMPLATE template0 ENCODING 'UTF8';"

if [[ "$SKIP_CREATE_USER" != true ]]; then
  echo "[3/5] Ensuring staging app user exists + privileges"
  psql "$STAGING_ADMIN" -v ON_ERROR_STOP=1 <<SQL
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN
    EXECUTE format('CREATE USER %I WITH PASSWORD %L', '$APP_USER', '$APP_PASS');
  END IF;
END$$;
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$APP_USER";
SQL
fi

echo "[4/5] Restoring backup into staging"
STAGING_DB_URL="${STAGING_ADMIN%/}/$DB_NAME"
STAGING_DB_URL="${STAGING_DB_URL/postgres:\/\//postgresql://}"
pg_restore --dbname="$STAGING_DB_URL" --clean --if-exists --no-owner --no-privileges "$OUT_FILE"

echo "[5/5] Done. Example .env.local entries:"
echo "DATABASE_URL=postgresql://$APP_USER:$APP_PASS@<staging-host>:5432/$DB_NAME"
echo "DIRECT_URL=postgresql://$APP_USER:$APP_PASS@<staging-host>:5432/$DB_NAME"

