locals {
  names = slice(var.vm_names, 0, var.vm_count)

  # Render bootstrap script as cloud-init user_data.
  bootstrap_user_data = <<-EOT
    #!/bin/bash
    apt-get update -qq
    apt-get install -y python3 python3-pip curl wget git unzip software-properties-common ufw fail2ban
    useradd -r -s /bin/bash -m -d /opt/edtech edtech || true
    ufw --force enable
    ufw allow 22/tcp
  EOT
}

# AWS example (enable by setting cloud_provider=aws)
resource "aws_security_group" "edtech" {
  count       = var.cloud_provider == "aws" && var.aws_vpc_id != "" ? 1 : 0
  name        = "edtech-bare-metal"
  description = "EdTech bare metal style VM ports"
  vpc_id      = var.aws_vpc_id

  ingress { from_port = 22 to_port = 22 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 80 to_port = 80 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 443 to_port = 443 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 8080 to_port = 8080 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 3000 to_port = 3100 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 4317 to_port = 4318 protocol = "tcp" cidr_blocks = ["0.0.0.0/0"] }
  ingress { from_port = 5432 to_port = 5432 protocol = "tcp" cidr_blocks = [var.subnet_cidr] }
  ingress { from_port = 3306 to_port = 3306 protocol = "tcp" cidr_blocks = [var.subnet_cidr] }
  ingress { from_port = 6379 to_port = 6379 protocol = "tcp" cidr_blocks = [var.subnet_cidr] }
  ingress { from_port = 8001 to_port = 8005 protocol = "tcp" cidr_blocks = [var.subnet_cidr] }
  ingress { from_port = 9100 to_port = 9187 protocol = "tcp" cidr_blocks = [var.subnet_cidr] }

  egress { from_port = 0 to_port = 0 protocol = "-1" cidr_blocks = ["0.0.0.0/0"] }
}

resource "aws_instance" "edtech" {
  for_each      = var.cloud_provider == "aws" ? toset(local.names) : []
  ami           = "ami-053b0d53c279acc90" # Ubuntu 22.04 LTS in us-east-1 (update per region)
  instance_type = var.instance_type
  user_data     = local.bootstrap_user_data
  vpc_security_group_ids = length(aws_security_group.edtech) > 0 ? [aws_security_group.edtech[0].id] : []
  tags = {
    Name = each.value
    Role = "edtech-bare-metal"
  }
}

# GCP example (enable by setting cloud_provider=gcp)
resource "google_compute_instance" "edtech" {
  for_each     = var.cloud_provider == "gcp" ? toset(local.names) : []
  name         = each.value
  machine_type = "e2-standard-2"
  zone         = "${var.gcp_region}-a"

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
    }
  }

  network_interface {
    network = "default"
    access_config {}
  }

  metadata_startup_script = local.bootstrap_user_data
}

# Hetzner example (enable by setting cloud_provider=hetzner)
resource "hcloud_server" "edtech" {
  for_each    = var.cloud_provider == "hetzner" ? toset(local.names) : []
  name        = each.value
  server_type = "cx22"
  image       = "ubuntu-22.04"
  user_data   = local.bootstrap_user_data
}
