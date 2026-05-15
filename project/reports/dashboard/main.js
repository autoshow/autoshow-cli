import { renderMetricTabs, renderSummaryCards } from "./snapshot.js";
import { renderWinnerCards } from "./winners.js";
import { renderCategoryTabs, renderLeaderboards } from "./leaderboards.js";
import { bindTableControls, renderBenchmarkTable, renderTableControls } from "./table.js";

const REPORT_SCHEMA_VERSION = 2;
const RESULTS_BASE_URL = new URL("../results/", window.location.href);

const CATEGORY_META = {
  document: { label: "Document", description: "OCR and document parsing rows." },
  url: { label: "URL", description: "Article extraction rows for defuddle, firecrawl, glm-reader, spider, and zyte." },
  transcription: { label: "Transcription", description: "Speech-to-text rows." },
  llm: { label: "LLM", description: "Text generation rows." },
  tts: { label: "TTS", description: "Text-to-speech rows." },
  image: { label: "Image", description: "Image generation rows." },
  music: { label: "Music", description: "Music generation rows." },
  video: { label: "Video", description: "Video generation rows." },
  uncategorized: { label: "Uncategorized", description: "Rows without a recognized step category." },
};

const CATEGORY_ORDER = [
  "document",
  "url",
  "transcription",
  "llm",
  "tts",
  "image",
  "music",
  "video",
  "uncategorized",
];

const METRIC_META = {
  endToEnd: {
    label: "End-to-End Runtime",
    deltaKey: "endToEndDurationDeltaMs",
    averageMetaLabel: "end-to-end runtime",
    headingActual: "Actual Time",
    headingEstimated: "Est. Time",
    headingDelta: "Time Delta",
  },
  primary: {
    label: "Primary Step Runtime",
    deltaKey: "primaryDurationDeltaMs",
    averageMetaLabel: "primary-step runtime",
    headingActual: "Actual Primary",
    headingEstimated: "Est. Primary",
    headingDelta: "Primary Delta",
  },
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});
const runtimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const loadStatus = document.getElementById("load-status");
const dashboardContent = document.getElementById("dashboard-content");
const heroMeta = document.getElementById("hero-meta");
const tableSearchControl = document.getElementById("table-search");

let tests = [];
let byCategory = new Map();

const state = {
  metricMode: "endToEnd",
  selectedCategory: "document",
  tableCategory: "all",
  tableSort: "category",
  tableSearch: "",
};

const context = {
  categoryMeta: CATEGORY_META,
  categoryOrder: CATEGORY_ORDER,
  state,
  runtimeFormatter,
  get tests() {
    return tests;
  },
  get byCategory() {
    return byCategory;
  },
  getMetricConfig,
  getDisplayedActualDurationMs,
  getDisplayedEstimatedDurationMs,
  getDisplayedDurationDeltaMs,
  formatDuration,
  formatSignedDuration,
  formatUsd,
  average,
  getDurationSortValue,
  getFastest,
  getSlowest,
  getCheapest,
  getPriciest,
  sortByCategoryThenFastest,
  getServiceLabel,
  getModelLabel,
  getPairLabel,
  getOriginalPairLabel,
  escapeHtml,
};

bindTableControls(context, () => renderBenchmarkTable(context));
setHeroMetaMessage("Loading report data");
renderLoadingState("Loading benchmark results from project/reports/results...");
void bootstrap();

async function bootstrap() {
  if (window.location.protocol === "file:") {
    setHeroMetaMessage("Report data unavailable");
    renderErrorState("Serve project/reports/dashboard over HTTP so the page can fetch ../results/*.json.");
    return;
  }

  try {
    const report = await loadCombinedReport();
    if (!report.tests.length) {
      setHeroMetaMessage("No benchmark data");
      renderEmptyState("No compatible schemaVersion 2 dashboard reports were found in project/reports/results.");
      return;
    }
    initializeDashboard(report);
    if (!tests.length) {
      setHeroMetaMessage("No provider benchmark rows");
      renderEmptyState("Compatible reports were found, but they only contained setup, download, or off-category rows.");
      return;
    }
    renderReadyState();
  } catch (error) {
    console.error(error);
    setHeroMetaMessage("Report data unavailable");
    renderErrorState(error instanceof Error ? error.message : "Failed to load benchmark results.");
  }
}

async function loadCombinedReport() {
  const reportFiles = await discoverReportFiles();
  if (!reportFiles.length) return { tests: [] };

  const loadedReports = await Promise.all(reportFiles.map(async (fileName) => {
    try {
      return await loadReportFile(fileName);
    } catch (error) {
      console.warn(error);
      return null;
    }
  }));
  const reports = loadedReports.filter((report) => report != null);
  return { tests: reports.flatMap((report) => report.tests) };
}

