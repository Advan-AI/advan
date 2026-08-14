from __future__ import annotations

import argparse
import logging
import os
import time
import uuid
from pathlib import Path

from dotenv import load_dotenv
from e2b import Template, default_build_logger
from e2b.exceptions import AuthenticationException


LOGGER = logging.getLogger("build_template")
PROJECT_DIR = Path(__file__).resolve().parent


def required_env(name: str) -> str:
    """Return a required environment variable without exposing its value."""
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def load_environment() -> None:
    """Load the controller configuration from the project-root .env file."""
    load_dotenv(PROJECT_DIR / ".env", override=True)


def build_openclaw_template() -> str:
    """Build a Builder-mode E2B template from E2B_TEMPLATE_IMAGE."""
    image = required_env("E2B_TEMPLATE_IMAGE")
    api_key = required_env("E2B_API_KEY")
    headers = {"X-E2B-Template-Build-Mode": "direct"}
    username = os.environ.get("E2B_TEMPLATE_SOURCE_USERNAME", "").strip()
    password = os.environ.get("E2B_TEMPLATE_SOURCE_PASSWORD", "").strip()
    if username or password:
        if not username or not password:
            raise RuntimeError(
                "Set both E2B_TEMPLATE_SOURCE_USERNAME and E2B_TEMPLATE_SOURCE_PASSWORD"
            )
        headers = {
            "X-E2B-Template-Source-Username": username,
            "X-E2B-Template-Source-Password": password,
        }

    build_kwargs = {
        "cpu_count": int(os.getenv("E2B_TEMPLATE_CPU", "2")),
        "memory_mb": int(os.getenv("E2B_TEMPLATE_MEMORY_MB", "2048")),
        "api_key": api_key,
        "api_url": required_env("E2B_API_URL"),
        "domain": required_env("E2B_DOMAIN"),
        "on_build_logs": default_build_logger(),
    }
    if headers:
        build_kwargs["headers"] = headers
    name = f"openclaw-agent-{int(time.time())}-{uuid.uuid4().hex[:8]}"
    LOGGER.info("[template] building from image=%s", image)
    try:
        build = Template.build(
            Template().from_image(image), name=name, **build_kwargs
        )
    except AuthenticationException as exc:
        raise RuntimeError(
            "E2B Template Build authentication failed. Verify that E2B_API_KEY is valid "
            "for E2B_API_URL and has Template Build permission; the key value is not logged."
        ) from exc
    template_id = getattr(build, "template_id", None) or build.name
    LOGGER.info("[template] ready template=%s", template_id)
    return template_id


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build an E2B openclaw template from E2B_TEMPLATE_IMAGE"
    )
    parser.parse_args()

    # 1. Configure basic logging for YOUR application (keep INFO)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s"
    )

    # 2. Suppress verbose HTTP logs from underlying libraries (httpx/urllib3)
    # This stops the "Request GET...", "Response 200..." messages
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("e2b").setLevel(logging.WARNING)  # Optional: suppress e2b internal logs if too noisy

    load_environment()
    print(f"E2B_TEMPLATE_ID={build_openclaw_template()}")


if __name__ == "__main__":
    main()

