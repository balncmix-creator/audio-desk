"""Import recovered originals; never enlarge or reconstruct the old sprite.

Usage: python scripts/import-wallpapers.py PATH_TO_ORIGINALS
Name each original moonlit-city.png, rainy-neon.png, etc. (see catalog.js).
An original must be at least 1080x1920, portrait, and have visible image detail.
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
       'midnight-studio', 'pastel-sunrise', 'tropical-beach', 'sunset-highway',
       'floating-islands', 'retro-music']


def psnr(a, b):
    rms = ImageStat.Stat(ImageChops.difference(a, b)).rms
    mse = sum(v * v for v in rms) / 3
    return 99 if mse == 0 else 10 * math.log10(255 * 255 / mse)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('originals', type=Path)
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
            if w < 1080 or h < 1920 or w >= h:
                parser.error(f'{source.name}: {w}x{h}; need a real portrait original >=1080x1920. Do not upscale the sprite.')
            image = original.copy()
            image.thumbnail((1440, 3200), Image.Resampling.LANCZOS)
            if image.width < 1080 or image.height < 1920:
                parser.error(f'{source.name}: aspect ratio cannot meet the portrait resolution budget without upscaling')
            target = staged / f'{name}.webp'
            # Lossless retains the exact pixels and usually compresses pixel art well.
            image.save(target, 'WEBP', lossless=True, method=6)
            quality = 'lossless'
            if target.stat().st_size > 1800_000:
                image.save(target, 'WEBP', quality=96, method=6)
                quality = 'q96'
            decoded = Image.open(target).convert('RGB')
            fidelity = psnr(image, decoded)
            if fidelity < 38 or target.stat().st_size > 2500_000:
                parser.error(f'{source.name}: cannot meet quality/size budget (PSNR {fidelity:.1f} dB)')
            # Same crop anchor as object-position:35% center; no distortion.
            thumb = ImageOps.fit(image, (180, 400), Image.Resampling.LANCZOS, centering=(.35, .5))
            thumb_path = staged / 'thumbs' / f'{name}.webp'
            thumb.save(thumb_path, 'WEBP', quality=88, method=6)
            records.append(dict(id=name, sourceName=source.name, sourceSha256=sha(source),
                                sourceWidth=w, sourceHeight=h, width=image.width, height=image.height,
                                sha256=sha(target), thumbnailSha256=sha(thumb_path),
                                encoding=quality, psnr=round(fidelity, 2), cropAnchor=[.35, .5]))
        if sum(p.stat().st_size for p in staged.glob('*.webp')) > 16_000_000:
            parser.error('Pack exceeds the 16 MB compressed wallpaper budget')
        import shutil
        for name in IDS:
            shutil.copy2(staged / f'{name}.webp', out / f'{name}.webp')
            (out / 'thumbs').mkdir(exist_ok=True)
            shutil.copy2(staged / 'thumbs' / f'{name}.webp', out / 'thumbs' / f'{name}.webp')
        (out / 'provenance.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
    print('Imported 10 original portraits and 10 thumbnails; no atlas, no upscaling.')


if __name__ == '__main__':
    main()
