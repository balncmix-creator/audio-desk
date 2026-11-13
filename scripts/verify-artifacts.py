"""Verify the actual packaged edition, independently of build success."""
import argparse
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument("--apk", type=Path)
parser.add_argument("--bundle", type=Path)
args = parser.parse_args()
if not (args.apk or args.bundle):
    parser.error("provide --apk and/or --bundle")

for archive_path, asset, source, store in [
    (args.apk, "assets/index.html", "app/src/main/assets/index.html", False),
    (args.bundle, "base/assets/index.html", "app/build/generated/playAssets/index.html", True),
]:
    if archive_path is None:
        continue
    with zipfile.ZipFile(archive_path) as archive:
        packaged = archive.read(asset)
    if packaged != (root / source).read_bytes():
        raise SystemExit(f"Wrong edition packaged in {archive_path}")
    if store and re.search(rb"torrent|warez|audioz|rutracker|1337x|keygen|crack", packaged, re.I):
        raise SystemExit("Restricted discovery feature remains in Play bundle")
    print(f"Verified packaged page: {archive_path}")
