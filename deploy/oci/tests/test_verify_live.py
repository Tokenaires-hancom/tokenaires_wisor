from __future__ import annotations

import importlib.util
import io
import sys
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).parents[1] / "bin" / "verify-live.py"
SPEC = importlib.util.spec_from_file_location("wisor_verify_live", MODULE_PATH)
assert SPEC and SPEC.loader
verify_live = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verify_live)


class VerifyImagesTests(unittest.TestCase):
    def test_checks_revision_and_data_labels_for_both_images(self) -> None:
        expected = {
            ("wisor-web:tag", "org.opencontainers.image.revision"): "code",
            ("wisor-web:tag", "com.wisor.data-sha256"): "data",
            ("wisor-persona:tag", "org.opencontainers.image.revision"): "code",
            ("wisor-persona:tag", "com.wisor.data-sha256"): "data",
        }

        with patch.object(
            verify_live,
            "image_label",
            side_effect=lambda reference, label: expected[(reference, label)],
        ) as image_label:
            verify_live.verify_images("tag", "code", "data")

        self.assertEqual(image_label.call_count, 4)

    def test_rejects_a_revision_mismatch(self) -> None:
        with patch.object(verify_live, "image_label", return_value="wrong"):
            with self.assertRaisesRegex(SystemExit, "revision"):
                verify_live.verify_images("tag", "code", "data")

    def test_legacy_call_can_omit_revision(self) -> None:
        with patch.object(verify_live, "image_label", return_value="data") as image_label:
            verify_live.verify_images("tag", None, "data")

        self.assertEqual(image_label.call_count, 2)


class VerifyContainerTests(unittest.TestCase):
    def test_requires_a_healthy_container(self) -> None:
        with patch.object(
            verify_live,
            "docker",
            side_effect=["container", "image-id", "image-id", "running"],
        ):
            with self.assertRaisesRegex(SystemExit, "health is running"):
                verify_live.verify_container("web", "wisor-web", "tag")

    def test_accepts_the_expected_healthy_image(self) -> None:
        with patch.object(
            verify_live,
            "docker",
            side_effect=["container", "image-id", "image-id", "healthy"],
        ):
            verify_live.verify_container("web", "wisor-web", "tag")


class ImagesOnlyCliTests(unittest.TestCase):
    def test_images_only_does_not_probe_live_services(self) -> None:
        argv = [
            str(MODULE_PATH),
            "unused-scores.json",
            "--tag",
            "tag",
            "--code-sha",
            "code",
            "--data-sha",
            "data",
            "--images-only",
        ]
        with (
            patch.object(sys, "argv", argv),
            patch.object(verify_live, "verify_images") as verify_images,
            patch.object(verify_live, "verify_metadata") as verify_metadata,
            redirect_stdout(io.StringIO()) as stdout,
        ):
            verify_live.main()

        verify_images.assert_called_once_with("tag", "code", "data")
        verify_metadata.assert_not_called()
        self.assertEqual(stdout.getvalue(), "IMAGES_OK tag=tag\n")


if __name__ == "__main__":
    unittest.main()
