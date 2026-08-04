import os
import sys
import subprocess
import yaml

# Determine deployment mode from CLI arguments
mode = "1"
if len(sys.argv) > 1:
    for arg in sys.argv[1:]:
        if arg.startswith("--mode="):
            mode = arg.split("=", 1)[1]

env_vars = {}

# Standard Next.js / GCP production config
env_vars["NODE_ENV"] = "production"
env_vars["LLM_CHAT_PROVIDER"] = "vertex-anthropic"
env_vars["GCP_PROJECT_ID"] = "arslantoor"
env_vars["GCP_REGION"] = "europe-west1"
env_vars["CLAUDE_MODEL"] = "claude-3-5-sonnet-v2@20241022"
env_vars["DATABASE_URL"] = "postgresql://postgres.hoqfpdphunaskywximth:%3FXDZQ_%2Bwf53S%23iH@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

# Dynamic service overrides based on deployment mode
env_vars["SKIP_WEB"] = "0"
if mode == "1":
    env_vars["SKIP_SOCKET"] = "0"
    env_vars["SKIP_QUEUES"] = "0"
    env_vars["SKIP_TEMPORAL"] = "0"
else:
    env_vars["SKIP_SOCKET"] = "1"
    env_vars["SKIP_QUEUES"] = "1"
    env_vars["SKIP_TEMPORAL"] = "1"

# Read local .env file
env_path = "/home/arslan/Documents/Remote/v0-advan/.env"
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            # Ignore empty or commented lines
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                parts = line.split("=", 1)
                if len(parts) == 2:
                    key, val = parts
                    key = key.strip()
                    val = val.strip()
                    # Strip quotes
                    if val.startswith('"') and val.endswith('"'):
                        val = val[1:-1]
                    elif val.startswith("'") and val.endswith("'"):
                        val = val[1:-1]
                    
                    # Exclude local-only or overridden variables
                    if key in [
                        "NODE_ENV", "GCP_PROJECT_ID", "GCP_REGION", "CLAUDE_MODEL", 
                        "NEXTAUTH_URL", "AUTH_URL", "OLLAMA_BASE_URL", 
                        "GOOGLE_APPLICATION_CREDENTIALS", "SKIP_WEB", 
                        "SKIP_SOCKET", "SKIP_QUEUES", "SKIP_TEMPORAL", "DATABASE_URL"
                    ]:
                        continue
                    
                    env_vars[key] = val

# Dynamically fetch the current active service URL from gcloud run services describe
try:
    print("🔍 Fetching active Google Cloud Run service URL...")
    gcloud_cmd = [
        "gcloud", "run", "services", "describe", "advan", 
        "--region=europe-west1", "--format=value(status.url)"
    ]
    res = subprocess.run(gcloud_cmd, capture_output=True, text=True, check=True)
    service_url = res.stdout.strip()
    if not service_url:
        raise ValueError("Empty URL returned by gcloud")
except Exception as e:
    print(f"⚠️ Warning: Could not detect URL automatically ({e}). Falling back to default URL pattern.")
    service_url = "https://advan-53330586668.europe-west1.run.app"

env_vars["NEXTAUTH_URL"] = "https://www.advanai.net"
env_vars["AUTH_URL"] = "https://www.advanai.net"

# Write out YAML config for Cloud Run
yaml_path = "/home/arslan/Documents/Remote/v0-advan/scratch/env.yaml"
os.makedirs(os.path.dirname(yaml_path), exist_ok=True)
with open(yaml_path, "w") as f:
    yaml.dump(env_vars, f, default_flow_style=False)

print(f"✓ Environment YAML generated successfully at: {yaml_path}")
print(f"✓ Configured for Mode {mode} (Web + {'Workers' if mode == '1' else 'Scale-to-Zero'})")
print(f"✓ Authentication Redirect URL configured to: {service_url}")
