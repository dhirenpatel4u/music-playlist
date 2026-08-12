# बस वाला Bus Wala — Horn OK Please

A bus-themed clone of [hornokplease.xyz](https://hornokplease.xyz/) (Truck Wala).
Non-stop 90s Bollywood highway bangers — the songs that blast out of Indian
buses. Same design, same player, same 52-song playlist; the truck is now a bus.

## Files

| Path | What it is |
|---|---|
| `index.html` | The page — meta tags, wordmark, player chrome |
| `styles.css` | All styling (glass player, animations, responsive) |
| `app.js` | Player logic — YouTube iframe, playlist, horn, bumper lines |
| `tracks.json` | The 52-track playlist (YouTube video IDs + cover art) |
| `assets/bg-1.*`, `assets/bg-2.*` | Background artwork (AI-repainted with a bus) |
| `assets/opengraph.jpg` | Link-preview image (बस वाला) |
| `assets/favicon.svg` | Favicon |
| `assets/horn.mp3` | Horn sound for the honk button |

## Run it

Any static file server works — the app fetches `tracks.json`, so it needs to
be served over HTTP (opening `index.html` directly from disk won't load the
playlist):

```bash
cd bus-wala
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy notes

- Before deploying, make `og:image` / `twitter:image` absolute URLs and add
  `og:url` + `<link rel="canonical">` with your domain — link previews ignore
  relative URLs.
- Sound comes from a hidden YouTube iframe, so playback needs network access
  to YouTube.

## What changed vs the original

- ट्रक वाला → बस वाला wordmark; all "Truck Wala" / truck copy → "Bus Wala" / bus
- Backgrounds and OG image repainted with an Indian coach bus (same style)
- Bumper lines: `ट्रक` line swapped to बस, plus two bus lines
  (लोकल बस है…, छत पर सवारी बैठना मना है)
- The original site's Google Analytics tag was removed
