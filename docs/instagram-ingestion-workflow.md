# Instagram Workflow

Instagram matters because a lot of Tampa spots post the real deal there first and leave the website stale.

## Current plan

- Use official Meta APIs later for claimed business or creator accounts.
- Use SipSaver's operator pipeline right now for Instagram-first deal capture.
- Keep every Instagram-sourced deal labeled separately from website-sourced deals.

## Why not fully automate public scraping first

- Meta shut down the old Instagram Basic Display API on December 4, 2024.
- The supported API path now is for professional accounts, not general consumer access.
- Public scraping is brittle and higher-risk than the website pipeline we already have.

## How to add Instagram leads right now

1. Open `data/ingestion/tampa-instagram-input.json`.
2. Add items in this shape:

```json
{
  "generatedAt": "2026-04-23T00:00:00.000Z",
  "city": "Tampa",
  "items": [
    {
      "venueId": "macdintons",
      "sourceUrl": "https://www.instagram.com/p/POST_ID/",
      "sourceTitle": "Instagram @macdintonstampa",
      "snippet": "$5 wells and $7 apps Mon-Fri 4pm-7pm",
      "capturedAt": "2026-04-23T00:00:00.000Z"
    }
  ]
}
```

3. Run `npm run import:tampa-instagram-review`.
4. The generated review file lands in `data/ingestion/tampa-instagram-review.json`.
5. The operator queue and discovery deal promotion layer will pick those items up automatically.

## Best use right now

- Add posts, reel captions, or story text that clearly includes prices, days, or times.
- Prioritize bars where you already know Instagram is more current than the website.
- Keep the original post URL so we can audit freshness later.

## Good next backend step

- Add a Supabase table for `source_submissions` so we can capture Instagram leads inside the app instead of editing JSON by hand.
