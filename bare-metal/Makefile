.PHONY: deploy deploy-service health update lint check-ansible
VAULT_ARGS ?= --ask-vault-pass

deploy:
	ansible-playbook $(VAULT_ARGS) -i inventory.ini ansible/site.yml

deploy-service:
	ansible-playbook $(VAULT_ARGS) -i inventory.ini ansible/site.yml -l $(SERVICE)

health:
	./scripts/health-check-vms.sh

update:
	./scripts/rolling-update.sh $(SERVICE)

lint:
	ansible-lint ansible/site.yml

check-ansible:
	ansible-playbook $(VAULT_ARGS) -i inventory.ini ansible/site.yml --check
