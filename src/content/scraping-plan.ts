export const scrapingPlan = [
  {
    title: "1. Seed venues by neighborhood",
    body: "Build a Tampa venue list manually first so scraping starts from known official sites, not from blind web search.",
  },
  {
    title: "2. Crawl official pages",
    body: "Check homepage, specials, menu, events, and footer links. Save the source URL and extraction date on every record.",
  },
  {
    title: "3. Normalize into deals",
    body: "Convert raw copy into structured fields like day, time window, category, and neighborhood so listings stay comparable.",
  },
  {
    title: "4. Queue weak signals",
    body: "Instagram finds and unclear website promos should go into review instead of publishing automatically.",
  },
];
