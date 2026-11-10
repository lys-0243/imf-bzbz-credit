#!/usr/bin/env bash
# Déploie une révision : deploy/deploy.sh [ref]   (défaut : origin/main)
# Exemples : deploy/deploy.sh            → dernière version de main
#            deploy/deploy.sh a1b2c3d    → révision précise (retour arrière)
set -euo pipefail

# Tout est dans main() : bash lit le script en entier avant que
# "git checkout" ne le remplace par sa nouvelle version.
main() {
  local ref="${1:-origin/main}"
  cd /opt/imf
  git fetch --prune origin
  git checkout --force --detach "$ref"
  echo "→ Déploiement de $(git log -1 --format='%h %s')"

  cd deploy
  local api_host
  api_host="$(grep -E '^API_HOST=' .env | cut -d= -f2-)"

  docker compose -f docker-compose.prod.yml build
  docker compose -f docker-compose.prod.yml up -d --remove-orphans

  for _ in $(seq 1 36); do
    if curl -fsS "https://${api_host}/health" >/dev/null 2>&1; then
      echo "✓ API en ligne : https://${api_host}/health"
      docker image prune -f >/dev/null
      return 0
    fi
    sleep 5
  done

  echo "✗ L'API ne répond pas après 3 minutes" >&2
  docker compose -f docker-compose.prod.yml ps
  docker compose -f docker-compose.prod.yml logs --tail=80 migrate api
  return 1
}

main "$@"
exit
