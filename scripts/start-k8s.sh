#!/bin/bash
set -euo pipefail

ENVIRONMENT=${1:-development}
echo "Deploying EdTech to Kubernetes (env: $ENVIRONMENT)..."

if [ ! -d "k8s/overlays/$ENVIRONMENT" ]; then
    echo "Overlay k8s/overlays/$ENVIRONMENT not found"
    exit 1
fi

kubectl apply -f k8s/namespaces.yaml
kubectl apply -k k8s/overlays/$ENVIRONMENT/

echo "Waiting for deployments..."
kubectl rollout status deployment/api-gateway -n edtech
kubectl rollout status deployment/user-service -n edtech

echo "Deployed successfully!"
kubectl get pods -n edtech
kubectl get pods -n monitoring || true
