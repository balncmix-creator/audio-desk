"""Import original portraits; never enlarge or reconstruct the old sprite.

Usage: python scripts/import-wallpapers.py PATH_TO_ORIGINALS
Name each original moonlit-city.png, rainy-neon.png, etc. (see catalog.js).
Recovered originals require 1080x1920. Approved newly generated originals require
their complete native 1024x1536 pixels and lossless, unresized output.
Requires Pillow. Sources remain outside the repository; their hashes are recorded.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import tempfile
from PIL import Image, ImageChops, ImageOps, ImageStat

ROOT = Path(__file__).resolve().parent.parent
IDS = ['moonlit-city', 'rainy-neon', 'northern-lights', 'purple-planet',
       'midnight-studio', 'cyberpunk-rooftops', 'cyberpunk-alley',
       'brutalist-concrete', 'brutalist-monolith', 'brutalist-tower',
       'brutalist-stairs', 'brutalist-courtyard', 'brutalist-red',
       'minimal-lunar', 'crt-terminal', 'arcade-afterhours']
POSITIONS = {'moonlit-city': .90, 'purple-planet': .60, 'minimal-lunar': 1.0,
             'crt-terminal': .70, 'arcade-afterhours': .75}


def psnr(a, b):
    rms = ImageStat.Stat(ImageChops.difference(a, b)).rms
    mse = sum(v * v for v in rms) / 3
    return 99 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('originals', type=Path)
    parser.add_argument('--generated', action='store_true', help='User-approved newly generated originals; preserve native pixels losslessly')
    args = parser.parse_args()
    sources = {}
    for name in IDS:
        matches = [p for p in args.originals.iterdir()
                   if p.stem == name and p.suffix.lower() in ('.png', '.webp', '.jpg', '.jpeg')]
        if len(matches) != 1:
            parser.error(f'Expected exactly one original named {name}.png/.jpg/.webp')
        sources[name] = matches[0]
    out = ROOT / 'app/src/main/assets/wallpapers'
    # Stage the whole pack before replacing any existing wallpaper.
    with tempfile.TemporaryDirectory() as temp:
        staged = Path(temp)
        (staged / 'thumbs').mkdir()
        records = []
        for name, source in sources.items():
            original = ImageOps.exif_transpose(Image.open(source)).convert('RGB')
            w, h = original.size
            minimum = (1024, 1536) if args.generated else (1080, 1920)
            if w < minimum[0] or h < minimum[1] or w >= h:
                parser.error(f'{source.name}: {w}x{h}; need a real portrait original >={minimum[0]}x{minimum[1]}. Do not upscale the sprite.')
            image = original.copy()
            if not args.generated:
                image.thumbnail((1440, 3200), Image.Resampling.LANCZOS)
            if image.width < minimum[0] or image.height < minimum[1]:
                parser.error(f'{source.name}: aspect ratio cannot meet the portrait resolution budget without upscaling')
            target = staged / f'{name}.webp'
            # Lossless retains the exact pixels and usually compresses pixel art well.
            image.save(target, 'WEBP', lossless=True, method=6)
            quality = 'lossless'
            if not args.generated and target.stat().st_size > 1800_000:
                image.save(target, 'WEBP', quality=96, method=6)
                quality = 'q96'
            decoded = Image.open(target).convert('RGB')
            fidelity = psnr(image, decoded)
            if fidelity < 38 or target.stat().st_size > 2500_000:
                parser.error(f'{source.name}: cannot meet quality/size budget (PSNR {fidelity:.1f} dB)')
            # Match each portrait's reviewed phone crop; no distortion.
            anchor = POSITIONS.get(name, .35)
            thumb = ImageOps.fit(image, (180, 400), Image.Resampling.LANCZOS, centering=(anchor, .5))
            thumb_path = staged / 'thumbs' / f'{name}.webp'
            thumb.save(thumb_path, 'WEBP', quality=88, method=6)
            records.append(dict(id=name, origin='generated-replacement' if args.generated else 'recovered-original',
                                sourceName=source.name, sourceSha256=sha(source),
                                sourceWidth=w, sourceHeight=h, width=image.width, height=image.height,
                                sha256=sha(target), thumbnailSha256=sha(thumb_path),
                                encoding=quality, psnr=round(fidelity, 2), cropAnchor=[anchor, .5]))
        if sum(p.stat().st_size for p in staged.glob('*.webp')) > len(IDS) * 1600_000:
            parser.error('Pack exceeds the average 1.6 MB per wallpaper compression budget')
        import shutil
        for name in IDS:
            shutil.copy2(staged / f'{name}.webp', out / f'{name}.webp')
            (out / 'thumbs').mkdir(exist_ok=True)
            shutil.copy2(staged / 'thumbs' / f'{name}.webp', out / 'thumbs' / f'{name}.webp')
        (out / 'provenance.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'Imported {len(IDS)} original portraits and {len(IDS)} thumbnails; no atlas, no upscaling.')


if __name__ == '__main__':
    main()
