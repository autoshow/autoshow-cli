import { buildSnapshotCards, renderSnapshotCardsMarkup } from "./snapshot.js";

export function renderCategoryTabs(context, onCategoryChange) {
  const tabContainer = document.getElementById("category-tabs");
  const categories = context.categoryOrder.filter((category) => context.byCategory.get(category)?.length);

  tabContainer.innerHTML = categories
    .map((category) => {
      const meta = context.categoryMeta[category] ?? context.categoryMeta.uncategorized;
      return `
        <button
          class="tab-button ${category === context.state.selectedCategory ? "is-active" : ""}"
          data-category="${category}"
          type="button"
        >${context.escapeHtml(meta.label)}</button>
      `;
    })
    .join("");

  tabContainer.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      context.state.selectedCategory = button.dataset.category;
      onCategoryChange();
    });
  });
}

export function renderLeaderboards(context) {
  const shell = document.getElementById("leaderboard-shell");
  const rows = context.byCategory.get(context.state.selectedCategory) ?? [];
  const meta = context.categoryMeta[context.state.selectedCategory] ?? context.categoryMeta.uncategorized;
  const snapshotCards = buildSnapshotCards(context, rows, {
    fastestLabel: `Fastest ${meta.label}`,
    cheapestLabel: `Cheapest ${meta.label}`,
    slowestLabel: `Slowest ${meta.label}`,
    averageRuntimeMeta: `Mean ${context.getMetricConfig().averageMetaLabel}`,
    averageActualCostMeta: `Mean actual cost across ${meta.label.toLowerCase()} rows`,
  });

  shell.innerHTML = `
    <div class="panel-head">
      <div>
        <h3>${context.escapeHtml(meta.label)} Leaderboards</h3>
        <p>${context.escapeHtml(meta.description)}</p>
      </div>
      <div class="panel-legend">
        <span class="legend-pill">Actual cost preferred</span>
        <span class="legend-pill">Estimated cost fallback</span>
      </div>
    </div>
    <div class="summary-grid">${renderSnapshotCardsMarkup(context, snapshotCards)}</div>
    <div class="board-grid">
      <section class="rank-panel">
        <h4>Speed</h4>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th class="numeric">${context.escapeHtml(context.getMetricConfig().headingActual)}</th>
                <th class="numeric">${context.escapeHtml(context.getMetricConfig().headingEstimated)}</th>
                <th class="numeric">${context.escapeHtml(context.getMetricConfig().headingDelta)}</th>
              </tr>
            </thead>
            <tbody>${renderSpeedRows(context, rows)}</tbody>
          </table>
        </div>
      </section>
      <section class="rank-panel">
        <h4>Cost</h4>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Model</th>
                <th class="numeric">Rank Cost</th>
                <th class="numeric">Actual Cost</th>
                <th class="numeric">Est. Cost</th>
              </tr>
            </thead>
            <tbody>${renderCostRows(context, rows)}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function renderSpeedRows(context, rows) {
  return [...rows]
    .sort((a, b) => context.getDurationSortValue(a) - context.getDurationSortValue(b))
    .map((row, index) => {
      const deltaMs = context.getDisplayedDurationDeltaMs(row);
      const deltaClass = deltaMs == null ? "" : deltaMs > 0 ? "positive" : "negative";
      return `
        <tr class="${index === 0 ? "is-top" : ""}">
          <td class="rank-cell">${index + 1}</td>
          <td class="model-cell">
            <strong class="model-strong" title="${context.escapeHtml(context.getOriginalPairLabel(row))}">
              ${context.escapeHtml(context.getModelLabel(row))}
            </strong>
            <span class="model-subtle">${context.escapeHtml(context.getServiceLabel(row))}</span>
          </td>
          <td class="numeric">${context.escapeHtml(context.formatDuration(context.getDisplayedActualDurationMs(row)))}</td>
          <td class="numeric">${context.escapeHtml(context.formatDuration(context.getDisplayedEstimatedDurationMs(row)))}</td>
          <td class="numeric delta ${deltaClass}">${context.escapeHtml(context.formatSignedDuration(deltaMs))}</td>
        </tr>
      `;
    })
    .join("");
}

function renderCostRows(context, rows) {
  return [...rows]
    .filter((row) => row.rankingCostUsd != null)
    .sort((a, b) => a.rankingCostUsd - b.rankingCostUsd)
    .map((row, index) => `
      <tr class="${index === 0 ? "is-top" : ""}">
        <td class="rank-cell">${index + 1}</td>
        <td class="model-cell">
          <strong class="model-strong" title="${context.escapeHtml(context.getOriginalPairLabel(row))}">
            ${context.escapeHtml(context.getModelLabel(row))}
          </strong>
          <span class="model-subtle">${context.escapeHtml(context.getServiceLabel(row))}</span>
        </td>
        <td class="numeric">${context.escapeHtml(context.formatUsd(row.rankingCostUsd))}</td>
        <td class="numeric">${context.escapeHtml(context.formatUsd(row.cost.runtimeEstimatedUsd))}</td>
        <td class="numeric">${context.escapeHtml(context.formatUsd(row.cost.estimatedUsd))}</td>
      </tr>
    `)
    .join("") || '<tr><td colspan="5">No cost data captured for this category.</td></tr>';
}
