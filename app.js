const countyNames = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa",
  "Homa Bay", "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi",
  "Kirinyaga", "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu",
  "Machakos", "Makueni", "Mandera", "Marsabit", "Meru", "Migori", "Mombasa",
  "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot"
];

const zoneByCounty = {
  "Baringo": "mixed", "Bomet": "highland", "Bungoma": "western", "Busia": "western",
  "Elgeyo-Marakwet": "highland", "Embu": "central", "Garissa": "arid", "Homa Bay": "western",
  "Isiolo": "arid", "Kajiado": "arid", "Kakamega": "western", "Kericho": "highland",
  "Kiambu": "central", "Kilifi": "coastal", "Kirinyaga": "central", "Kisii": "highland",
  "Kisumu": "western", "Kitui": "arid", "Kwale": "coastal", "Laikipia": "mixed",
  "Lamu": "coastal", "Machakos": "arid", "Makueni": "arid", "Mandera": "arid",
  "Marsabit": "arid", "Meru": "central", "Migori": "western", "Mombasa": "coastal",
  "Murang'a": "central", "Nairobi": "central", "Nakuru": "highland", "Nandi": "highland",
  "Narok": "mixed", "Nyamira": "highland", "Nyandarua": "highland", "Nyeri": "central",
  "Samburu": "arid", "Siaya": "western", "Taita-Taveta": "coastal", "Tana River": "coastal",
  "Tharaka-Nithi": "central", "Trans Nzoia": "highland", "Turkana": "arid",
  "Uasin Gishu": "highland", "Vihiga": "western", "Wajir": "arid", "West Pokot": "mixed"
};
if (!Array.isArray(window.providedProductionRecords) || !window.providedProductionRecords.length) {
  throw new Error("Provided production history did not load. Check that production-data.js is included before app.js.");
}
const state = {
  records: window.providedProductionRecords,
  weatherRecords: window.kmdRainfallRecords || [],
  soilRecords: [],
  sourceName: "Provided workbook",
  advisoryGenerated: false,
  selectedCounty: "Trans Nzoia",
  chartMode: "tonnes",
  showAll: false,
  rankingYear: 2020
};

function formatTonnes(value) {
  if (!Number.isFinite(value)) return "—";
  return `${(value / 1000000).toFixed(2)}M t`;
}

