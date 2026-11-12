#!/bin/bash
set -euo pipefail
export HOME=/root
REGION=ap-south-1
STATE=/opt/.vegah_deployed_tag   # last known-good SHA

deploy_tag() {
  local TAG="$1"
  cd /opt/app
  git fetch -q origin main
  git checkout -q -f "$TAG"

  local ACCOUNT
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  export ECR_REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
  export TAG

  local DB_PASS DB_HOST
  DB_PASS=$(aws ssm get-parameter --region $REGION --name /vegah/db_password --with-decryption --query Parameter.Value --output text)
  DB_HOST=$(aws ssm get-parameter --region $REGION --name /vegah/db_host --query Parameter.Value --output text)
  export DATABASE_URL="postgres://appuser:${DB_PASS}@${DB_HOST}:5432/appdb?sslmode=no-verify"

  aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ECR_REGISTRY"
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
}

health() {
  for i in $(seq 1 30); do
    if curl -fsS --max-time 5 http://localhost/api/health >/dev/null 2>&1; then
      return 0
    fi
    echo "waiting for health ($i/30)..."
    sleep 5
  done
  return 1
}

main() {
  local TAG="${1:?usage: deploy.sh <git-sha>}"
  local PREV=""
  [ -f "$STATE" ] && PREV=$(cat "$STATE") || true
  echo "Deploying $TAG (previous good: ${PREV:-none})"

  deploy_tag "$TAG"

  if health; then
    echo "$TAG" > "$STATE"
    docker compose -f /opt/app/docker-compose.prod.yml ps
    echo "DEPLOY OK: $TAG"
    return 0
  fi

  echo "HEALTH CHECK FAILED for $TAG"
  docker compose -f /opt/app/docker-compose.prod.yml logs --tail 30 backend || true
  if [ -n "$PREV" ] && [ "$PREV" != "$TAG" ]; then
    echo "ROLLING BACK to $PREV"
    deploy_tag "$PREV"
    if health; then echo "ROLLBACK OK: serving $PREV"; else echo "ROLLBACK ALSO UNHEALTHY"; fi
  else
    echo "No previous good version recorded, cannot roll back"
  fi
  return 1
}

main "$@"; exit $?
