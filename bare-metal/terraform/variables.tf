variable "cloud_provider" {
  description = "One of: aws, gcp, hetzner"
  type        = string
  default     = "aws"
}

variable "vm_count" {
  type    = number
  default = 15
}

variable "vm_names" {
  type = list(string)
  default = [
    "api-gateway", "user-service", "course-service", "content-service", "quiz-service",
    "notification-service", "frontend", "postgresql", "mysql", "redis",
    "prometheus", "grafana", "jaeger", "otel-collector", "loki"
  ]
}

variable "ssh_public_key" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "gcp_project" {
  type    = string
  default = ""
}

variable "gcp_region" {
  type    = string
  default = "us-central1"
}

variable "hcloud_token" {
  type      = string
  default   = ""
  sensitive = true
}

variable "subnet_cidr" {
  type    = string
  default = "10.10.0.0/24"
}

variable "aws_vpc_id" {
  type    = string
  default = ""
}
