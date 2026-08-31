#!/usr/bin/env python3
"""Confirm that both OCI containers and nginx expose one code/data release."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from urllib.request import urlopen


SERVICES = (("web", "wisor-web"), ("persona", "wisor-persona"))


def get(url: str) -> bytes:
    with urlopen(url, timeout=15) as response:
        if response.status != 200:
            raise SystemExit(f"{url} returned HTTP {response.status}")
        return response.read()


def docker(*args: str) -> str:
    result = subprocess.run(
        ("docker", *args),
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def image_label(reference: str, name: str) -> str:
    return docker(
        "image",
        "inspect",
        "--format",
        f'{{{{ index .Config.Labels "{name}" }}}}',
        reference,
    )


def verify_images(tag: str, code_sha: str | None, data_sha: str | None) -> None:
    expected_labels = {
        "org.opencontainers.image.revision": code_sha,
        "com.wisor.data-sha256": data_sha,
    }
    for service, repository in SERVICES:
        reference = f"{repository}:{tag}"
        for label_name, expected in expected_labels.items():
            if expected is None:
                continue
            actual = image_label(reference, label_name)
            if actual != expected:
                raise SystemExit(
                    f"{service} image label {label_name} is {actual}, expected {expected}"
                )


def verify_container(service: str, repository: str, tag: str) -> None:
    container = docker(
        "compose",
        "--env-file",
        "/etc/wisor/release.env",
        "-f",
        "/opt/wisor/deploy/compose.yaml",
        "ps",
        "-q",
        service,
    )
    if not container:
        raise SystemExit(f"{service} container is not running")

    actual_image = docker("inspect", "--format", "{{.Image}}", container)
    expected_ref = f"{repository}:{tag}"
    expected_image = docker("image", "inspect", "--format", "{{.Id}}", expected_ref)
    if actual_image != expected_image:
        raise SystemExit(
            f"{service} runs {actual_image}, expected {expected_image} ({expected_ref})"
        )

    health = docker(
        "inspect",
        "--format",
        "{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}",
        container,
    )
    if health != "healthy":
        raise SystemExit(f"{service} container health is {health}")


def verify_served_data(service: str, url: str, candidate: dict[str, object]) -> None:
    """Fail unless the running service serves the data release being deployed."""
    served = json.loads(get(url))
    expected = {
        "generatedAt": candidate["generatedAt"],
        "dataSource": candidate["dataSource"],
        "companies": len(candidate["companies"]),
    }
    actual = {key: served.get(key) for key in expected}
    if actual != expected:
        raise SystemExit(
            f"{service} metadata differs: expected={expected}, actual={actual}"
        )


def verify_metadata(scores: Path) -> dict[str, object]:
    candidate = json.loads(scores.read_text(encoding="utf-8"))
    verify_served_data("persona", "http://127.0.0.1:8000/meta", candidate)
    return candidate


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("scores", type=Path)
    parser.add_argument("--tag", required=True)
    # Optional for the first rollout: the previously installed deployer invokes
    # a candidate verifier without this argument.
    parser.add_argument("--code-sha")
    parser.add_argument("--data-sha")
    parser.add_argument("--images-only", action="store_true")
    args = parser.parse_args()

    verify_images(args.tag, args.code_sha, args.data_sha)
    if args.images_only:
        print(f"IMAGES_OK tag={args.tag}")
        return

    candidate = verify_metadata(args.scores)
    for service, repository in SERVICES:
        verify_container(service, repository, args.tag)

    # 화면 HTML의 문구를 찾지 않는다. 문구는 기획에 따라 사라지고, 그때 배포만
    # 조용히 실패한다(2026-08-27·08-28 롤백). 웹이 어느 데이터를 들고 있는지는
    # /api/data-version이 기계가 읽을 형태로 말해 준다.
    verify_served_data("web", "http://127.0.0.1:3000/api/data-version", candidate)
    # 서버 렌더가 죽으면 500이 오므로 get()이 걸러낸다.
    get("http://127.0.0.1:3000/screener/buffett")
    get("http://127.0.0.1/")
    print(
        "LIVE_OK "
        f"tag={args.tag} generatedAt={candidate['generatedAt']} "
        f"companies={len(candidate['companies'])}"
    )


if __name__ == "__main__":
    main()
