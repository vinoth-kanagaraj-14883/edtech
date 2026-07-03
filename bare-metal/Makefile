.PHONY: deploy deploy-service health update lint check-ansible

deploy:
ansible-playbook -i inventory.ini ansible/site.yml

deploy-service:
ansible-playbook -i inventory.ini ansible/site.yml -l $(SERVICE)

health:
./scripts/health-check-vms.sh

update:
./scripts/rolling-update.sh $(SERVICE)

lint:
ansible-lint ansible/site.yml

check-ansible:
ansible-playbook -i inventory.ini ansible/site.yml --check
