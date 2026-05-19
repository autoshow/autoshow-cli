export function renderWinnerCards(context) {
  const winnerGrid = document.getElementById("winner-grid");
  const categories = context.categoryOrder.filter((category) => context.byCategory.get(category)?.length);

  winnerGrid.innerHTML = categories
    .map((category) => {
      const rows = context.byCategory.get(category) ?? [];
      const fastest = context.getFastest(rows);
      const cheapest = context.getCheapest(rows);
      const meta = context.categoryMeta[category] ?? context.categoryMeta.uncategorized;
      const averageDuration = context.average(rows.map((row) => context.getDisplayedActualDurationMs(row)));

      return `
        <article class="winner-card surface">
          <div>
            <span class="category-chip" data-category="${category}">${context.escapeHtml(meta.label)}</span>
          </div>
          <div class="winner-stat-grid">
            <div class="winner-stat">
              <span>Fastest</span>
              <strong title="${context.escapeHtml(context.getOriginalPairLabel(fastest))}">
                ${context.escapeHtml(fastest ? context.getModelLabel(fastest) : "-")}
              </strong>
              <small>${context.escapeHtml(fastest ? context.getServiceLabel(fastest) : "")}</small>
            </div>
            <div class="winner-stat">
              <span>Cheapest</span>
              <strong title="${context.escapeHtml(context.getOriginalPairLabel(cheapest))}">
                ${context.escapeHtml(cheapest ? context.getModelLabel(cheapest) : "-")}
              </strong>
              <small>${context.escapeHtml(context.formatUsd(cheapest?.rankingCostUsd ?? null))}</small>
            </div>
            <div class="winner-stat">
              <span>Rows</span>
              <strong>${context.escapeHtml(String(rows.length))}</strong>
              <small>${context.escapeHtml(context.formatDuration(averageDuration))} avg</small>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}
