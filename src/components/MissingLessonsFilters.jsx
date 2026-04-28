import { DIFFICULTY_OPTIONS } from '../utils/difficulty';

export default function MissingLessonsFilters({
  categories = [],
  availableMonths = [],
  categoryFilter = 'all',
  monthFilter = 'all',
  difficultyFilter = 'all',
  onCategoryChange,
  onMonthChange,
  onDifficultyChange,
  showUnsetCategory = true,
}) {
  return (
    <article className="card missing-filter-card">
      <div className="missing-filter-grid">
        <label>
          Category
          <select value={categoryFilter} onChange={(event) => onCategoryChange?.(event.target.value)}>
            <option value="all">All</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
            {showUnsetCategory ? <option value="__unset__">Not set</option> : null}
          </select>
        </label>
        <label>
          Month
          <select value={monthFilter} onChange={(event) => onMonthChange?.(event.target.value)}>
            <option value="all">All</option>
            {availableMonths.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </label>
        <label>
          Difficulty
          <select value={difficultyFilter} onChange={(event) => onDifficultyChange?.(event.target.value)}>
            <option value="all">All</option>
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
