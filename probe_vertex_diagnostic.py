import os
import sys
from anthropic import AnthropicVertex

def load_env_file(path=".env"):
    if os.path.exists(path):
        with open(path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    os.environ[key] = val

load_env_file(".env")
load_env_file(".env.local")

PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "arslantoor")
CREDENTIALS_PATH = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "/home/arslan/Documents/Remote/google_key/arslantoor-34aebe438e69.json")

# Ensure correct path is loaded into the env
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = CREDENTIALS_PATH

models = [
    "claude-3-5-sonnet-v2@20241022",
    "claude-3-5-sonnet@20240620",
    "claude-3-5-haiku@20241022",
    "claude-3-haiku@20240307"
]

regions = [
    "global",
    "us-east5",
    "europe-west1",
    "us-central1",
    "us-east1"
]

print("=== Starting Vertex AI Active Model & Region Diagnostic Probe ===")
print(f"Project ID: {PROJECT_ID}")
print(f"Credentials File: {CREDENTIALS_PATH}")
print("-" * 60)

for region in regions:
    print(f"\nProbing region: {region}")
    for model in models:
        try:
            client = AnthropicVertex(region=region, project_id=PROJECT_ID)
            # Send a tiny request to probe availability and quota
            client.messages.create(
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
                model=model
            )
            print(f"  [SUCCESS] {model} is fully working and available with active quota!")
        except Exception as e:
            err_msg = str(e)
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                print(f"  [QUOTA EXHAUSTED (429)] {model} is supported but has 0/exhausted active token/request quota.")
            elif "NOT_FOUND" in err_msg or "404" in err_msg or "not servable" in err_msg:
                print(f"  [NOT SUPPORTED (404)] {model} is not enabled/supported in this region.")
            else:
                print(f"  [ERROR] {model} returned: {err_msg[:120]}...")

print("\n=== Probe Complete ===")
