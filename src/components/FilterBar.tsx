import type { DealCategory } from "../data/types";

type FilterBarProps = {
  activeFilter: DealCategory;
  filters: DealCategory[];
  onChange: (filter: DealCategory) => void;
};

export function FilterBar({ activeFilter, filters, onChange }: FilterBarProps) {
  return (
    <div className="filter-row">
      {filters.map((filter) => (
        <button
          key={filter}
          className={`filter ${filter === activeFilter ? "active" : ""}`}
          type="button"
          onClick={() => onChange(filter)}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
