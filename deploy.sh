#!/bin/bash
set -eo pipefail

# ──────────────────────────────────────────────────────────────────────
# CONFIGURATION DEFINITIONS
# ──────────────────────────────────────────────────────────────────────
PROJECT_ID="arslantoor"
REGION="us-east5"  # Modify as preferred (e.g., us-central1, us-east1)
SERVICE_NAME="advan-ai"
REPO_NAME="advan-registry"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

echo "======================================================================"
echo "🚀 DEPLOYING ADVAN AI AS AN EXPERT DEVOPS ENGINEER"
echo "======================================================================"
echo "Project ID:   ${PROJECT_ID}"
echo "Region:       ${REGION}"
echo "Service Name: ${SERVICE_NAME}"
echo "======================================================================"

# 1. Ensure the user is authenticated
echo "🔐 Verifying Google Cloud Authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo "❌ No active gcloud account found. Please run: gcloud auth login"
    exit 1
fi

# 2. Set current project
echo "🎯 Setting gcloud project to '${PROJECT_ID}'..."
gcloud config set project "${PROJECT_ID}"

# 3. Enable necessary Google Cloud Services APIs
echo "⚙️ Enabling Google Cloud APIs (Vertex AI, Cloud Run, Artifact Registry, Cloud Build)..."
gcloud services enable \
    aiplatform.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    secretmanager.googleapis.com

# 4. Create Artifact Registry repository if it doesn't exist
echo "📦 Checking Artifact Registry for repository '${REPO_NAME}'..."
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" &>/dev/null; then
    echo "➕ Creating Artifact Registry repository '${REPO_NAME}' in region '${REGION}'..."
    gcloud artifacts repositories create "${REPO_NAME}" \
        --repository-format=docker \
        --location="${REGION}" \
        --description="Docker repository for Advan AI Cloud Run images"
else
    echo "✓ Repository '${REPO_NAME}' already exists."
fi

# 5. Build image in Google Cloud Build (Serverless Build)
echo "🛠️ Building container image using Cloud Build (remote)..."
gcloud builds submit --tag "${IMAGE_NAME}" .

# 6. Interactive / Selectable Deployment Modes
echo "======================================================================"
echo "CHOOSE DEPLOYMENT ARCHITECTURE STRATEGY:"
echo "======================================================================"
echo "1) Monolithic All-in-One Mode (Recommended for general startups)"
echo "   - Next.js Web Server, Socket.IO, BullMQ Queue, & Temporal Workers in ONE container."
echo "   - Requires CPU always allocated and min-instances >= 1 to prevent workers from sleeping."
echo "   - Cost: Fixed monthly baseline (approx. \$30-\$40/mo)."
echo ""
echo "2) Serverless Scale-to-Zero Web-Only Mode"
echo "   - Next.js Web Server only."
echo "   - Background workers (BullMQ, Temporal) and standalone Socket.IO are disabled."
echo "   - Scales down to 0 when idle. CPU allocated only during HTTP requests."
echo "   - Cost: Almost \$0/mo when idle."
echo "======================================================================"
read -p "Select Mode (1 or 2): " DEPLOY_MODE

if [ "$DEPLOY_MODE" == "1" ]; then
    echo "🔥 Configuring Monolithic All-in-One Deployment (Web + Workers)..."
    
    # Generate the environment variables YAML file for Mode 1
    python3 scratch/generate_env_yaml.py --mode=1
    
    # Deploy to Cloud Run with allocated CPU, active min-instances, and loaded environment variables
    gcloud run deploy "${SERVICE_NAME}" \
        --image "${IMAGE_NAME}" \
        --region "${REGION}" \
        --platform managed \
        --allow-unauthenticated \
        --port 3000 \
        --no-cpu-throttling \
        --min-instances=1 \
        --env-vars-file=scratch/env.yaml
else
    echo "❄️ Configuring Serverless Scale-to-Zero Web-Only Deployment..."
    
    # Generate the environment variables YAML file for Mode 2
    python3 scratch/generate_env_yaml.py --mode=2
    
    # Deploy to Cloud Run scaling down to 0, and loaded environment variables
    gcloud run deploy "${SERVICE_NAME}" \
        --image "${IMAGE_NAME}" \
        --region "${REGION}" \
        --platform managed \
        --allow-unauthenticated \
        --port 3000 \
        --cpu-throttling \
        --min-instances=0 \
        --env-vars-file=scratch/env.yaml
fi

echo "======================================================================"
echo "🎉 DEPLOYMENT ACTION COMPLETE!"
echo "======================================================================"
echo "Your Cloud Run service is active."
echo "To run DB Migrations inside your deployed container on the fly, run:"
echo "  gcloud run services proxy ${SERVICE_NAME} --project=${PROJECT_ID}"
echo "======================================================================"
