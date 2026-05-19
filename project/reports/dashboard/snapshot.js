export function renderMetricTabs(context, onMetricModeChange) {
  const metricTabs = document.getElementById("metric-tabs");
  const options = [
    { id: "endToEnd", label: "End-to-End" },
    { id: "primary", label: "Primary Step" },
  ];

  metricTabs.innerHTML = options
    .map((option) => `
      <button
        class="tab-button ${option.id === context.state.metricMode ? "is-active" : ""}"
        data-metric-mode="${option.id}"
        type="button"
      >${context.escapeHtml(option.label)}</button>
    `)
    .join("");

  metricTabs.querySelectorAll("[data-metric-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      context.state.metricMode = button.dataset.metricMode;
      onMetricModeChange();
    });
  });
}

export function renderSummaryCards(context) {
  const cards = buildSnapshotCards(context, context.tests, {
    fastestLabel: "Fastest Overall",
    cheapestLabel: "Cheapest Overall",
    slowestLabel: "Slowest Overall",
    averageRuntimeMeta: `Mean ${context.getMetricConfig().averageMetaLabel}`,
    averageActualCostMeta: "Mean actual cost across rows with captured cost",
  });
  document.getElementById("summary-grid").innerHTML = renderSnapshotCardsMarkup(context, cards);
}

export function buildSnapshotCards(context, rows, options) {
  const fastest = context.getFastest(rows);
  const cheapest = context.getCheapest(rows);
  const slowest = context.getSlowest(rows);
  const priciest = context.getPriciest(rows);
  const avgDuration = context.average(rows.map((row) => context.getDisplayedActualDurationMs(row)));
  const avgActualCost = context.average(
    rows.filter((row) => row.cost.runtimeEstimatedUsd != null).map((row) => row.cost.runtimeEstimatedUsd)
  );

  return [
    {
      label: options.fastestLabel,
      value: context.formatDuration(fastest ? context.getDisplayedActualDurationMs(fastest) : null),
      meta: fastest ? context.getPairLabel(fastest) : "-",
    },
    {
      label: options.cheapestLabel,
      value: context.formatUsd(cheapest?.rankingCostUsd ?? null),
      meta: cheapest ? `${context.getPairLabel(cheapest)} (${cheapest.costSource})` : "-",
    },
    {
      label: options.slowestLabel,
      value: context.formatDuration(slowest ? context.getDisplayedActualDurationMs(slowest) : null),
      meta: slowest ? context.getPairLabel(slowest) : "-",
    },
    {
      label: "Most Expensive",
      value: context.formatUsd(priciest?.rankingCostUsd ?? null),
      meta: priciest ? `${context.getPairLabel(priciest)} (${priciest.costSource})` : "-",
    },
    {
      label: "Average Runtime",
      value: context.formatDuration(avgDuration),
      meta: options.averageRuntimeMeta,
    },
    {
      label: "Average Actual Cost",
      value: context.formatUsd(avgActualCost),
      meta: options.averageActualCostMeta,
    },
  ];
}

export function renderSnapshotCardsMarkup(context, cards) {
  return cards
    .map((card) => `
      <article class="summary-card surface">
        <div>
          <div class="summary-label">${context.escapeHtml(card.label)}</div>
          <div class="summary-value">${context.escapeHtml(card.value)}</div>
        </div>
        <div class="summary-meta" title="${context.escapeHtml(card.meta)}">${context.escapeHtml(card.meta)}</div>
      </article>
    `)
    .join("");
}
