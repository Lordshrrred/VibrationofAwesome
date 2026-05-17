# scripts/archive/

One-off migration and backfill scripts that have already done their job. Kept here for reference but not part of the active pipeline. Do not run these unless you know exactly why.

| Script | What it did | Why archived |
|---|---|---|
| `rename-boombot.js` | Renamed all "boombot" references to "boom" in HTML/layouts | Rename is complete |
| `fix-archive-posts.js` | Removed legacy Google+/WordPress share widgets | Widgets are gone |
| `fix-archive-dates.js` | Corrected date metadata in archive post HTML | Dates are correct |
| `fix-share-widgets.js` | Fixed share widget HTML across posts | Widgets are fixed |
| `fix-titles.js` | Mass-corrected title formatting in HTML | Titles are correct |
| `add-archive-links.js` | Injected internal archive nav links | Links are in |
| `add-archive-og-images.js` | Backfilled OG image tags in legacy archive | OG tags are in |
| `normalize-archive-metadata.js` | Standardized legacy canonical paths | Paths are normalized |
| `update-archive-images.js` | Replaced image paths in archive HTML | Images are updated |
| `update-signatures.js` | Removed legacy WordPress comment artifacts | Artifacts are gone |
| `inject-blog-nav.js` | Added full site nav to all blog post HTML | Nav is in templates now |
| `pinterest-standard-access-demo.js` | OAuth demo for direct Pinterest API | Pinterest uses Publer now |
