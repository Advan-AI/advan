import os
from anthropic import AnthropicVertex

# Use correct credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/home/arslan/Documents/Remote/google_key/gemini-key.json"
PROJECT_ID = "arslantoor"

models = [
    "claude-3-5-sonnet-v2@20241022",
    "claude-3-5-sonnet@20240620",
    "claude-3-5-haiku@20241022",
    "claude-3-haiku@20240307",
    "claude-3-5-sonnet-v2",
    "claude-3-5-sonnet",
    "claude-sonnet-4-6",
    "claude-3-opus@20240229",
    "claude-3-sonnet@20240229",
    "claude-opus-4-7"
]

regions = [
    "global",
    "us-east5",
    "europe-west1",
    "us-central1",
    "us-east1"
]

print("=== Probing ALL Models and Regions with full details ===")

for region in regions:
    print(f"\n--- Region: {region} ---")
    for model in models:
        try:
            client = AnthropicVertex(region=region, project_id=PROJECT_ID)
            client.messages.create(
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
                model=model
            )
            print(f"  [SUCCESS] {model} works perfectly!")
        except Exception as e:
            err_msg = str(e)
            # Check for resource exhausted
            if "RESOURCE_EXHAUSTED" in err_msg or "429" in err_msg:
                print(f"  [429 QUOTA EXHAUSTED] {model} -> supported but no quota")
            else:
                # Print exact first 150 chars of error
                cleaned_err = err_msg.replace("\n", " ").strip()
                print(f"  [ERROR] {model} -> {cleaned_err[:120]}")
