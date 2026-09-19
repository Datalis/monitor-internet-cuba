#!/usr/bin/env bash
#
# Respaldo diario de la base cuba_monitor con rotacion.
#
# Contexto: la BD no tiene TTL a proposito (ver mongo/README.md). Los tests
# crowdsourced no existen en ninguna otra fuente, asi que este respaldo es la
# unica red de seguridad frente a un fallo de disco.
#
# Instalar en cron:
#   30 3 * * * /root/monitor-internet-cuba/scripts/backup-mongo.sh >> /var/log/mongo-backup.log 2>&1
#
# Restaurar:
#   docker compose exec -T mongo mongorestore --archive --gzip --drop < ruta/al/dump.gz

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/root/monitor-internet-cuba}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups/mongo}"
DB_NAME="${DB_NAME:-cuba_monitor}"
KEEP_DAILY="${KEEP_DAILY:-30}"    # dumps diarios a conservar
KEEP_MONTHLY="${KEEP_MONTHLY:-24}" # dumps del dia 1 de cada mes, conservados aparte

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly"
cd "$PROJECT_DIR" || fail "no existe $PROJECT_DIR"

STAMP="$(date -u '+%Y-%m-%d')"
TARGET="$BACKUP_DIR/daily/${DB_NAME}-${STAMP}.archive.gz"
TMP="${TARGET}.partial"

# Espacio libre minimo: 500 MB
AVAIL_KB="$(df -Pk "$BACKUP_DIR" | awk 'NR==2 {print $4}')"
[ "$AVAIL_KB" -gt 512000 ] || fail "espacio insuficiente en $BACKUP_DIR (${AVAIL_KB}KB libres)"

log "volcando $DB_NAME ..."
# El archive sale por stdout; stderr queda en el log. Se escribe a .partial y solo
# se promueve si el gzip es valido, para no dejar nunca un dump corrupto en su sitio.
if ! docker compose exec -T mongo mongodump \
      --db="$DB_NAME" --archive --gzip > "$TMP"; then
  rm -f "$TMP"
  fail "mongodump fallo"
fi

[ -s "$TMP" ] || { rm -f "$TMP"; fail "el dump salio vacio"; }
gzip -t "$TMP" 2>/dev/null || { rm -f "$TMP"; fail "el dump no es un gzip valido"; }

mv -f "$TMP" "$TARGET"
SIZE="$(du -h "$TARGET" | cut -f1)"
log "ok: $TARGET ($SIZE)"

# El dump del dia 1 se copia a monthly/ para conservar historia larga.
if [ "$(date -u '+%d')" = "01" ]; then
  cp -f "$TARGET" "$BACKUP_DIR/monthly/${DB_NAME}-${STAMP}.archive.gz"
  log "copia mensual guardada"
fi

# Rotacion: conservar los N mas recientes de cada carpeta.
rotate() {
  local dir="$1" keep="$2" n
  n="$(find "$dir" -maxdepth 1 -name "${DB_NAME}-*.archive.gz" -type f | wc -l)"
  if [ "$n" -gt "$keep" ]; then
    find "$dir" -maxdepth 1 -name "${DB_NAME}-*.archive.gz" -type f -printf '%T@ %p\n' \
      | sort -n | head -n "$((n - keep))" | cut -d' ' -f2- \
      | while read -r old; do rm -f "$old"; log "rotado: $(basename "$old")"; done
  fi
}
rotate "$BACKUP_DIR/daily" "$KEEP_DAILY"
rotate "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

log "diarios=$(find "$BACKUP_DIR/daily" -name '*.archive.gz' | wc -l) mensuales=$(find "$BACKUP_DIR/monthly" -name '*.archive.gz' | wc -l)"
