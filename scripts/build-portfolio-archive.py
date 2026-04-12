#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("/tmp/voa_portfolio_import/portfolio")
OUTPUT_ROOT = REPO_ROOT / "static/portfolio/archive"
DATA_FILE = REPO_ROOT / "static/_data/portfolio-pieces.json"

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}


@dataclass
class PieceMeta:
    title: str
    medium: str = ""
    description: str = ""
    context: str = ""


MANUAL_META = {
    "AmethystBliss": PieceMeta(
        title="Amethyst Bliss",
        medium="Sterling Silver · Amethyst",
        description="A faceted amethyst piece with denser wirework and a more ornate, talismanic feel.",
        context="From the Etsy archive.",
    ),
    "Aquamarine": PieceMeta(
        title="Aquamarine, Peridot, and Spinel Pendant",
        medium="Sterling Silver · Aquamarine · Peridot · Spinel",
        description="An elaborate sterling silver composition built around aquamarine with peridot and spinel accents. One of the more time-intensive archival pieces in the collection.",
        context="From the Etsy archive.",
    ),
    "Big Dawg's Amulet": PieceMeta(
        title="Big Dawg's Amulet",
        medium="Sterling Silver · Moldavite · Tanzanite · Herkimer Diamond · Ethiopian Opal · Garnets",
        description="A deeply personal custom amulet made in memory of Matt's brother, preserved here as part of the archival history of the work.",
        context="Personal piece, not part of the Etsy catalog.",
    ),
    "Blue Kyignite": PieceMeta(
        title="Blue Kyanite Pendant",
        medium="Sterling Silver · Blue Kyanite",
        description="A long vertical kyanite piece with a quieter silhouette and a strong electric-blue center stone.",
        context="From the Etsy archive.",
    ),
    "Egyptikai": PieceMeta(
        title="Egyptikai",
        medium="Sterling Silver · Archival Piece",
    ),
    "Ethiopian Opal": PieceMeta(
        title="Ethiopian Opal Ring",
        medium="Sterling Silver · Ethiopian Opal",
        description="A compact sterling silver ring built to let the opal flash do most of the talking.",
        context="From the Etsy archive.",
    ),
    "Flordor": PieceMeta(
        title="Flordor",
        medium="Sterling Silver · Archival Piece",
    ),
    "Kaspywisp": PieceMeta(
        title="Kaspywisp",
        medium="Sterling Silver · Archival Piece",
    ),
    "Labadarone": PieceMeta(
        title="Labadarone",
        medium="Sterling Silver · Labradorite",
        description="A labradorite-forward pendant with an especially luminous blue flash and a calmer, tighter frame.",
        context="Named archival piece.",
    ),
    "Labadripdrop": PieceMeta(
        title="Labadripdrop",
        medium="Sterling Silver · Labradorite",
    ),
    "Labdab": PieceMeta(
        title="Labradorite, Moldavite, and Peridot Pendant",
        medium="Sterling Silver · Labradorite · Moldavite · Peridot",
        description="A sterling silver wrap built around labradorite, moldavite, and peridot with a bright center and a layered silhouette.",
        context="From the Etsy archive.",
    ),
    "Labdortwist": PieceMeta(
        title="Labdortwist",
        medium="Sterling Silver · Labradorite",
    ),
    "Labdper": PieceMeta(
        title="Labdper",
        medium="Sterling Silver · Labradorite · Peridot",
    ),
    "LapisSlapus": PieceMeta(
        title="Lapis Slapus",
        medium="Sterling Silver · Lapis Lazuli",
        description="A sleeker lapis pendant with a simpler sweep and a bold field of blue.",
        context="Named archival piece.",
    ),
    "Malachite Spartan": PieceMeta(
        title="Malachite Spartan",
        medium="Sterling Silver · Malachite",
    ),
    "Malakor": PieceMeta(
        title="Malakor",
        medium="Sterling Silver · Archival Piece",
    ),
    "Moldavite Garnet": PieceMeta(
        title="Moldavite and Garnet Pendant",
        medium="Sterling Silver · Moldavite · Garnet",
        description="A pendant with a darker center stone and a ring of garnet accents that gives the silhouette a strong sense of motion.",
        context="Archival piece.",
    ),
    "Moldavite Ring": PieceMeta(
        title="Moldavite Ring",
        medium="Sterling Silver · Moldavite",
        description="A sculptural sterling silver ring with a raw moldavite center and an intentionally bold wrap.",
        context="From the Etsy archive.",
    ),
    "Moldavite Ring 2": PieceMeta(
        title="Moldavite Ring II",
        medium="Sterling Silver · Moldavite",
    ),
    "Peridot Swirel": PieceMeta(
        title="Peridot Swirel",
        medium="Sterling Silver · Peridot",
    ),
    "RayofGreen": PieceMeta(
        title="Ray of Green",
        medium="Sterling Silver · Green Stone",
    ),
    "Synergy": PieceMeta(
        title="Synergy",
        medium="Sterling Silver · Moldavite · Opal · Aquamarine · Herkimer Quartz · Grape Agate",
        description="A dense, multi-stone statement pendant with a heady composition and a lot of movement in the wirework.",
        context="From the Etsy archive.",
    ),
    "The Mask": PieceMeta(
        title="The Mask",
        medium="Sterling Silver · Quartz · Dark Center Stone",
        description="A more ceremonial, face-like composition with heavy symmetry and a dramatic frontal presence.",
        context="Archival piece outside the standard product naming style.",
    ),
    "Tiger Guy": PieceMeta(
        title="Tiger Guy",
        medium="Sterling Silver · Tiger's Eye · Peridot",
    ),
    "Tormlamin": PieceMeta(
        title="Tormlamin",
        medium="Sterling Silver · Green Tourmaline",
        description="A smaller, quieter pendant built around a single vertical green stone and a fluid outer wrap.",
        context="Named archival piece.",
    ),
    "Tormlasirk": PieceMeta(
        title="Tormlasirk",
        medium="Sterling Silver · Herkimer Quartz · Opal · Lapis · Green Tourmaline",
        description="A tall asymmetrical pendant combining multiple stones in a sharp, directional composition.",
        context="Named archival piece, likely outside the Etsy archive.",
    ),
}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-")


