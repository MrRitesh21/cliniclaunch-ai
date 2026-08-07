#!/usr/bin/env sh
# Renders Prometheus + Alertmanager configs from .env.
# Neither tool expands ${VARS} in its own config file, so we do it here and
# mount the generated output read-only. Generated files are gitignored and
# contain secrets — never commit them.
set -eu

cd "$(dirname "$0")/.."

[ -f .env ] || { echo "monitoring/.env is missing (copy .env.example)" >&2; exit 1; }

# shellcheck disable=SC1091
set -a; . ./.env; set +a

: "${BACKEND_METRICS_HOST:?set BACKEND_METRICS_HOST in .env}"
: "${METRICS_TOKEN:?set METRICS_TOKEN in .env}"
: "${DISCORD_WEBHOOK_URL:?set DISCORD_WEBHOOK_URL in .env}"

mkdir -p generated

command -v envsubst >/dev/null 2>&1 || {
  echo "envsubst not found — install gettext (apk add gettext / apt-get install gettext-base)" >&2
  exit 1
}

envsubst < prometheus/prometheus.yml.tpl   > generated/prometheus.yml
envsubst < alertmanager/alertmanager.yml.tpl > generated/alertmanager.yml

# Prometheus reads the scrape credential from a file, not from the config body.
printf '%s' "$METRICS_TOKEN" > generated/metrics_token
chmod 600 generated/metrics_token

echo "rendered:"
echo "  generated/prometheus.yml"
echo "  generated/alertmanager.yml"
echo "  generated/metrics_token"
