terraform {
  required_version = ">= 1.9"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }

  backend "gcs" {
    bucket = "secretlink-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# --- Variables ---

variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Primary GCP region"
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Environment name"
}

# --- VPC ---

resource "google_compute_network" "vpc" {
  name                    = "secretlink-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "primary" {
  name          = "secretlink-primary"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

# --- Cloud SQL (Postgres) ---

resource "google_sql_database_instance" "postgres" {
  name             = "secretlink-postgres-${var.environment}"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-custom-2-4096"
    availability_type = "REGIONAL"
    disk_type         = "PD_SSD"
    disk_size         = 20

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
    }

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
  }

  deletion_protection = true
}

resource "google_sql_database" "main" {
  name     = "secretlink"
  instance = google_sql_database_instance.postgres.name
}

# --- Memorystore (Redis) ---

resource "google_redis_instance" "secrets" {
  name           = "secretlink-redis-${var.environment}"
  tier           = "STANDARD_HA"
  memory_size_gb = 1
  region         = var.region

  authorized_network = google_compute_network.vpc.id

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}

# --- Cloud Storage ---

resource "google_storage_bucket" "encrypted_blobs" {
  name     = "secretlink-blobs-${var.project_id}"
  location = var.region

  uniform_bucket_level_access = true

  encryption {
    default_kms_key_name = google_kms_crypto_key.secrets.id
  }

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 30
    }
  }

  versioning {
    enabled = false
  }
}

# --- Cloud KMS ---

resource "google_kms_key_ring" "main" {
  name     = "secretlink-keyring"
  location = var.region
}

resource "google_kms_crypto_key" "secrets" {
  name     = "secrets-key"
  key_ring = google_kms_key_ring.main.id

  rotation_period = "7776000s" # 90 days

  lifecycle {
    prevent_destroy = true
  }
}

# --- Artifact Registry ---

resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "secretlink"
  format        = "DOCKER"

  docker_config {
    immutable_tags = true
  }
}

# --- Pub/Sub Topics ---

resource "google_pubsub_topic" "moderation" {
  name = "moderation-events"
}

resource "google_pubsub_topic" "ai_analysis" {
  name = "ai-analysis-events"
}

resource "google_pubsub_topic" "audit" {
  name = "audit-log"
}

resource "google_pubsub_subscription" "moderation_sub" {
  name  = "moderation-sub"
  topic = google_pubsub_topic.moderation.id

  ack_deadline_seconds = 30
  
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

resource "google_pubsub_subscription" "ai_analysis_sub" {
  name  = "ai-analysis-sub"
  topic = google_pubsub_topic.ai_analysis.id

  ack_deadline_seconds = 60

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }
}

# --- Cloud Run Services ---

resource "google_cloud_run_v2_service" "api_gateway" {
  name     = "api-gateway"
  location = var.region

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 100
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/secretlink/api-gateway:latest"

      ports {
        container_port = 4000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
      }
    }

    max_instance_request_concurrency = 80
  }
}

resource "google_cloud_run_v2_service" "web_public" {
  name     = "web-public"
  location = var.region

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 50
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/secretlink/web-public:latest"

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    max_instance_request_concurrency = 200
  }
}

resource "google_cloud_run_v2_service" "web_teams" {
  name     = "web-teams"
  location = var.region

  template {
    scaling {
      min_instance_count = 1
      max_instance_count = 20
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/secretlink/web-teams:latest"

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }
    }

    max_instance_request_concurrency = 80
  }
}

# --- BigQuery (Audit Log) ---

resource "google_bigquery_dataset" "audit" {
  dataset_id = "audit_log"
  location   = var.region

  default_table_expiration_ms = null

  labels = {
    environment = var.environment
  }
}

resource "google_bigquery_table" "events" {
  dataset_id = google_bigquery_dataset.audit.dataset_id
  table_id   = "events"

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  clustering = ["event_type", "workspace_id"]

  schema = jsonencode([
    { name = "id", type = "STRING", mode = "REQUIRED" },
    { name = "event_type", type = "STRING", mode = "REQUIRED" },
    { name = "workspace_id", type = "STRING", mode = "NULLABLE" },
    { name = "actor_hash", type = "STRING", mode = "NULLABLE" },
    { name = "metadata", type = "JSON", mode = "NULLABLE" },
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED" },
  ])
}

# --- Outputs ---

output "api_gateway_url" {
  value = google_cloud_run_v2_service.api_gateway.uri
}

output "web_public_url" {
  value = google_cloud_run_v2_service.web_public.uri
}

output "web_teams_url" {
  value = google_cloud_run_v2_service.web_teams.uri
}

output "redis_host" {
  value     = google_redis_instance.secrets.host
  sensitive = true
}

output "postgres_connection_name" {
  value = google_sql_database_instance.postgres.connection_name
}
