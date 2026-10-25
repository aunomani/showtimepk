# ShowtimePK

Movie showtimes for cinemas in Karachi, Lahore and Islamabad/Rawalpindi:
Nueplex, Cinepax, The Arena, Raiha CineGold and CineStar.

## How it works

```
GitHub Actions (every 12 h) ──► scripts/scrape.ts
     │   fetches all 5 cinema websites, cleans movie names,
     │   adds posters/trailers from TMDB
     ▼
public/data/*.json  ──(commit)──►  Netlify rebuilds  ──►  website
                                        ▲
Google Sheet ── prices, ratings, coming soon list, and Sheet1 as a manual fallback
```

No server, no AI, no paid services. Everything runs on free tiers.

| File | What it is |
|---|---|
| `scripts/scrape.ts` | Runs every scraper and writes the data files |
| `scripts/scrapers/*.ts` | One file per cinema chain |
| `src/lib/titles.ts` | Movie name clean-up rules ("Clayface- 2D English" → "Clayface") |
| `config/title-aliases.json` | Your own name fixes, for anything the rules get wrong |
| `public/data/` | Generated data the website loads (don't edit by hand) |
| `data/tmdb-cache.json` | Saved TMDB results so movies aren't looked up every run |
| `.github/workflows/update-showtimes.yml` | The 12-hour schedule |

## Everyday use

- **Nothing to do.** Data refreshes at about 6 AM and 6 PM Pakistan time.
- **Update right now:** GitHub → **Actions** → **Update showtimes** → **Run workflow**.
- **A movie name looks wrong or appears twice:** add a line to `config/title-aliases.json` on GitHub.
- **A cinema stopped working:** open the site with `?admin=true` to see which one failed.
  Paste that cinema's data in the admin panel, click **Copy All Shows for Sheet1**, paste it into Sheet1,
  then run the workflow. Cinemas that fail use Sheet1 rows; if Sheet1 has none, they keep their last good data.
- **Coming soon:** edit the `coming soon` tab in the Google Sheet
  (column A = movie name, B = IMDb ID such as `tt1234567` (optional), C = release date text).
- **Prices / ratings:** edit the `prices` and `rtings` tabs as before.

## Run it on your computer (optional)

Requires Node.js 20+.

```bash
npm install
npm run scrape   # fetch fresh data (set TMDB_ACCESS_TOKEN in a .env-style env var for posters)
npm run dev      # website at http://localhost:5173
```

## One-time setup

1. **GitHub secret:** repo → Settings → Secrets and variables → Actions → New repository secret →
   name `TMDB_ACCESS_TOKEN`, value = your TMDB "API Read Access Token".
2. **Netlify:** Add new site → Import from Git → pick this repo. Build settings come from `netlify.toml`.
3. **Google Sheet:** must stay shared as "Anyone with the link → Viewer". The sheet ID is in `src/config.ts`.
