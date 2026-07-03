output "vm_names" {
  value = var.vm_names
}

output "aws_public_ips" {
  value       = { for k, v in aws_instance.edtech : k => v.public_ip }
  description = "Use these values with scripts/generate-inventory.sh"
}

output "gcp_public_ips" {
  value       = { for k, v in google_compute_instance.edtech : k => v.network_interface[0].access_config[0].nat_ip }
  description = "Use these values with scripts/generate-inventory.sh"
}

output "hetzner_public_ips" {
  value       = { for k, v in hcloud_server.edtech : k => v.ipv4_address }
  description = "Use these values with scripts/generate-inventory.sh"
}