def pretty_title(folder_name: str) -> str:
    spaced = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", folder_name)
    return spaced.replace("  ", " ").strip()


def read_note(folder: Path) -> str:
    note_files = [p for p in folder.iterdir() if p.suffix.lower() in {".rtf", ".txt"}]
    if not note_files:
        return ""
    note = note_files[0]
    try:
        text = subprocess.check_output(
            ["textutil", "-convert", "txt", "-stdout", str(note)],
            text=True,
        )
    except Exception:
        text = note.read_text(errors="ignore")
    return " ".join(text.split())


def load_image(path: Path) -> Image.Image:
    image = Image.open(path)
    image = ImageOps.exif_transpose(image)
    return image.convert("RGB")


def background_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    w, h = rgb.size
    samples = []
    for x in range(w):
        samples.append(rgb.getpixel((x, 0)))
        samples.append(rgb.getpixel((x, h - 1)))
    for y in range(h):
        samples.append(rgb.getpixel((0, y)))
        samples.append(rgb.getpixel((w - 1, y)))
    samples.sort()
    return samples[len(samples) // 2]


def foreground_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    small = image.copy()
    small.thumbnail((480, 480))
    bg = background_color(small)
    bg_img = Image.new("RGB", small.size, bg)
    diff = ImageChops.difference(small, bg_img).convert("L")
    diff = diff.filter(ImageFilter.GaussianBlur(2))
    diff = diff.point(lambda p: 255 if p > 26 else 0)
    bbox = diff.getbbox()
    if not bbox:
        return (0, 0, image.width, image.height)
    sx = image.width / small.width
    sy = image.height / small.height
    left = int(bbox[0] * sx)
    top = int(bbox[1] * sy)
    right = int(bbox[2] * sx)
    bottom = int(bbox[3] * sy)
    return (left, top, right, bottom)


def image_score(path: Path) -> float:
    with load_image(path) as image:
        w, h = image.size
        if w < 140 or h < 140:
            return -999
        bbox = foreground_bbox(image)
        bw = max(1, bbox[2] - bbox[0])
        bh = max(1, bbox[3] - bbox[1])
        area_ratio = (bw * bh) / (w * h)
        center_x = (bbox[0] + bbox[2]) / 2 / w
        center_y = (bbox[1] + bbox[3]) / 2 / h
        center_distance = math.sqrt((center_x - 0.5) ** 2 + (center_y - 0.5) ** 2)
        aspect = h / w

        score = 0.0
        if "75x75" in path.name:
            score -= 25
        if h > w:
            score += 4.5
        elif abs(h - w) < (0.08 * max(w, h)):
            score += 2.6
        else:
            score += 0.6
        if area_ratio > 0.12:
            score += min(area_ratio * 7, 4.5)
        else:
            score -= 1.2
        if 0.95 <= aspect <= 1.65:
            score += 1.8
        score += max(0, 2.5 - center_distance * 8)
        if re.search(r"il_794xN.*(1191|1192|1059)", path.name):
            score += 1.6
        if path.suffix.lower() == ".avif":
            score += 0.2
        return score


def cover_crop(image: Image.Image) -> Image.Image:
    bbox = foreground_bbox(image)
    left, top, right, bottom = bbox
    bw = right - left
    bh = bottom - top
    side = int(max(bw, bh) * 1.38)
    side = min(max(side, min(image.size) // 2), min(image.size))
    cx = (left + right) / 2
    cy = (top + bottom) / 2
    x0 = int(round(cx - side / 2))
    y0 = int(round(cy - side / 2))
    x0 = max(0, min(x0, image.width - side))
    y0 = max(0, min(y0, image.height - side))
    crop = image.crop((x0, y0, x0 + side, y0 + side))
    return crop.resize((1100, 1100), Image.Resampling.LANCZOS)


def save_webp(image: Image.Image, path: Path, *, max_size: int | None = None) -> None:
    output = image.copy()
    if max_size:
        output.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    output.save(path, format="WEBP", quality=86, method=6)


def dedupe_ranked(paths: list[Path]) -> list[Path]:
    seen = set()
    result = []
    for path in paths:
        key = path.stem.replace("-1", "")
        if key in seen:
            continue
        seen.add(key)
        result.append(path)
    return result


def build_piece(folder: Path) -> dict | None:
    images = [p for p in sorted(folder.iterdir()) if p.suffix.lower() in IMAGE_EXTS]
    images = [p for p in images if "75x75" not in p.name]
    if not images:
        return None

    meta = MANUAL_META.get(folder.name, PieceMeta(title=pretty_title(folder.name)))
    note_text = read_note(folder)
    if not meta.description and note_text:
        meta = PieceMeta(
            title=meta.title,
            medium=meta.medium,
            description=note_text[:220].rsplit(" ", 1)[0] + "…" if len(note_text) > 220 else note_text,
            context=meta.context,
        )

    ranked = sorted(images, key=image_score, reverse=True)
    ranked = dedupe_ranked(ranked)
    gallery_sources = ranked[: min(3, len(ranked))]
    cover_source = gallery_sources[0]

    slug = slugify(folder.name)
    out_dir = OUTPUT_ROOT / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    with load_image(cover_source) as cover_image:
        cover = cover_crop(cover_image)
        save_webp(cover, out_dir / "cover.webp")

    gallery_paths = []
    for index, src in enumerate(gallery_sources, start=1):
        with load_image(src) as gallery_image:
            save_webp(gallery_image, out_dir / f"image-{index}.webp", max_size=1800)
        gallery_paths.append(f"/portfolio/archive/{slug}/image-{index}.webp")

    return {
        "slug": slug,
        "title": meta.title,
        "medium": meta.medium,
        "description": meta.description,
        "context": meta.context,
        "cover_image": f"/portfolio/archive/{slug}/cover.webp",
        "images": gallery_paths,
    }


def main() -> None:
    if not DEFAULT_SOURCE.exists():
        raise SystemExit(f"Source directory not found: {DEFAULT_SOURCE}")

    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    pieces = []
    for folder in sorted([p for p in DEFAULT_SOURCE.iterdir() if p.is_dir()]):
        piece = build_piece(folder)
        if piece:
            pieces.append(piece)

    DATA_FILE.write_text(json.dumps(pieces, indent=2) + "\n")
    print(f"Built {len(pieces)} portfolio pieces")


if __name__ == "__main__":
    main()
