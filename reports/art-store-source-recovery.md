# EarthStar Art Store Source Recovery

Recovered from the signed-in Spring listings dashboard on 2026-09-29. No live listings or storefront pages were changed.

Master folder: `/Users/matt/Documents/EarthStar Art Store Masters/recovered-from-spring/`

## Current storefront designs

| Design | Recovered source | Size | Initial classification |
| --- | --- | ---: | --- |
| Abstratocaster | `abstratocaster-sticker.png` | 4500x5400 | Standalone art candidate |
| Wiz Biz | `wiz-biz-sticker.png` | 4060x5684 | Standalone art candidate |
| ADHD Higher Dimension | `adhd-higher-dimension-mug-wrap.png` | 10800x4500 | Product-specific mug wrap; extract or recover standalone art |
| Uncontrollably Awesome | `uncontrollably-awesome.png` | 10800x4500 | Product-specific mug wrap; extract or recover standalone art |
| Vibration of Awesome Spiral | `vibration-of-awesome-spiral.png` | 5400x5400 | Standalone transparent art candidate |
| Wizard in the Window | `wizard-in-the-window-sticker.png` | 4060x5684 | Standalone art candidate |
| Ascent EarthStar | `ascent-earthstar-front.png`, `ascent-earthstar-wordmark.png` | 4500x5400, 2172x724 | Front art plus separate wordmark |
| Loaf Life | `loaf-life-sticker.png` | 4500x5400 | Standalone art candidate |

Every file reports an alpha channel, but transparency and edge quality still need pixel-level validation. An alpha channel alone does not prove the visible background is transparent.

## What this changes

- All eight current design worlds now have a recoverable high-resolution source in local custody.
- Existing art does not need to be blindly regenerated.
- The two 10800x4500 mug wraps must not be treated as canonical reusable masters.
- The first pilot should prove the full flow: source audit, print-safe export, private Spring listing, mockup review, and isolated `/art-store-v2/` catalog entry.

## Recommended pilot

Use **Vibration of Awesome Spiral** first. It is square, high resolution, visually simple, and the easiest source for validating transparency, print sizing, color handling, automated listing creation, and storefront ingestion without mixing in generated typography.
