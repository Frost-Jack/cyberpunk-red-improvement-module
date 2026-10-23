"""Check release tags and packaged manifests using an isolated build directory."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]


class BuildTests(unittest.TestCase):
    def setUp(self):
        scratch = (ROOT / "dist").resolve()
        scratch.mkdir(exist_ok=True)
        temporary = tempfile.TemporaryDirectory(prefix="build-test-", dir=scratch)
        self.root = Path(temporary.name).resolve()
        self.assertEqual(self.root.parent, scratch)
        self.addCleanup(temporary.cleanup)
        (self.root / "tools").mkdir()
        shutil.copy2(ROOT / "tools/build.py", self.root / "tools/build.py")
        self.source = (ROOT / "module.json").read_text(encoding="utf-8")
        (self.root / "module.json").write_text(self.source, encoding="utf-8")
        self.manifest = json.loads(self.source)
        resources = self.manifest["esmodules"] + self.manifest["styles"]
        resources += [entry["path"] for entry in self.manifest["languages"]]
        for resource in resources + ["README.md", "LICENSE"]:
            target = self.root / resource
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("fixture", encoding="utf-8")

    def build(self, tag=None):
        args = [sys.executable, str(self.root / "tools/build.py")]
        if tag is not None:
            args += ["--tag", tag]
        return subprocess.run(args, capture_output=True, text=True)

    def assert_package(self, tag, version):
        manifest = json.loads((self.root / "dist/module.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["version"], version)
        self.assertEqual(manifest["download"],
                         f"{self.manifest['url']}/releases/download/{tag}/module.zip")
        self.assertEqual(manifest["manifest"], self.manifest["manifest"])
        with ZipFile(self.root / "dist/module.zip") as archive:
            self.assertEqual(json.loads(archive.read("module.json")), manifest)
        self.assertEqual((self.root / "module.json").read_text(encoding="utf-8"), self.source)

    def test_supported_tags(self):
        for tag, version in [
            ("1.0", "1.0.0"), ("v1.0", "1.0.0"),
            ("1.2.3", "1.2.3"), ("v1.2.3", "1.2.3"),
            ("v2.4-rc.1", "2.4.0-rc.1"), ("2.4.1-rc.1", "2.4.1-rc.1")
        ]:
            with self.subTest(tag=tag):
                result = self.build(tag)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assert_package(tag, version)

    def test_default_version(self):
        result = self.build()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_package(f"v{self.manifest['version']}", self.manifest["version"])

    def test_invalid_tags_fail_before_writing_output(self):
        for tag in ["1", "v1", "latest", "1.0.0.0", "1.0/../../bad", "1.0-"]:
            with self.subTest(tag=tag):
                result = self.build(tag)
                self.assertEqual(result.returncode, 2)
                self.assertFalse((self.root / "dist").exists())


if __name__ == "__main__":
    unittest.main()