function formatCompact(value) {
  return new Intl.NumberFormat("en-KE", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function allYears() {
  return [...new Set(state.records.map((record) => record.year))].sort((a, b) => a - b);
}

function countyTotals(year) {
  return countyNames.map((county) => ({
    county,
    production: state.records.filter((record) => record.county === county && record.year === year)
      .reduce((sum, record) => sum + record.production, 0)
  })).sort((a, b) => b.production - a.production);
}

function totalsByYear() {
  const observed = allYears().map((year) => ({
    year,
    production: state.records.reduce((sum, record) => sum + (record.year === year ? record.production : 0), 0)
  })).filter((item) => item.production > 0);
  if (observed.length < 2) return observed;
  const n = observed.length;
  const meanX = observed.reduce((sum, item) => sum + item.year, 0) / n;
  const meanY = observed.reduce((sum, item) => sum + item.production, 0) / n;
  const denominator = observed.reduce((sum, item) => sum + (item.year - meanX) ** 2, 0);
  const slope = denominator ? observed.reduce((sum, item) => sum + (item.year - meanX) * (item.production - meanY), 0) / denominator : 0;
  const intercept = meanY - slope * meanX;
  const history = observed.map((item) => ({ ...item, forecast: false }));
  const lastYear = observed[observed.length - 1].year;
  for (let year = lastYear + 1; year <= 2030; year++) {
    history.push({ year, production: Math.max(0, intercept + slope * year), forecast: true });
  }
  return history;
}

function renderStats() {
  const year = state.rankingYear;
  const totals = countyTotals(year);
  const national = totals.reduce((sum, item) => sum + item.production, 0);
  const forecast = totalsByYear();
  const finalForecast = forecast.find((item) => item.year === 2030) || forecast[forecast.length - 1];
  const baseline = forecast.find((item) => item.year === Math.min(...allYears()));
  document.querySelector("#stat-production").textContent = formatTonnes(national);
  document.querySelector("#stat-production-year").textContent = year;
  const countiesWithRecords = new Set(state.records.filter((record) => record.year === year).map((record) => record.county));
  document.querySelector("#stat-counties").textContent = String(countiesWithRecords.size);
  document.querySelector("#stat-top-county").textContent = totals[0]?.county || "—";
  document.querySelector("#stat-top-volume").textContent = formatTonnes(totals[0]?.production || 0);
  document.querySelector("#stat-top-year").textContent = year;
  document.querySelector("#stat-outlook").textContent = formatTonnes(finalForecast?.production || 0);
  document.querySelector(".stat-bottom .forecast-tag + .stat-note").textContent =
    baseline?.production ? `${((finalForecast.production / baseline.production - 1) * 100).toFixed(0)}% vs. ${baseline.year}` : "trend model";
}

function renderDataLabels() {
  const years = allYears();
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const missingYears = [];
  for (let year = firstYear; year <= lastYear; year++) {
    if (!years.includes(year)) missingYears.push(year);
  }
  const coverage = missingYears.length
    ? `Observed ${firstYear}–${lastYear} · ${missingYears.join(", ")} not reported`
    : `Observed ${firstYear}–${lastYear}`;
  document.querySelector("#chart-period").textContent = coverage;
  document.querySelector("#foot-year").textContent = `through ${lastYear}`;
  document.querySelector("#data-source-note").textContent =
    `${state.sourceName} · ${state.records.length} county-year records · ${coverage}`;
}

function renderRanking() {
  const yearSelect = document.querySelector("#ranking-year");
  const options = allYears();
  if (!options.includes(state.rankingYear)) state.rankingYear = options[options.length - 1];
  yearSelect.innerHTML = options.map((year) => `<option value="${year}" ${year === state.rankingYear ? "selected" : ""}>${year}</option>`).join("");
  const ranked = countyTotals(state.rankingYear);
  const national = ranked.reduce((sum, item) => sum + item.production, 0) || 1;
  const query = document.querySelector("#county-search").value.trim().toLocaleLowerCase();
  const matches = ranked.filter((item) => item.county.toLocaleLowerCase().includes(query));
  const visible = state.showAll || query ? matches : matches.slice(0, 7);
  document.querySelector("#county-rows").innerHTML = visible.map((item) => {
    const originalRank = ranked.findIndex((entry) => entry.county === item.county) + 1;
    const share = (item.production / national) * 100;
    return `<tr><td>${String(originalRank).padStart(2, "0")}</td><td>${escapeHtml(item.county)}</td><td>${formatCompact(item.production)} t</td><td><span class="share-wrap"><span class="share-track"><span style="width:${Math.min(100, share * 5)}%"></span></span>${share.toFixed(1)}%</span></td></tr>`;
  }).join("") || '<tr><td colspan="4">No matching counties.</td></tr>';
  document.querySelector("#table-count").textContent = `${ranked.length} counties`;
  document.querySelector("#table-showing").textContent = query ? `${matches.length} matching counties` : state.showAll ? "All 47 counties" : "Showing top counties";
  const showButton = document.querySelector("#show-all");
  showButton.hidden = Boolean(query);
  showButton.innerHTML = state.showAll ? 'Show top 7 <span>↑</span>' : 'View all 47 <span>→</span>';
}

function renderChart() {
  const svg = document.querySelector("#production-chart");
  const width = Math.max(360, Math.round(svg.clientWidth || 600));
  const height = 176;
  const margins = { top: 10, right: 8, bottom: 25, left: 44 };
  const data = totalsByYear();
  if (!data.length) { svg.innerHTML = ""; return; }
  let values = data.map((item) => item.production);
  if (state.chartMode === "growth") {
    values = data.map((item, index) => index === 0 ? 0 : (item.production / data[index - 1].production - 1) * 100);
    document.querySelector("#chart-unit").textContent = "CHANGE %";
  } else {
    document.querySelector("#chart-unit").textContent = "TONNES";
  }
  const min = Math.min(...values) * (state.chartMode === "growth" ? 1 : .9);
  const max = Math.max(...values) * (state.chartMode === "growth" ? 1 : 1.08);
  const range = max - min || 1;
  const innerW = width - margins.left - margins.right;
  const innerH = height - margins.top - margins.bottom;
  const firstYear = data[0].year;
  const lastYear = data[data.length - 1].year;
  const x = (year) => margins.left + innerW * (year - firstYear) / Math.max(lastYear - firstYear, 1);
  const y = (value) => margins.top + innerH * (1 - (value - min) / range);
  const forecastIndex = data.findIndex((item) => item.forecast);
  const historicalEnd = forecastIndex < 0 ? data.length - 1 : Math.max(0, forecastIndex - 1);
  const path = (start, end) => data.slice(start, end + 1).map((item, i) => `${i === 0 ? "M" : "L"}${x(item.year).toFixed(1)},${y(values[start + i]).toFixed(1)}`).join(" ");
  const grid = Array.from({ length: 4 }, (_, i) => {
    const yy = margins.top + innerH * i / 3;
    const value = max - range * i / 3;
    const label = state.chartMode === "growth" ? `${value.toFixed(1)}%` : formatCompact(value);
    return `<line x1="${margins.left}" x2="${width - margins.right}" y1="${yy}" y2="${yy}" stroke="#edf0eb" stroke-dasharray="${i ? "2 4" : "0"}"/><text x="${margins.left - 7}" y="${yy + 3}" text-anchor="end" fill="#a0a9a0" font-size="8">${label}</text>`;
  }).join("");
  const ticks = data.filter((_, index) => index % 2 === 0 || index === data.length - 1)
    .map((item) => `<text x="${x(item.year)}" y="${height - 5}" text-anchor="middle" fill="#9ba49b" font-size="8">${item.year}</text>`).join("");
  const forecastPath = forecastIndex > 0 ? path(historicalEnd, data.length - 1) : "";
  const splitX = forecastIndex > 0 ? (x(data[forecastIndex - 1].year) + x(data[forecastIndex].year)) / 2 : width - margins.right;
  const band = forecastIndex > 0
    ? `<path d="${data.slice(forecastIndex).map((item, index) => `${index ? "L" : "M"}${x(item.year)},${y(values[forecastIndex + index] * 1.055)}`).join(" ")} ${data.slice(forecastIndex).reverse().map((item, index) => `L${x(item.year)},${y(values[data.length - 1 - index] * .945)}`).join(" ")} Z" fill="#eff5e7" opacity=".8"/>`
    : "";
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `${grid}<rect x="${splitX}" y="${margins.top}" width="${Math.max(0, width - margins.right - splitX)}" height="${innerH}" fill="#f8faF5"/><line x1="${splitX}" x2="${splitX}" y1="${margins.top}" y2="${height - margins.bottom}" stroke="#d9e3ce" stroke-dasharray="3 4"/>${band}${ticks}<path d="${path(0, historicalEnd)}" fill="none" stroke="#548454" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${forecastPath ? `<path d="${forecastPath}" fill="none" stroke="#9bbd58" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round"/>` : ""}<circle cx="${x(data[historicalEnd].year)}" cy="${y(values[historicalEnd])}" r="3" fill="#548454"/>`;
  document.querySelector("#forecast-method").textContent = forecastIndex > 0
    ? `Linear projection · ${data[forecastIndex].year}–${data[data.length - 1].year}`
    : "No forward projection available";
}

function fillCountyOptions() {
  const options = countyNames.map((county) => `<option value="${escapeHtml(county)}">${escapeHtml(county)}</option>`).join("");
  document.querySelector("#advisor-county").innerHTML = options;
  document.querySelector("#advisor-county").value = state.selectedCounty;
  updateSoilSourceLink();
}

function updateSoilSourceLink() {
  const county = document.querySelector("#advisor-county").value;
  const slug = county.toLocaleLowerCase()
    .replace(/['’]/g, "")
    .replace(/[\/\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
  const link = document.querySelector("#soil-source-link");
  link.href = `https://shambaiq.com/soil/${slug}/maize`;
  link.setAttribute("aria-label", `Open ShambaIQ maize soil report for ${county} in a new tab`);
}

function advisory() {
  state.advisoryGenerated = true;
  const county = document.querySelector("#advisor-county").value;
  const zone = zoneByCounty[county] || "mixed";
  const rainfall = document.querySelector("#rainfall").value;
  const soil = document.querySelector("#soil").value;
  const seedNotes = {
    highland: "Compare locally certified medium/long-season hybrids suited to cooler highland conditions.",
    western: "Compare locally certified, disease-tolerant hybrids suited to the western high-rainfall zone.",
    central: "Compare locally certified varieties matched to the county's elevation and season length.",
    arid: "Prioritize locally certified early-maturing, drought-tolerant varieties; confirm local suitability before purchase.",
    coastal: "Compare locally certified early-maturing varieties that fit the local rainfall window.",
    mixed: "Choose a locally certified variety matched to your altitude, rainfall window, and extension guidance."
  };
  const rainfallNote = {
    low: "Below-average rainfall: prioritize a timely planting window, moisture conservation, and early-maturing varieties.",
    normal: "Near-average rainfall: align planting with the onset of dependable rains and avoid waterlogged fields.",
    high: "Above-average rainfall: prioritize drainage, disease-tolerant certified seed, and avoid planting in saturated soil."
  }[rainfall];
  const soilNotes = {
    unknown: "No soil result entered. Test soil before setting a fertilizer rate; no kg/acre dose can be responsibly inferred.",
    "low-n": "Low nitrogen reported: discuss a split nitrogen top-dress plan with an extension officer; confirm the rate from a current soil test.",
    "low-p": "Low phosphorus reported: discuss a phosphorus source and placement with an extension officer; confirm the rate from a current soil test.",
    acidic: "Acidic soil reported: request soil pH and lime requirement before fertilizer planning; lime rates are soil-specific.",
    balanced: "Balanced result reported: follow the test's nutrient recommendations and avoid adding nutrients without a diagnosed need."
  }[soil];
  const soilLabel = document.querySelector("#soil").selectedOptions[0].textContent;
  const latestSoilSample = state.soilRecords.filter((record) => record.county === county && record.recordType === "sample")
    .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate))[0];
  const countySoilReport = state.soilRecords.find((record) => record.county === county && record.recordType === "county-report");
  const soilHistoryNote = latestSoilSample
    ? `<p class="result-note">Latest imported sample (${escapeHtml(latestSoilSample.sampleDate)}): pH ${latestSoilSample.ph === null ? "not reported" : latestSoilSample.ph}, N ${escapeHtml(latestSoilSample.nitrogen)}, P ${escapeHtml(latestSoilSample.phosphorus)}. Use the lab's recommendations to set rates.</p>`
    : "";
  const countyReportNote = countySoilReport
    ? `<p class="result-note">Undated ShambaIQ county estimate (user-provided): pH ${countySoilReport.ph}, N ${countySoilReport.nitrogenGkg} g/kg, P ${countySoilReport.phosphorusMgkg} mg/kg, K ${countySoilReport.potassiumMgkg === null ? "not provided" : `${countySoilReport.potassiumMgkg} mg/kg`}; reported score ${countySoilReport.reportedScore}. This is not a farm soil sample or fertilizer-rate recommendation.</p>`
    : "";
  document.querySelector("#advisor-output").innerHTML = `
    <div class="recommendation-result">
      <div class="result-eyebrow">FIELD NOTES · ${escapeHtml(county.toLocaleUpperCase())} · ${escapeHtml(document.querySelector("#rainfall").selectedOptions[0].textContent.toLocaleUpperCase())} RAINFALL</div>
      <div class="result-grid">
        <div class="result-item"><span>SEED TO COMPARE</span><strong>${escapeHtml(seedNotes[zone])}</strong></div>
        <div class="result-item"><span>FERTILIZER · ${escapeHtml(soilLabel.toLocaleUpperCase())}</span><strong>${escapeHtml(soilNotes)}</strong></div>
      </div>
      ${soilHistoryNote}
      ${countyReportNote}
      <p>${escapeHtml(rainfallNote)}</p>
    </div>
    <div class="output-disclaimer"><span>ⓘ</span> These are general decision prompts, not a farm-specific prescription. Verify seed availability/certification, soil-test results, planting date, and rates with your county agricultural extension officer.</div>
    <div id="history-context" class="history-context" aria-live="polite"></div>`;
  renderHistoryContext();
}

function renderHistoryContext() {
  const county = document.querySelector("#advisor-county").value;
  const countyWeather = state.weatherRecords.filter((record) => record.county === county);
  const weather = countyWeather
    .sort((a, b) => b.year - a.year || b.season.localeCompare(a.season)).slice(0, 4);
  const countySoilReports = state.soilRecords.filter((record) => record.county === county && record.recordType === "county-report");
  const soilSamples = state.soilRecords.filter((record) => record.county === county && record.recordType === "sample")
    .sort((a, b) => b.sampleDate.localeCompare(a.sampleDate)).slice(0, 4);
  const stationWeather = weather.filter((record) => record.station);
  const countyWeatherHistory = weather.filter((record) => !record.station);
  const weatherBySeason = new Map();
  countyWeatherHistory.forEach((record) => {
    const key = record.season.toLocaleLowerCase();
    if (!weatherBySeason.has(key)) weatherBySeason.set(key, []);
    weatherBySeason.get(key).push(record);
  });
  const weatherPattern = Array.from(weatherBySeason.values()).map((records) => {
    const average = records.reduce((sum, record) => sum + record.rainfallMm, 0) / records.length;
    return `${escapeHtml(records[0].season)}: ${average.toLocaleString("en-KE", { maximumFractionDigits: 1 })} mm average (${records.length} ${records.length === 1 ? "record" : "records"})`;
  }).join("; ");
  const weatherRows = weather.map((record) =>
    `<li><span>${record.station ? `${escapeHtml(record.station)} · ` : ""}${record.year} · ${escapeHtml(record.period || record.season)}</span><strong>${record.rainfallMm.toLocaleString("en-KE", { maximumFractionDigits: 1 })} mm</strong></li>`
  ).join("");
  const soilRows = soilSamples.map((record) =>
    `<li><span>${escapeHtml(record.sampleDate)} · pH ${record.ph === null ? "not reported" : record.ph}</span><strong>N: ${escapeHtml(record.nitrogen)} · P: ${escapeHtml(record.phosphorus)}</strong></li>`
  ).join("");
  const soilReportRows = countySoilReports.map((record) =>
    `<li><span>Undated county estimate · reported score ${record.reportedScore}</span><strong>pH ${record.ph} · N ${record.nitrogenGkg} g/kg · P ${record.phosphorusMgkg} mg/kg · K ${record.potassiumMgkg === null ? "not reported" : `${record.potassiumMgkg} mg/kg`}</strong></li>`
  ).join("");
  const soilCaveat = countySoilReports.length
    ? "County estimates are undated and are not farm samples. Potassium values were not included in the supplied report text. Use a current farm soil test for fertilizer rates."
    : "Soil sample history is user-supplied; confirm results and fertilizer rates with a qualified soil lab or county agricultural extension officer.";
  const container = document.querySelector("#history-context");
  if (!state.weatherRecords.length && !state.soilRecords.length) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = `<div class="history-context-heading">IMPORTED HISTORY · ${escapeHtml(county.toLocaleUpperCase())}</div>
    <div class="history-context-grid">
      <section>${stationWeather.length ? `<h3>KMD station observations · not county totals</h3><ul>${stationWeather.map((record) => `<li><span>${escapeHtml(record.station)} · ${escapeHtml(record.period)}</span><strong>${record.rainfallMm.toLocaleString("en-KE", { maximumFractionDigits: 2 })} mm</strong></li>`).join("")}</ul>` : weatherPattern ? `<h3>Rainfall pattern</h3><p class="history-pattern">${weatherPattern}</p>` : '<h3>Rainfall history</h3><p>No rainfall records for this county.</p>'}${countyWeatherHistory.length ? `<h3>Recent rainfall records</h3><ul>${countyWeatherHistory.map((record) => `<li><span>${record.year} · ${escapeHtml(record.period || record.season)}</span><strong>${record.rainfallMm.toLocaleString("en-KE", { maximumFractionDigits: 1 })} mm</strong></li>`).join("")}</ul>` : ""}</section>
      <section>${soilReportRows ? `<h3>County soil estimates · not lab samples</h3><ul>${soilReportRows}</ul>` : ""}${soilRows ? `<h3>Farm soil samples · latest records</h3><ul>${soilRows}</ul>` : !soilReportRows ? '<h3>Farm soil samples</h3><p>No soil samples for this county.</p>' : ""}</section>
    </div>
    <p class="history-caveat">${soilCaveat}</p>`;
}

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { fields.push(value.trim()); value = ""; }
    else value += char;
  }
  fields.push(value.trim());
  return fields;
}

function importCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("CSV must include a header and at least one data row.");
  const headers = parseCsvLine(lines.shift()).map((value) => value.toLocaleLowerCase().replace(/[\s-]+/g, "_"));
  const countyIndex = headers.indexOf("county");
  const yearIndex = headers.indexOf("year");
  const productionIndex = headers.findIndex((header) => ["production_tonnes", "production", "tonnes"].includes(header));
  if ([countyIndex, yearIndex, productionIndex].includes(-1)) {
    throw new Error("Required columns: county, year, production_tonnes (or production).");
  }
  const lookup = countyLookup();
  const imported = [];
  lines.forEach((line, index) => {
    const row = parseCsvLine(line);
    const county = lookup.get((row[countyIndex] || "").toLocaleLowerCase());
    const year = Number(row[yearIndex]);
    const production = Number((row[productionIndex] || "").replace(/,/g, ""));
    if (!county || !Number.isInteger(year) || year < 1900 || year > 2100 || !Number.isFinite(production) || production < 0) {
      throw new Error(`Invalid county, year, or production in CSV row ${index + 2}.`);
    }
    imported.push({ county, year, production });
  });
  const unique = new Set(imported.map((item) => `${item.county}|${item.year}`));
  if (unique.size !== imported.length) throw new Error("CSV contains duplicate county/year rows.");
  return imported;
}

function normalizedHeaders(line) {
  return parseCsvLine(line).map((value) => value.toLocaleLowerCase().replace(/[\s-]+/g, "_"));
}

function countyLookup() {
  const lookup = new Map(countyNames.map((county) => [county.toLocaleLowerCase(), county]));
  const aliases = {
    "elgeyo/marakwet": "Elgeyo-Marakwet",
    homabay: "Homa Bay",
    "taita/taveta": "Taita-Taveta",
    "tharaka-nthi": "Tharaka-Nithi"
  };
  Object.entries(aliases).forEach(([alias, county]) => lookup.set(alias, county));
  return lookup;
}

function parseWeatherCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Rainfall CSV must include a header and at least one data row.");
  const headers = normalizedHeaders(lines.shift());
  const countyIndex = headers.indexOf("county");
  const yearIndex = headers.indexOf("year");
  const seasonIndex = headers.indexOf("season");
  const periodIndex = headers.indexOf("period");
  const rainfallIndex = headers.indexOf("rainfall_mm");
  const stationIndex = headers.indexOf("station");
  const sourceUrlIndex = headers.indexOf("source_url");
  if ([countyIndex, yearIndex, rainfallIndex].includes(-1) || (seasonIndex < 0 && periodIndex < 0)) {
    throw new Error("Rainfall CSV requires county, year, season (or period), rainfall_mm columns.");
  }
  const lookup = countyLookup();
  const records = lines.map((line, index) => {
    const row = parseCsvLine(line);
    const county = lookup.get((row[countyIndex] || "").toLocaleLowerCase());
    const year = Number(row[yearIndex]);
    const season = (row[seasonIndex >= 0 ? seasonIndex : periodIndex] || "").trim();
    const station = stationIndex >= 0 ? (row[stationIndex] || "").trim() : "";
    const rainfallText = (row[rainfallIndex] || "").trim();
    const rainfallMm = Number(rainfallText.replace(/,/g, ""));
    if (!county || !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() || !season || !rainfallText || !Number.isFinite(rainfallMm) || rainfallMm < 0) {
      throw new Error(`Invalid county, year, season, or rainfall in CSV row ${index + 2}.`);
    }
    return {
      county,
      year,
      season,
      period: periodIndex >= 0 ? season : "",
      station,
      sourceUrl: sourceUrlIndex >= 0 ? (row[sourceUrlIndex] || "").trim() : "",
      rainfallMm
    };
  });
  const unique = new Set(records.map((record) => `${record.county}|${record.year}|${record.season.toLocaleLowerCase()}|${record.station.toLocaleLowerCase()}`));
  if (unique.size !== records.length) throw new Error("Rainfall CSV contains duplicate county/year/season rows.");
  return records;
}

function parseSoilCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Soil CSV must include a header and at least one data row.");
  const headers = normalizedHeaders(lines.shift());
  const countyIndex = headers.indexOf("county");
  const phIndex = headers.indexOf("ph");
  const reportDateIndex = headers.indexOf("report_date");
  const nitrogenGkgIndex = headers.indexOf("nitrogen_g_kg");
  const phosphorusMgkgIndex = headers.indexOf("phosphorus_mg_kg");
  const potassiumMgkgIndex = headers.indexOf("potassium_mg_kg");
  const soilScoreIndex = headers.indexOf("reported_score");
  const sourceTypeIndex = headers.indexOf("source_type");
  const countyReportFormat = [countyIndex, phIndex, reportDateIndex, nitrogenGkgIndex, phosphorusMgkgIndex,
    potassiumMgkgIndex, soilScoreIndex, sourceTypeIndex].every((index) => index >= 0);
  if (countyReportFormat) {
    const lookup = countyLookup();
    const records = lines.map((line, index) => {
      const row = parseCsvLine(line);
      const county = lookup.get((row[countyIndex] || "").toLocaleLowerCase());
      const numberOrNull = (value) => {
        const text = (value || "").trim();
        return text ? Number(text.replace(/,/g, "")) : null;
      };
      const ph = numberOrNull(row[phIndex]);
      const nitrogenGkg = numberOrNull(row[nitrogenGkgIndex]);
      const phosphorusMgkg = numberOrNull(row[phosphorusMgkgIndex]);
      const potassiumMgkg = numberOrNull(row[potassiumMgkgIndex]);
      const reportedScore = numberOrNull(row[soilScoreIndex]);
      const sourceType = (row[sourceTypeIndex] || "").trim();
      const validMeasurement = (value) => value === null || (Number.isFinite(value) && value >= 0);
      if (!county || ph === null || ph > 14 || !validMeasurement(nitrogenGkg) ||
          !validMeasurement(phosphorusMgkg) || !validMeasurement(potassiumMgkg) ||
          reportedScore === null || !Number.isFinite(reportedScore) || reportedScore < 0 || reportedScore > 100 || !sourceType) {
        throw new Error(`Invalid county soil estimate in CSV row ${index + 2}.`);
      }
      return { county, recordType: "county-report", ph, nitrogenGkg, phosphorusMgkg, potassiumMgkg, reportedScore, sourceType };
    });
    const unique = new Set(records.map((record) => record.county));
    if (unique.size !== records.length) throw new Error("County soil report CSV contains duplicate counties.");
    return records;
  }
  const dateIndex = headers.indexOf("sample_date");
  const nitrogenIndex = headers.indexOf("nitrogen_status");
  const phosphorusIndex = headers.indexOf("phosphorus_status");
  if ([countyIndex, dateIndex, phIndex, nitrogenIndex, phosphorusIndex].includes(-1)) {
    throw new Error("Soil CSV requires county, sample_date, ph, nitrogen_status, phosphorus_status columns.");
  }
  const lookup = countyLookup();
  const records = lines.map((line, index) => {
    const row = parseCsvLine(line);
    const county = lookup.get((row[countyIndex] || "").toLocaleLowerCase());
    const sampleDate = (row[dateIndex] || "").trim();
    const parsedDate = new Date(`${sampleDate}T00:00:00Z`);
    const phText = (row[phIndex] || "").trim();
    const ph = phText ? Number(phText) : null;
    const nitrogen = (row[nitrogenIndex] || "unknown").trim().toLocaleLowerCase();
    const phosphorus = (row[phosphorusIndex] || "unknown").trim().toLocaleLowerCase();
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(sampleDate) &&
      Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === sampleDate;
    const notFutureDate = sampleDate <= new Date().toISOString().slice(0, 10);
    const validStatus = (value) => ["low", "adequate", "high", "unknown"].includes(value);
    if (!county || !validDate || !notFutureDate || (ph !== null && (!Number.isFinite(ph) || ph < 0 || ph > 14)) ||
        !validStatus(nitrogen) || !validStatus(phosphorus)) {
      throw new Error(`Invalid county, sample date, pH, or nutrient status in CSV row ${index + 2}.`);
    }
    return { county, recordType: "sample", sampleDate, ph, nitrogen, phosphorus };
  });
  const unique = new Set(records.map((record) => `${record.county}|${record.sampleDate}`));
  if (unique.size !== records.length) throw new Error("Soil CSV contains duplicate county/sample-date rows.");
  return records;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 4000);
}

