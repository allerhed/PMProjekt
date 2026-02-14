#!/usr/bin/env bash
# deploy/backup.sh — Database backup to Azure Blob Storage
# Usage: ./backup.sh [retention_days]
# Requires: az CLI authenticated, AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_CONTAINER env vars
set -euo pipefail

RETENTION_DAYS="${1:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="db_backup_${TIMESTAMP}.sql.gz"
CONTAINER="${AZURE_STORAGE_CONTAINER:-files}"
ACCOUNT="${AZURE_STORAGE_ACCOUNT:-taskproofstorage}"
BLOB_PREFIX="backups/"

echo "=== Database Backup to Azure Blob Storage ==="

# Dump and compress
echo "Creating backup: ${BACKUP_FILE}"
docker compose -f /opt/app/docker-compose.prod.yml exec -T database \
  pg_dump -U "${DB_USER:-construction_admin}" "${DB_NAME:-construction_manager}" \
  | gzip > "/tmp/${BACKUP_FILE}"

FILE_SIZE=$(du -h "/tmp/${BACKUP_FILE}" | cut -f1)
echo "Backup size: ${FILE_SIZE}"

# Upload to Azure Blob Storage
echo "Uploading to Azure Blob Storage..."
az storage blob upload \
  --account-name "${ACCOUNT}" \
  --container-name "${CONTAINER}" \
  --name "${BLOB_PREFIX}${BACKUP_FILE}" \
  --file "/tmp/${BACKUP_FILE}" \
  --overwrite

rm "/tmp/${BACKUP_FILE}"
echo "Upload complete: ${BLOB_PREFIX}${BACKUP_FILE}"

# Clean up old backups
echo "Removing backups older than ${RETENTION_DAYS} days..."
CUTOFF_DATE=$(date -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -v-${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%SZ)

az storage blob list \
  --account-name "${ACCOUNT}" \
  --container-name "${CONTAINER}" \
  --prefix "${BLOB_PREFIX}" \
  --query "[?properties.lastModified < '${CUTOFF_DATE}'].name" \
  --output tsv | while IFS= read -r blob; do
    [ -z "$blob" ] && continue
    echo "Deleting old backup: ${blob}"
    az storage blob delete \
      --account-name "${ACCOUNT}" \
      --container-name "${CONTAINER}" \
      --name "${blob}"
done

echo "=== Backup complete ==="
