# Ingestion Output

This folder stores generated scraper output.

- `tampa-raw.json` is written by `npm run scrape:tampa`
- `tampa-prospects-raw.json` is written by `npm run scrape:tampa:prospects`
- `tampa-instagram-input.json` is the editable inbox for Instagram-sourced deal leads
- `tampa-instagram-review.json` is written by `npm run import:tampa-instagram-review`
- Each run overwrites the file with the latest extraction snapshot
- Raw website snippets should be reviewed before they become public listings
