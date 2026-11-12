#!/bin/bash
set -euo pipefail
export HOME=/root
TAG="${1:?usage: deploy.sh <git-sha>}"
REGION=ap-south-1

cd /opt/app
git fetch origin main
git checkout -q "$TAG"

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
export ECR_REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
export TAG

DB_PASS=$(aws ssm get-parameter --region $REGION --name /vegah/db_password --with-decryption --query Parameter.Value --output text)
DB_HOST=$(aws ssm get-parameter --region $REGION --name /vegah/db_host --query Parameter.Value --output text)
export DATABASE_URL="postgres://appuser:${DB_PASS}@${DB_HOST}:5432/appdb?sslmode=no-verify"

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin "$ECR_REGISTRY"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
docker compose -f docker-compose.prod.yml ps