async function discoverReportFiles() {
  const indexed = await discoverReportFilesFromIndex();
  if (indexed) return indexed;

  try {
    const directoryHtml = await loadText(RESULTS_BASE_URL, "Results directory");
    const parsedDocument = new DOMParser().parseFromString(directoryHtml, "text/html");
    return [...new Set(
      [...parsedDocument.querySelectorAll("a[href]")]
        .map((link) => normalizeReportLink(link.getAttribute("href")))
        .filter(Boolean)
    )].sort((left, right) => left.localeCompare(right));
  } catch (error) {
    throw new Error("No results index was found, and this server does not expose a directory listing for project/reports/results.");
  }
}

async function discoverReportFilesFromIndex() {
  try {
    const index = await loadJson(new URL("index.json", RESULTS_BASE_URL), "Results index");
    if (!index || !Array.isArray(index.files)) return null;
    return [...new Set(index.files)]
      .map((value) => normalizeReportLink(String(value)))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    return null;
  }
}

async function loadReportFile(fileName) {
  const report = await loadJson(new URL(fileName, RESULTS_BASE_URL), `Report ${fileName}`);
  if (!report || report.schemaVersion !== REPORT_SCHEMA_VERSION || !Array.isArray(report.tests)) {
    throw new Error(`Report ${fileName} is not a schemaVersion ${REPORT_SCHEMA_VERSION} dashboard report.`);
  }
  return report;
}

async function fetchResource(url, label) {
  let response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new Error(`${label} could not be loaded.`);
  }
  if (!response.ok) {
    throw new Error(`${label} could not be loaded (${response.status} ${response.statusText || "request failed"}).`);
  }
  return response;
}

async function loadText(url, label) {
  return await (await fetchResource(url, label)).text();
}

