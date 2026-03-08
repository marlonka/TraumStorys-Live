#!/bin/bash
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="us-central1"
SERVICE="traumstorys-live"
SA="traumstorys-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Building and deploying TraumStorys Live ==="

# Build and push container
gcloud builds submit \
  --project "$PROJECT_ID" \
  --tag "gcr.io/${PROJECT_ID}/${SERVICE}" \
  .

# Deploy to Cloud Run
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "gcr.io/${PROJECT_ID}/${SERVICE}" \
  --timeout 3600 \
  --cpu 2 \
  --memory 1Gi \
  --no-cpu-throttling \
  --session-affinity \
  --allow-unauthenticated \
  --concurrency 50 \
  --service-account "$SA" \
  --set-env-vars "GCP_PROJECT_ID=${PROJECT_ID},GCP_REGION=${REGION}"

echo "=== Deployed! ==="
gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format "value(status.url)"
