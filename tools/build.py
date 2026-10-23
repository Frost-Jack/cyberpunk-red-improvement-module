"""Build the same installable release locally and in GitHub Actions (no dependencies)."""
import argparse
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--tag", help="Release tag, e.g. 1.0 or v1.0.0; defaults to the manifest version")
args = parser.parse_args()
manifest = json.loads((ROOT / "module.json").read_text(encoding="utf-8"))
tag = args.tag or f"v{manifest['version']}"
version = tag.removeprefix("v")
manifest["version"] = version
manifest["download"] = f"{manifest['url']}/releases/download/{tag}/module.zip"

files = [ROOT / "README.md", ROOT / "LICENSE"]
for directory in ("scripts", "styles", "languages"):
    files.extend(sorted((ROOT / directory).rglob("*.*")))
for path in manifest["esmodules"] + manifest["styles"] + [lang["path"] for lang in manifest["languages"]]:
    if not (ROOT / path).is_file():
        raise SystemExit(f"Missing manifest resource: {path}")

output = ROOT / "dist"
output.mkdir(exist_ok=True)
text = json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"
(output / "module.json").write_text(text, encoding="utf-8")
with ZipFile(output / "module.zip", "w", ZIP_DEFLATED) as archive:
    archive.writestr("module.json", text)
    for path in files:
        archive.write(path, path.relative_to(ROOT).as_posix())
print(f"Built {manifest['id']} {version}: dist/module.json, dist/module.zip")
