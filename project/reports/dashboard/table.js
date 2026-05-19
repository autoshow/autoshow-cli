export function bindTableControls(context, onTableChange) {
  document.getElementById("table-category").addEventListener("change", (event) => {
    context.state.tableCategory = event.target.value;
    onTableChange();
  });
  document.getElementById("table-sort").addEventListener("change", (event) => {
    context.state.tableSort = event.target.value;
    onTableChange();
  });
  document.getElementById("table-search").addEventListener("input", (event) => {
    context.state.tableSearch = event.target.value.trim().toLowerCase();
    onTableChange();
  });
}

export function renderTableControls(context) {
  const categorySelect = document.getElementById("table-category");
  const categories = context.categoryOrder.filter((category) => context.byCategory.get(category)?.length);
  categorySelect.innerHTML = [
    '<option value="all">All categories</option>',
    ...categories.map((category) => {
      const meta = context.categoryMeta[category] ?? context.categoryMeta.uncategorized;
      return `<option value="${category}">${context.escapeHtml(meta.label)}</option>`;
    }),
  ].join("");
  categorySelect.value = context.state.tableCategory;
  document.getElementById("table-sort").value = context.state.tableSort;
}

export function renderBenchmarkTable(context) {
  const rows = getFilteredRows(context);
  const tableBody = document.getElementById("benchmark-rows");
  const metric = context.getMetricConfig();

  document.getElementById("table-actual-heading").textContent = metric.headingActual;
  document.getElementById("table-estimated-heading").textContent = metric.headingEstimated;
  document.getElementById("table-delta-heading").textContent = metric.headingDelta;
  document.getElementById("results-note").textContent = `${rows.length} of ${context.tests.length} rows shown`;

  if (!rows.length) {
    tableBody.innerHTML = '<tr><td colspan="11">No rows match the current filters.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map((row) => {
      const meta = context.categoryMeta[row.category] ?? context.categoryMeta.uncategorized;
      const deltaMs = context.getDisplayedDurationDeltaMs(row);
      const deltaClass = deltaMs == null ? "" : deltaMs > 0 ? "positive" : "negative";
      return `
        <tr>
          <td><span class="category-chip" data-category="${row.category}">${context.escapeHtml(meta.label)}</span></td>
          <td title="${context.escapeHtml(row.serviceName)}">${context.escapeHtml(context.getServiceLabel(row))}</td>
          <td class="model-cell">
            <strong class="model-strong" title="${context.escapeHtml(row.modelName)}">
              ${context.escapeHtml(context.getModelLabel(row))}
            </strong>
            <span class="model-subtle">${context.escapeHtml(row.testName ?? "")}</span>
          </td>
          <td class="table-muted">${context.escapeHtml(context.runtimeFormatter.format(row.runAtDate))}</td>
          <td class="numeric">${context.escapeHtml(context.formatDuration(context.getDisplayedActualDurationMs(row)))}</td>
          <td class="numeric">${context.escapeHtml(context.formatDuration(context.getDisplayedEstimatedDurationMs(row)))}</td>
          <td class="numeric delta ${deltaClass}">${context.escapeHtml(context.formatSignedDuration(deltaMs))}</td>
          <td class="numeric">${context.escapeHtml(context.formatUsd(row.cost.runtimeEstimatedUsd))}</td>
          <td class="numeric">${context.escapeHtml(context.formatUsd(row.cost.estimatedUsd))}</td>
          <td class="numeric">
            ${context.escapeHtml(context.formatUsd(row.rankingCostUsd))}
            <span class="badge ${row.costSource} badge-offset">${context.escapeHtml(row.costSource)}</span>
          </td>
          <td>${context.escapeHtml(row.status ?? "")}</td>
        </tr>
      `;
    })
    .join("");
}

function getFilteredRows(context) {
  const query = context.state.tableSearch;
  const filtered = context.tests.filter((row) => {
    const categoryMatch = context.state.tableCategory === "all" || row.category === context.state.tableCategory;
    const queryMatch =
      !query ||
      row.serviceName.toLowerCase().includes(query) ||
      row.modelName.toLowerCase().includes(query) ||
      String(row.serviceDisplayName ?? "").toLowerCase().includes(query) ||
      String(row.modelDisplayName ?? "").toLowerCase().includes(query) ||
      String(row.testName ?? "").toLowerCase().includes(query);
    return categoryMatch && queryMatch;
  });

  const sorted = [...filtered];
  switch (context.state.tableSort) {
    case "duration-asc":
      sorted.sort((a, b) => context.getDurationSortValue(a) - context.getDurationSortValue(b));
      break;
    case "duration-desc":
      sorted.sort((a, b) => context.getDurationSortValue(b, "desc") - context.getDurationSortValue(a, "desc"));
      break;
    case "cost-asc":
      sorted.sort((a, b) => (a.rankingCostUsd ?? Infinity) - (b.rankingCostUsd ?? Infinity));
      break;
    case "cost-desc":
      sorted.sort((a, b) => (b.rankingCostUsd ?? -Infinity) - (a.rankingCostUsd ?? -Infinity));
      break;
    case "runAt-asc":
      sorted.sort((a, b) => a.runAtDate - b.runAtDate);
      break;
    case "runAt-desc":
      sorted.sort((a, b) => b.runAtDate - a.runAtDate);
      break;
    case "service":
      sorted.sort((a, b) => {
        const serviceDiff = a.serviceName.localeCompare(b.serviceName);
        return serviceDiff || a.modelName.localeCompare(b.modelName);
      });
      break;
    case "category":
    default:
      sorted.sort(context.sortByCategoryThenFastest);
      break;
  }
  return sorted;
}
