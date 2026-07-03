.PHONY: k8s-install k8s-apm-patch k8s-uninstall k8s-verify bare-metal-install bare-metal-verify help

DEVICE_KEY  ?= $(error Set DEVICE_KEY=your_site24x7_device_key)
NAMESPACE   := site24x7-monitoring
INVENTORY   ?= ../bare-metal/inventory.ini

help:
	@echo "Site24x7 Observability - Available targets:"
	@echo ""
	@echo "  Kubernetes:"
	@echo "    make k8s-install     DEVICE_KEY=xxx   Install Site24x7 server agent on K8s"
	@echo "    make k8s-apm-patch   DEVICE_KEY=xxx   Apply APM patches to edtech deployments"
	@echo "    make k8s-uninstall                    Remove Site24x7 from Kubernetes"
	@echo "    make k8s-verify                       Check agent pod status in K8s"
	@echo ""
	@echo "  Bare Metal:"
	@echo "    make bare-metal-install DEVICE_KEY=xxx INVENTORY=path/to/inventory.ini"
	@echo "    make bare-metal-verify  INVENTORY=path/to/inventory.ini"
	@echo ""
	@echo "  Example:"
	@echo "    make k8s-install DEVICE_KEY=abc123xyz"

k8s-install:
	@echo "Creating namespace $(NAMESPACE)..."
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "Creating device key secret..."
	kubectl create secret generic site24x7-device-key \
	  --from-literal=device-key=$(DEVICE_KEY) \
	  --namespace=$(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -
	@echo "Deploying RBAC resources..."
	kubectl apply -f kubernetes/server-agent/site24x7-agent-serviceaccount.yaml
	kubectl apply -f kubernetes/server-agent/site24x7-agent-clusterrole.yaml
	kubectl apply -f kubernetes/server-agent/site24x7-agent-configmap.yaml
	@echo "Deploying DaemonSet..."
	kubectl apply -f kubernetes/server-agent/site24x7-agent-daemonset.yaml
	@echo "Deploying APM init configmap..."
	kubectl apply -f kubernetes/apm-init-configmap.yaml
	@echo ""
	@echo "✅ Site24x7 agents deployed to namespace $(NAMESPACE)."
	@echo "   Check the Site24x7 portal in 2-3 minutes."

k8s-apm-patch:
	@echo "Applying APM patches to edtech namespace deployments..."
	kubectl apply -k kubernetes/patch-examples/
	@echo "✅ APM patches applied. Pods will restart with APM env vars."

k8s-uninstall:
	@echo "Removing APM patches..."
	-kubectl delete -k kubernetes/patch-examples/ --ignore-not-found
	@echo "Removing site24x7-monitoring namespace (includes DaemonSet, RBAC)..."
	kubectl delete namespace $(NAMESPACE) --ignore-not-found
	@echo "Removing ClusterRole and ClusterRoleBinding (cluster-scoped)..."
	-kubectl delete clusterrole site24x7-agent --ignore-not-found
	-kubectl delete clusterrolebinding site24x7-agent --ignore-not-found
	@echo "✅ Site24x7 removed from Kubernetes."

k8s-verify:
	@echo "=== DaemonSet status ==="
	kubectl get daemonset site24x7-server-agent -n $(NAMESPACE) 2>/dev/null || \
	  echo "DaemonSet not found — run: make k8s-install DEVICE_KEY=xxx"
	@echo ""
	@echo "=== Agent pods ==="
	kubectl get pods -n $(NAMESPACE) -l app=site24x7-server-agent -o wide 2>/dev/null || true
	@echo ""
	@echo "=== APM patches status ==="
	kubectl get deployments -n edtech 2>/dev/null | head -20 || true

bare-metal-install:
	@echo "Running Site24x7 Ansible playbook..."
	cd bare-metal && ansible-playbook -i $(INVENTORY) ansible/site24x7.yml \
	  -e "site24x7_device_key=$(DEVICE_KEY)"
	@echo "✅ Site24x7 agents installed on all hosts."

bare-metal-verify:
	@echo "Verifying Site24x7 agents on all hosts..."
	./bare-metal/scripts/verify-agents.sh $(INVENTORY)