async function loadJson(url, label) {
  const response = await fetchResource(url, label);
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function normalizeReportLink(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let fileUrl;
  try {
    fileUrl = new URL(value, RESULTS_BASE_URL);
  } catch (error) {
    return null;
  }

  if (fileUrl.origin !== RESULTS_BASE_URL.origin) return null;
  if (!fileUrl.pathname.startsWith(RESULTS_BASE_URL.pathname)) return null;

  const relativePath = decodeURIComponent(fileUrl.pathname.slice(RESULTS_BASE_URL.pathname.length));
  if (!relativePath || relativePath.includes("/") || !relativePath.endsWith(".json") || relativePath === "index.json") {
    return null;
  }
  return relativePath;
}

function initializeDashboard(report) {
  tests = report.tests.map((test, index) => enrichTest(test, index)).filter((row) => row?.isBenchmarkRow);
  byCategory = buildCategoryMap(tests);
  state.metricMode = "endToEnd";
  state.selectedCategory = CATEGORY_ORDER.find((category) => byCategory.get(category)?.length) ?? "uncategorized";
  state.tableCategory = "all";
  state.tableSort = "category";
  state.tableSearch = "";
  tableSearchControl.value = "";
  renderDashboardSections();
}

function renderDashboardSections() {
  renderHeroMeta();
  renderMetricTabs(context, handleMetricModeChange);
  renderSummaryCards(context);
  renderWinnerCards(context);
  renderCategoryTabs(context, handleCategoryChange);
  renderLeaderboards(context);
  renderTableControls(context);
  renderBenchmarkTable(context);
}

function handleMetricModeChange() {
  renderHeroMeta();
  renderMetricTabs(context, handleMetricModeChange);
  renderSummaryCards(context);
  renderWinnerCards(context);
  renderLeaderboards(context);
  renderBenchmarkTable(context);
}

function handleCategoryChange() {
  renderCategoryTabs(context, handleCategoryChange);
  renderLeaderboards(context);
}

function buildCategoryMap(rows) {
  const categories = new Map();
  for (const category of CATEGORY_ORDER) {
    categories.set(category, rows.filter((test) => test.category === category));
  }
  return categories;
}

function renderLoadingState(message) {
  loadStatus.textContent = message;
  loadStatus.classList.remove("is-hidden", "is-error", "is-empty");
  dashboardContent.classList.add("is-hidden");
}

function renderEmptyState(message) {
  loadStatus.textContent = message;
  loadStatus.classList.remove("is-hidden", "is-error");
  loadStatus.classList.add("is-empty");
  dashboardContent.classList.add("is-hidden");
}

function renderErrorState(message) {
  loadStatus.textContent = message;
  loadStatus.classList.remove("is-hidden", "is-empty");
  loadStatus.classList.add("is-error");
  dashboardContent.classList.add("is-hidden");
}

function renderReadyState() {
  loadStatus.classList.add("is-hidden");
  dashboardContent.classList.remove("is-hidden");
}

function setHeroMetaMessage(message) {
  heroMeta.innerHTML = `<span class="meta-pill">${escapeHtml(message)}</span>`;
}

function enrichTest(test, index) {
  if (!test || typeof test !== "object") return null;
  const category = CATEGORY_META[test.category] ? test.category : "uncategorized";
  const serviceName = normalizeLabelValue(test.serviceName);
  const modelName = normalizeLabelValue(test.modelName);
  const testFile = String(test.testFile ?? "");
  const testName = String(test.testName ?? "");
  const runAtDate = new Date(test.runAt ?? Date.now());
  const durations = normalizeDurations(test.durations);
  const cost = normalizeCost(test.cost);
  const rankingCostUsd = cost.runtimeEstimatedUsd ?? cost.estimatedUsd ?? null;
  const costSource = cost.runtimeEstimatedUsd != null ? "actual" : cost.estimatedUsd != null ? "estimated" : "missing";
  const endToEndDurationDeltaMs =
    durations.endToEnd.estimatedMs != null && durations.endToEnd.actualMs != null
      ? durations.endToEnd.actualMs - durations.endToEnd.estimatedMs
      : null;
  const primaryDurationDeltaMs =
    durations.primaryStep.estimatedMs != null && durations.primaryStep.actualMs != null
      ? durations.primaryStep.actualMs - durations.primaryStep.estimatedMs
      : null;

  return {
    ...test,
    id: `${index + 1}-${serviceName}-${modelName}`,
    category,
    serviceName,
    modelName,
    serviceDisplayName: compactProviderLabel(serviceName),
    modelDisplayName: compactProviderLabel(modelName),
    isBenchmarkRow: hasProviderIdentity(serviceName, modelName)
      && isCategoryConsistentWithTest(category, testFile, testName),
    testFile,
    testName,
    runAtDate,
    durations,
    cost,
    rankingCostUsd,
    costSource,
    endToEndDurationDeltaMs,
    primaryDurationDeltaMs,
  };
}

function normalizeLabelValue(value) {
  const trimmed = String(value ?? "unknown").trim();
  return trimmed.length ? trimmed : "unknown";
}

function hasProviderIdentity(serviceName, modelName) {
  const emptyNames = new Set(["", "unknown", "n/a", "none", "null", "undefined"]);
  return !emptyNames.has(serviceName.trim().toLowerCase())
    && !emptyNames.has(modelName.trim().toLowerCase());
}

function compactProviderLabel(value) {
  return String(value)
    .split(/\s*\|\s*/g)
    .map((part) => compactProviderLabelPart(part))
    .filter(Boolean)
    .join(" + ");
}

function compactProviderLabelPart(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const coreMlPrefix = /^coreml:/i.test(trimmed);
  const unprefixed = coreMlPrefix ? trimmed.replace(/^coreml:/i, "") : trimmed;
  const isAbsolutePath = unprefixed.startsWith("/") || /^[A-Za-z]:[\\/]/.test(unprefixed);
  if (!isAbsolutePath) {
    return coreMlPrefix ? `Core ML ${unprefixed}` : unprefixed;
  }

  const fileName = unprefixed.split(/[\\/]/).filter(Boolean).pop() ?? unprefixed;
  return coreMlPrefix ? `Core ML ${fileName}` : fileName;
}

function isCategoryConsistentWithTest(category, testFile, testName) {
  const allowed = inferAllowedCategories(testFile, testName);
  return allowed === null || allowed.has(category);
}

function inferAllowedCategories(testFile, testName) {
  if (testFile.includes("/step-7-music-gen-e2e/")) return new Set(["music"]);
  if (testFile.includes("/step-6-video-gen-e2e/")) return new Set(["video"]);
  if (testFile.includes("/step-5-image-gen-e2e/")) return new Set(["image"]);
  if (testFile.includes("/step-4-tts-e2e/")) return new Set(["tts"]);
  if (testFile.includes("/step-3-write-e2e/")) return new Set(["llm"]);
  if (testFile.includes("/step-2-stt-e2e/")) return new Set(["transcription"]);
  if (testFile.includes("/step-2-ocr-e2e/")) return new Set(["document", "url"]);

  if (/\btranscribes?\b|\btranscribe\b/i.test(testName)) return new Set(["transcription"]);
  if (/\bextracts?\b|\bextract\b|\bocr\b/i.test(testName)) return new Set(["document", "url"]);
  if (/\btts\b|\bspeech\.wav\b|\bsynthesi[sz]es?\b/i.test(testName)) return new Set(["tts"]);
  if (/\bimage\b|\bgenerated-image\b/i.test(testName)) return new Set(["image"]);
  if (/\bvideo\b|\bveo\b/i.test(testName)) return new Set(["video"]);
  if (/\bmusic\b|\bgenerated music\b/i.test(testName)) return new Set(["music"]);
  if (/\bmodel generates\b|\bgenerates summary\b|\buses cheapest model\b/i.test(testName)) return new Set(["llm"]);

  return null;
}

function normalizeDurations(value) {
  const endToEnd = value?.endToEnd ?? {};
  const primaryStep = value?.primaryStep ?? {};
  return {
    endToEnd: {
      estimatedMs: numberOrNull(endToEnd.estimatedMs),
      actualMs: numberOrNull(endToEnd.actualMs),
    },
    primaryStep: {
      estimatedMs: numberOrNull(primaryStep.estimatedMs),
      actualMs: numberOrNull(primaryStep.actualMs),
    },
  };
}

function normalizeCost(value) {
  return {
    estimatedUsd: numberOrNull(value?.estimatedUsd),
    runtimeEstimatedUsd: numberOrNull(value?.runtimeEstimatedUsd),
  };
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetricConfig() {
  return METRIC_META[state.metricMode];
}

function getDisplayedActualDurationMs(row) {
  return state.metricMode === "primary" ? row.durations.primaryStep.actualMs : row.durations.endToEnd.actualMs;
}

function getDisplayedEstimatedDurationMs(row) {
  return state.metricMode === "primary" ? row.durations.primaryStep.estimatedMs : row.durations.endToEnd.estimatedMs;
}

function getDisplayedDurationDeltaMs(row) {
  return row[getMetricConfig().deltaKey] ?? null;
}

function formatDuration(ms) {
  if (ms == null) return "-";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60_000).toFixed(2)}m`;
}

function formatSignedDuration(ms) {
  if (ms == null) return "-";
  if (ms === 0) return "0ms";
  return `${ms > 0 ? "+" : "-"}${formatDuration(Math.abs(ms))}`;
}

function formatUsd(value) {
  return value == null ? "-" : currency.format(value);
}

function average(values) {
  const filtered = values.filter((value) => value != null);
  return filtered.length ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length : null;
}

function getDurationSortValue(row, direction = "asc") {
  const value = getDisplayedActualDurationMs(row);
  if (value != null) return value;
  return direction === "desc" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
}

function getFastest(rows) {
  return [...rows].sort((a, b) => getDurationSortValue(a) - getDurationSortValue(b))[0] ?? null;
}

function getSlowest(rows) {
  return [...rows].sort((a, b) => getDurationSortValue(b, "desc") - getDurationSortValue(a, "desc"))[0] ?? null;
}

function getCheapest(rows) {
  return [...rows].filter((row) => row.rankingCostUsd != null).sort((a, b) => a.rankingCostUsd - b.rankingCostUsd)[0] ?? null;
}

function getPriciest(rows) {
  return [...rows].filter((row) => row.rankingCostUsd != null).sort((a, b) => b.rankingCostUsd - a.rankingCostUsd)[0] ?? null;
}

function sortByCategoryThenFastest(a, b) {
  const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  return categoryDiff || getDurationSortValue(a) - getDurationSortValue(b);
}

function getServiceLabel(row) {
  return row?.serviceDisplayName ?? row?.serviceName ?? "-";
}

function getModelLabel(row) {
  return row?.modelDisplayName ?? row?.modelName ?? "-";
}

function getPairLabel(row) {
  if (!row) return "-";
  return `${getServiceLabel(row)} / ${getModelLabel(row)}`;
}

function getOriginalPairLabel(row) {
  if (!row) return "-";
  return `${row.serviceName} / ${row.modelName}`;
}

function renderHeroMeta() {
  const actualCostCount = tests.filter((test) => test.cost.runtimeEstimatedUsd != null).length;
  const primaryDurationCount = tests.filter((test) => test.durations.primaryStep.actualMs != null).length;
  const firstRun = [...tests].sort((a, b) => a.runAtDate - b.runAtDate)[0];
  const lastRun = [...tests].sort((a, b) => b.runAtDate - a.runAtDate)[0];
  const categoriesPresent = CATEGORY_ORDER.filter((category) => byCategory.get(category)?.length);

  heroMeta.innerHTML = [
    `<span class="meta-pill">${tests.length} rows</span>`,
    `<span class="meta-pill">${categoriesPresent.length} categories</span>`,
    `<span class="meta-pill">${actualCostCount}/${tests.length} actual costs</span>`,
    `<span class="meta-pill">${primaryDurationCount}/${tests.length} primary timings</span>`,
    `<span class="meta-pill">${escapeHtml(getMetricConfig().label)}</span>`,
    firstRun && lastRun
      ? `<span class="meta-pill">${escapeHtml(runtimeFormatter.format(firstRun.runAtDate))} to ${escapeHtml(runtimeFormatter.format(lastRun.runAtDate))}</span>`
      : "",
  ].join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
