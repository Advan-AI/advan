"""Instantiate a sandbox from the registered E2B template and start the OpenClaw gateway."""

import time
import json
import os
from pathlib import Path
from dotenv import load_dotenv
from e2b import Sandbox

load_dotenv(Path(__file__).resolve().parent / ".env", override=True)

api_key = os.environ["E2B_API_KEY"]
api_url = os.environ["E2B_API_URL"]
domain = os.environ["E2B_DOMAIN"]
openclaw_template = os.environ["E2B_TEMPLATE_ID"]
model_api_key = os.environ["MODEL_API_KEY"]
model_base_url = os.environ["MODEL_BASE_URL"]
model_name = os.environ["MODEL_NAME"]
openclaw_token = os.environ["OPENCLAW_TOKEN"]
sbx_timeout = int(os.environ.get("E2B_TIMEOUT"))
sbx_on_timeout = os.environ.get("E2B_ON_TIMEOUT")

PORT = 18789
TOKEN = openclaw_token

script_start = time.perf_counter()

# 1. Create sandbox
sandbox_start = time.perf_counter()
sandbox = Sandbox.create(
    openclaw_template,
    api_key=api_key,
    api_url=api_url,
    domain=domain,
    timeout=sbx_timeout,
    secure=True,
    lifecycle={
        "on_timeout": sbx_on_timeout,
        "auto_resume": True
        }
)
sandbox_elapsed = time.perf_counter() - sandbox_start
print(f"Sandbox creation time: {sandbox_elapsed:.2f}s")

# 2. Add model provider
wait_start = time.perf_counter()
sandbox.commands.run(
    f"openclaw onboard --non-interactive --accept-risk --skip-health "
    f"--auth-choice custom-api-key "
    f"--custom-compatibility anthropic "
    f"--custom-api-key {model_api_key} "
    f"--custom-base-url {model_base_url} "
    f"--custom-model-id {model_name} "
    f"--custom-provider-id modelstudio-coding",
    timeout=120,
)

# 3. Set default model
sandbox.commands.run(
    f"openclaw config set agents.defaults.model.primary modelstudio-coding/{model_name}"
)

# 4. Configure Control UI
origin = f"https://{sandbox.get_host(PORT)}"
sandbox.commands.run(
    f"openclaw config set gateway.controlUi.allowedOrigins '[\"{origin}\"]'"
)

# 5. Start Gateway
sandbox.commands.run(
    f"bash -lc 'openclaw config set gateway.controlUi.allowInsecureAuth true && "
    f"openclaw config set gateway.controlUi.dangerouslyDisableDeviceAuth true && "
    f"openclaw gateway --allow-unconfigured --bind lan --auth token "
    f"--token {TOKEN} --port {PORT}'",
    background=True,
)

# 6. Wait for Gateway to be ready
for _ in range(45):
    probe = sandbox.commands.run(
        f'bash -lc \'ss -ltn | grep -q ":{PORT} " && echo ready || echo waiting\''
    )
    if probe.stdout.strip() == "ready":
        break
    time.sleep(1)
wait_elapsed = time.perf_counter() - wait_start
print(f"Wait for gateway (port {PORT}) time: {wait_elapsed:.2f}s")

total_elapsed = time.perf_counter() - script_start

url = f"https://{sandbox.get_host(PORT)}/?token={TOKEN}"
print(f"Gateway: {url}")
print(f"Access Token: {sandbox._envd_access_token}")
print(f"Total elapsed time: {total_elapsed:.2f}s")
