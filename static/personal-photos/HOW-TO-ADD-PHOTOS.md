# How to Add Photos

Simple 3-step process. Works from phone or desktop.

---

## Step 1 — Drop the photo into the right folder

| Folder | What goes here |
|--------|---------------|
| `forest/` | Nature, trees, landscapes — used in Forest Temple blog |
| `matt/` | Personal photos of Matt (create this folder if it doesn't exist) |
| `jewelry/` | Jewelry pieces for the art store (create if needed) |

Just drag the file in. Keep filenames short and lowercase, no spaces:
- Good: `camping-2022.jpg`
- Bad: `My Photo (1).JPEG`

Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`

---

## Step 2 — Add an entry to photo-metadata.json

Open `static/personal-photos/photo-metadata.json` and add your photo under the right section:

```json
"matt": {
  "your-photo-filename.jpg": {
    "caption": "Write your caption here.",
    "year": 2022,
    "tags": ["personal", "outdoors"]
  }
}
```

**Tags to use:**
- Personal photos: `personal`, `outdoors`, `travel`, `music`, `studio`
- Forest photos: `forest`, `trees`, `nature`, `outdoors`
- Jewelry: `jewelry`, `crystals`, `silver`, `rings`, `handmade`

The `year` field is optional for jewelry. Caption and tags are required.

---

## Step 3 — Commit and push

```bash
git add static/personal-photos/
git commit -m "Add photo: your-photo-filename.jpg"
git push
```

From GitHub mobile app: tap the file, tap edit (pencil icon), paste the metadata entry, commit.

That's it. The photo rotator widget picks it up automatically on next page load.

---

## Troubleshooting

- **Photo not showing?** Check the filename in `photo-metadata.json` matches exactly (case-sensitive).
- **Widget shows nothing?** The folder might be empty — that's fine, it hides itself gracefully.
- **Wrong folder?** Move the file and update the JSON key — the section name (`"matt"`, `"forest"`, etc.) must match the subfolder.
