"""Verify the actual packaged edition, independently of build success."""
import argparse
from pathlib import Path
import re
import json
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
        prefix = asset.rsplit('/', 1)[0] + '/'
        assets = root / 'app/src/main/assets'
        provenance = json.loads((assets / 'wallpapers/provenance.json').read_text())
        required = ['personalization.js', 'personalization.css', 'wallpapers/catalog.js', 'wallpapers/provenance.json']
        required += [str(p.relative_to(assets)).replace('\\', '/') for p in (assets / 'fonts').glob('*')]
        for record in provenance:
            required += [f"wallpapers/{record['id']}.webp", f"wallpapers/thumbs/{record['id']}.webp"]
        expected_wallpapers = {name for name in required if name.startswith('wallpapers/') and name.endswith('.webp')}
        actual_wallpapers = {name[len(prefix):] for name in archive.namelist()
                             if name.startswith(prefix + 'wallpapers/') and name.endswith('.webp')}
        if actual_wallpapers != expected_wallpapers:
            raise SystemExit('Unexpected or missing wallpaper files packaged in ' + str(archive_path))
        for relative in required:
            if archive.read(prefix + relative) != (assets / relative).read_bytes():
                raise SystemExit(f'Wrong or missing packaged personalization asset: {relative}')
    if packaged != (root / source).read_bytes():
        raise SystemExit(f"Wrong edition packaged in {archive_path}")
    if store and re.search(rb"torrent|warez|audioz|rutracker|1337x|keygen|crack", packaged, re.I):
        raise SystemExit("Restricted discovery feature remains in Play bundle")
    print(f"Verified packaged page: {archive_path}")