function downloadRanking() {
  const rows = countyTotals(state.rankingYear);
  const csv = ["rank,county,year,production_tonnes,share_percent", ...rows.map((item, index) => {
    const national = rows.reduce((sum, row) => sum + row.production, 0) || 1;
    return `${index + 1},"${item.county.replace(/"/g, '""')}",${state.rankingYear},${item.production},${(item.production / national * 100).toFixed(2)}`;
  })].join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `kenya-maize-county-ranking-${state.rankingYear}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderAll() { renderDataLabels(); renderStats(); renderRanking(); renderChart(); }

const dashboardViews = {
  overview: { key: "overview" },
  "county-table": {
    key: "rankings",
    title: "County production ranking",
    description: "Compare production and each county's share of the national total."
  },
  forecast: {
    key: "forecast",
    title: "Production forecast",
    description: "Explore historical production and a simple trend scenario through 2030."
  },
  advisor: { key: "advisor" }
};

function activateDashboardView(hash = window.location.hash) {
  const view = dashboardViews[hash.replace(/^#/, "")] || dashboardViews.overview;
  const main = document.querySelector("#main-content");
  const overviewHeading = document.querySelector("#overview");
  const stats = document.querySelector(".stats-grid");
  const dashboardGrid = document.querySelector(".dashboard-grid");
  const forecastPanel = document.querySelector("#forecast");
  const countyPanel = document.querySelector("#county-table");
  const advisor = document.querySelector("#advisor");
  const viewHeading = document.querySelector("#view-heading");

  main.dataset.view = view.key;
  overviewHeading.hidden = view.key !== "overview";
  stats.hidden = view.key !== "overview";
  dashboardGrid.hidden = view.key === "advisor";
  forecastPanel.hidden = view.key === "rankings" || view.key === "advisor";
  countyPanel.hidden = view.key === "forecast" || view.key === "advisor";
  advisor.hidden = view.key !== "advisor";
  viewHeading.hidden = view.key !== "rankings" && view.key !== "forecast";
  if (!viewHeading.hidden) {
    document.querySelector("#view-title").textContent = view.title;
    document.querySelector("#view-description").textContent = view.description;
  }

  const activeHref = dashboardViews[hash.replace(/^#/, "")] ? hash : "#overview";
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.getAttribute("href") === activeHref;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  if (view.key === "rankings") state.showAll = true;
  renderRanking();
  renderChart();
}

fillCountyOptions();
renderAll();
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const href = link.getAttribute("href");
    if (window.location.hash !== href) history.pushState(null, "", href);
    activateDashboardView(href);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});
window.addEventListener("hashchange", () => activateDashboardView());
activateDashboardView();
if (state.weatherRecords.length) {
  const observedPeriods = [...new Set(state.weatherRecords.map((record) => record.period).filter(Boolean))];
  document.querySelector("#weather-data-status").textContent =
    `${state.weatherRecords.length} KMD station readings · ${observedPeriods.join(", ")}`;
  renderHistoryContext();
}

document.querySelector("#ranking-year").addEventListener("change", (event) => {
  state.rankingYear = Number(event.target.value);
  renderAll();
});
document.querySelector("#county-search").addEventListener("input", () => { state.showAll = false; renderRanking(); });
document.querySelector("#show-all").addEventListener("click", () => { state.showAll = !state.showAll; renderRanking(); });
document.querySelector("#chart-mode").addEventListener("change", (event) => { state.chartMode = event.target.value; renderChart(); });
document.querySelector("#advisor-county").addEventListener("change", (event) => {
  state.selectedCounty = event.target.value;
  updateSoilSourceLink();
  if (state.advisoryGenerated) advisory();
  else renderHistoryContext();
});
document.querySelector("#recommend-button").addEventListener("click", advisory);
document.querySelector("#export-button").addEventListener("click", downloadRanking);
document.querySelector("#weather-upload").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state.weatherRecords = parseWeatherCsv(await file.text());
    document.querySelector("#weather-data-status").textContent = `${state.weatherRecords.length} rainfall records · ${file.name}`;
    renderHistoryContext();
    showToast(`Loaded ${state.weatherRecords.length} rainfall history records.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    event.target.value = "";
  }
});
document.querySelector("#soil-upload").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state.soilRecords = parseSoilCsv(await file.text());
    const hasCountyReports = state.soilRecords.some((record) => record.recordType === "county-report");
    document.querySelector("#soil-data-status").textContent =
      `${state.soilRecords.length} ${hasCountyReports ? "county estimates" : `soil sample${state.soilRecords.length === 1 ? "" : "s"}`} · ${file.name}`;
    if (state.advisoryGenerated) advisory();
    else renderHistoryContext();
    showToast(`Loaded ${state.soilRecords.length} ${hasCountyReports ? "county soil estimates" : "soil sample history records"}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    event.target.value = "";
  }
});
document.querySelector("#csv-upload").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    state.records = importCsv(await file.text());
    state.sourceName = file.name;
    const availableYears = allYears();
    state.rankingYear = availableYears[availableYears.length - 1];
    document.querySelector("#dataset-badge").textContent = "IMPORTED DATA";
    renderAll();
    showToast(`Loaded ${state.records.length} county-year records. Forecasts use a linear trend.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    event.target.value = "";
  }
});
window.addEventListener("resize", renderChart);
renderHistoryContext();
