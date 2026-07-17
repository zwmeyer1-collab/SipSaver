import type { ImportedReviewItem } from "../data/types";

type ReviewQueueProps = {
  items: ImportedReviewItem[];
};

export function ReviewQueue({ items }: ReviewQueueProps) {
  function getSourceLabel(item: ImportedReviewItem) {
    if (item.sourceKind === "instagram") {
      return "instagram";
    }

    if (item.sourceKind === "prospect") {
      return "new place";
    }

    return item.status;
  }

  function getSourceKindClassName(item: ImportedReviewItem) {
    return item.sourceKind === "instagram" ? "source-instagram" : "source-website";
  }

  return (
    <div className="review-grid">
      {items.map((item) => {
        return (
          <article className="review-card" key={item.id}>
            <div className="review-card-top">
              <p className="deal-tag">{getSourceLabel(item)}</p>
              <span className={`source-kind ${getSourceKindClassName(item)}`}>{item.confidence}</span>
            </div>
            <h3>{item.snippet}</h3>
            <p className="review-meta">
              {item.venueName} • {item.neighborhood}
            </p>
            <p className="deal-description">
              Suggested as {item.suggestedCategory.toLowerCase()} from{" "}
              {item.sourceKind === "instagram"
                ? "an Instagram post or caption"
                : item.sourceKind === "prospect"
                  ? "a newly discovered venue website"
                  : "imported website text"}.
            </p>
            <p className="queue-footnote">
              Imported {item.importedAt.slice(0, 10)} • {item.sourceTitle}
            </p>
          </article>
        );
      })}
    </div>
  );
}
