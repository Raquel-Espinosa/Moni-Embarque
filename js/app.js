/**
 * =========================================================================================
 * LÓGICA PRINCIPAL - DASHBOARD DE EMBARQUES PETCO
 * =========================================================================================
 * Fuente vinculada: 1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E
 *
 * Estructura exacta de columnas en la hoja:
 *  - Col A: Num.Conteo
 *  - Col B: Ce. (Número de tienda, ej. 7269)
 *  - Col C: Nombre (Nombre de tienda, ej. Punta Museo (Express))
 *  - Col E: Transporte (Número de transporte asignado)
 *  - Col K: Dscrp.Sts. (Embarcado / Finalizado)
 *  - Col M: Fch. Crea. (Fecha de creación DD.MM.YYYY)
 *  - Col O: Tipo Pallet (COMBINADO, ROYAL, ALIMENTO, ALTOCOSTO, ACSTOREUSE, etc.)
 *  - Col S: Valor (Importe monetario del conteo)
 *  - Col T: Tarimas Libres (1 = Tarima Libre real en piso, 0 = No es tarima libre)
 *  - Col U: Alto costo Libre (1 = Remonte de Alto Costo sin transporte, NO es tarima)
 */

const state = {
  rawRecords: [],
  normalizedRecords: [],
  filteredRecords: [],
  detectedMapping: {},
  sourceType: "connecting", // "gviz" | "apps_script" | "local_file" | "demo"
  lastUpdated: null,
  charts: {
    stores: null,
    palletTypes: null,
    dates: null,
    aging: null
  },
  filters: {
    search: "",
    store: "ALL",
    palletType: "ALL",
    status: "ALL",
    date: "ALL"
  }
};

// =========================================================================================
// INICIALIZACIÓN
// =========================================================================================
document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) {
    lucide.createIcons();
  }
  bindEvents();
  loadDashboardData();

  if (EMBARQUES_CONFIG.AUTO_REFRESH_SECONDS > 0) {
    setInterval(() => {
      if (state.sourceType === "gviz" || state.sourceType === "apps_script") {
        loadDashboardData(true);
      }
    }, EMBARQUES_CONFIG.AUTO_REFRESH_SECONDS * 1000);
  }
});

// =========================================================================================
// EVENTOS DE INTERFAZ
// =========================================================================================
function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      switchTab(target);
    });
  });

  document.getElementById("filter-search").addEventListener("input", e => {
    state.filters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
  });

  document.getElementById("filter-store").addEventListener("change", e => {
    state.filters.store = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById("filter-pallet-type").addEventListener("change", e => {
    state.filters.palletType = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById("filter-status").addEventListener("change", e => {
    state.filters.status = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById("filter-date").addEventListener("change", e => {
    state.filters.date = e.target.value;
    applyFiltersAndRender();
  });

  document.getElementById("btn-clear-filters").addEventListener("click", () => {
    resetFilters();
  });

  document.getElementById("btn-refresh").addEventListener("click", () => {
    loadDashboardData(false);
  });

  document.getElementById("file-upload-input").addEventListener("change", handleFileUpload);
  document.getElementById("btn-export").addEventListener("click", exportCurrentViewToExcel);

  document.getElementById("btn-open-settings").addEventListener("click", openSettingsModal);
  document.getElementById("btn-alert-config").addEventListener("click", openSettingsModal);
  document.getElementById("btn-close-settings").addEventListener("click", closeSettingsModal);
  document.getElementById("btn-cancel-settings").addEventListener("click", closeSettingsModal);
  document.getElementById("btn-save-settings").addEventListener("click", saveSettingsAndReload);
}

function switchTab(targetId) {
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("hidden", panel.id !== targetId);
  });

  document.querySelectorAll(".tab-btn").forEach(btn => {
    const isActive = btn.getAttribute("data-tab") === targetId;
    if (isActive) {
      btn.className = "tab-btn active-tab inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#001952] text-white shadow-sm transition";
    } else {
      btn.className = "tab-btn inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition";
    }
  });
}

function resetFilters() {
  state.filters = {
    search: "",
    store: "ALL",
    palletType: "ALL",
    status: "ALL",
    date: "ALL"
  };
  document.getElementById("filter-search").value = "";
  document.getElementById("filter-store").value = "ALL";
  document.getElementById("filter-pallet-type").value = "ALL";
  document.getElementById("filter-status").value = "ALL";
  document.getElementById("filter-date").value = "ALL";
  applyFiltersAndRender();
}

// =========================================================================================
// CARGA DE DATOS EN VIVO DESDE GOOGLE SHEETS
// =========================================================================================
async function loadDashboardData(silent = false) {
  const refreshIcon = document.getElementById("refresh-icon");
  if (refreshIcon) refreshIcon.classList.add("animate-spin");
  updateConnectionBadge("connecting", "Sincronizando...");

  try {
    if (EMBARQUES_CONFIG.CONNECTION_MODE === "demo") {
      useDemoDataset("Modo Demo seleccionado manualmente");
      return;
    }

    // 1. Lectura directa en vivo desde Google Sheets (1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E)
    try {
      const rows = await fetchFromGoogleSheetDirect(EMBARQUES_CONFIG.SHEET_ID, EMBARQUES_CONFIG.SHEET_TAB);
      if (rows && rows.length > 0) {
        processLoadedRows(rows, "gviz", "Google Sheets En Vivo");
        return;
      }
    } catch (directErr) {
      console.warn("Error en lectura directa de Google Sheets:", directErr);
    }

    // 2. Respaldo por Apps Script si se configuró URL
    if (EMBARQUES_CONFIG.APPS_SCRIPT_URL && EMBARQUES_CONFIG.APPS_SCRIPT_URL.trim() !== "") {
      try {
        const rows = await fetchFromAppsScript(EMBARQUES_CONFIG.APPS_SCRIPT_URL, EMBARQUES_CONFIG.SHEET_TAB);
        if (rows && rows.length > 0) {
          processLoadedRows(rows, "apps_script", "Google Sheets (Apps Script)");
          return;
        }
      } catch (scriptErr) {
        console.warn("Apps Script no disponible:", scriptErr);
      }
    }

    useDemoDataset(
      `No se pudo contactar la hoja ${EMBARQUES_CONFIG.SHEET_ID}. Verifica tu conexión a internet.`
    );
  } finally {
    if (refreshIcon) refreshIcon.classList.remove("animate-spin");
  }
}

async function fetchFromGoogleSheetDirect(sheetId, tabName) {
  const fixedId = "1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E";
  const sheetParam = tabName ? `&sheet=${encodeURIComponent(tabName)}` : "";

  // IMPORTANTE: Priorizamos /export?format=csv porque preserva tipos mixtos en la Columna L (Nom.Docum. con "A-...")
  // mientras que gviz/tq elimina strings ("A-...") en columnas mayoritariamente numéricas.
  const csvEndpoints = [
    `https://docs.google.com/spreadsheets/d/${fixedId}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${fixedId}/gviz/tq?tqx=out:csv${sheetParam}`
  ];

  // Intento A: Fetch directo a los endpoints CSV públicos de Google Sheets
  for (const csvUrl of csvEndpoints) {
    try {
      const res = await fetch(csvUrl, { method: "GET", cache: "no-store" });
      if (res.ok) {
        const csvText = await res.text();
        if (
          csvText &&
          !csvText.trim().startsWith("<!DOCTYPE") &&
          !csvText.includes("show-login-page") &&
          !csvText.includes("accounts.google.com")
        ) {
          const workbook = XLSX.read(csvText, { type: "string", raw: false });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const matrix = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
          const parsedRecords = convertMatrixToRecords(matrix);
          if (parsedRecords.length > 0) {
            return parsedRecords;
          }
        }
      }
    } catch (e) {
      // Continuar al siguiente endpoint
    }
  }

  // Intento B: JSONP Visualization API
  return new Promise((resolve, reject) => {
    const callbackName = "petcoSheetCallback_" + Math.floor(Math.random() * 1000000);
    const script = document.createElement("script");
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        reject(new Error("Tiempo de espera agotado al consultar Google Sheets"));
      }
    }, 8000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (response) {
      if (finished) return;
      finished = true;
      cleanup();

      if (!response || response.status === "error" || !response.table) {
        reject(new Error("Respuesta inválida de Google Visualization API"));
        return;
      }

      const table = response.table;
      const matrix = [];

      const colLabels = table.cols.map(col => (col && col.label ? String(col.label).trim() : ""));
      if (colLabels.some(l => l !== "")) {
        matrix.push(colLabels);
      }

      for (let r = 0; r < table.rows.length; r++) {
        const rowCells = table.rows[r].c || [];
        const rowArr = [];
        for (let c = 0; c < table.cols.length; c++) {
          const cell = rowCells[c];
          const val = cell ? (cell.f !== undefined && cell.f !== null ? cell.f : cell.v) : "";
          rowArr.push(val !== null && val !== undefined ? val : "");
        }
        matrix.push(rowArr);
      }

      const records = convertMatrixToRecords(matrix);
      resolve(records);
    };

    script.src = `https://docs.google.com/spreadsheets/d/${fixedId}/gviz/tq?tqx=responseHandler:${callbackName}${sheetParam}`;
    script.onerror = () => {
      if (!finished) {
        finished = true;
        cleanup();
        reject(new Error("No se pudo conectar a Google Sheets"));
      }
    };

    document.body.appendChild(script);
  });
}

function convertMatrixToRecords(matrix) {
  if (!matrix || matrix.length === 0) return [];

  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(12, matrix.length); r++) {
    const joined = matrix[r].map(c => normalizeKey(c)).join(" ");
    if (
      joined.includes("tarimaslibres") ||
      joined.includes("numconteo") ||
      joined.includes("nomdocum") ||
      joined.includes("tipopallet") ||
      joined.includes("transporte")
    ) {
      headerRowIdx = r;
      break;
    }
  }

  const rawHeaders = matrix[headerRowIdx].map((h, idx) => {
    const clean = String(h || "").trim();
    return clean !== "" ? clean : `Columna_${idx + 1}`;
  });

  const records = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (!row || row.every(cell => String(cell || "").trim() === "")) continue;

    const obj = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      obj[rawHeaders[c]] = row[c] !== undefined && row[c] !== null ? row[c] : "";
    }
    records.push(obj);
  }
  return records;
}

async function fetchFromAppsScript(scriptUrl, tabName) {
  const url = new URL(scriptUrl);
  url.searchParams.set("action", "getData");
  if (tabName) url.searchParams.set("tab", tabName);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data.success || !Array.isArray(data.rows)) {
    throw new Error(data.error || "Respuesta inválida");
  }
  return data.rows;
}

// =========================================================================================
// SUBIDA MANUAL DE ARCHIVO EXCEL / CSV
// =========================================================================================
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: false });
      const jsonRows = convertMatrixToRecords(matrix);

      if (jsonRows.length === 0) {
        alert("El archivo seleccionado no contiene filas válidas.");
        return;
      }

      processLoadedRows(jsonRows, "local_file", `Archivo: ${file.name}`);
    } catch (err) {
      alert("Error al leer el archivo: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// =========================================================================================
// NORMALIZACIÓN Y REGLA DE NEGOCIO (COLUMNA L "Nom.Docum." CON "A-" O COLUMNAS T y U)
// =========================================================================================
function normalizeKey(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function detectColumns(sampleRow) {
  const keys = Object.keys(sampleRow || {});
  const normalizedMap = keys.map(k => ({ raw: k, norm: normalizeKey(k) }));

  function matchField(aliasList) {
    if (!aliasList) return null;
    const normAliases = aliasList.map(a => normalizeKey(a));
    for (const alias of normAliases) {
      const exact = normalizedMap.find(k => k.norm === alias);
      if (exact) return exact.raw;
    }
    for (const alias of normAliases) {
      const partial = normalizedMap.find(k => k.norm.includes(alias) || alias.includes(k.norm));
      if (partial && partial.norm.length >= 2) return partial.raw;
    }
    return null;
  }

  return {
    numConteo: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.numConteo),
    ceCodigo: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.ceCodigo),
    ceNombre: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.ceNombre),
    grupo: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.grupo),
    transporte: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.transporte),
    estatusCodigo: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.estatusCodigo),
    estatusDescripcion: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.estatusDescripcion),
    nomDocum: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.nomDocum),
    fechaCreacion: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.fechaCreacion),
    horaCreacion: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.horaCreacion),
    tipoPallet: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.tipoPallet),
    fechaTransporte: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.fechaTransporte),
    valor: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.valor),
    tarimasLibres: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.tarimasLibres),
    altoCostoLibre: matchField(EMBARQUES_CONFIG.COLUMN_ALIASES.altoCostoLibre)
  };
}

function parseFlexibleDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  const str = String(val).trim();
  if (!str) return null;

  const dmyMatch = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const ymdMatch = str.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateISO(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return "Sin fecha";
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateObj, rawFallback) {
  if (!dateObj || isNaN(dateObj.getTime())) return rawFallback || "S/F";
  const d = String(dateObj.getDate()).padStart(2, "0");
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

function parseNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/,/g, "").replace(/\$/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function processLoadedRows(rawRows, sourceType, sourceLabel) {
  state.rawRecords = rawRows;
  state.sourceType = sourceType;
  state.lastUpdated = new Date();

  const mapping = detectColumns(rawRows[0] || {});
  state.detectedMapping = mapping;

  const detectedInfoEl = document.getElementById("detected-columns-info");
  if (detectedInfoEl) {
    detectedInfoEl.textContent = JSON.stringify(mapping, null, 2);
  }

  let maxDateMs = 0;
  const tempDates = rawRows.map(row => {
    const rawDate = mapping.fechaCreacion ? row[mapping.fechaCreacion] : "";
    const parsed = parseFlexibleDate(rawDate);
    if (parsed && parsed.getTime() > maxDateMs) {
      maxDateMs = parsed.getTime();
    }
    return parsed;
  });

  const referenceDate = maxDateMs > 0 ? new Date(maxDateMs) : new Date();
  const normalized = [];

  rawRows.forEach((row, idx) => {
    const numConteo = mapping.numConteo ? String(row[mapping.numConteo] || "").trim() : `${idx + 1}`;

    // 1. Tienda: Ce. + Nombre (ej. "7269 - Punta Museo (Express)")
    const ceCod = mapping.ceCodigo ? String(row[mapping.ceCodigo] || "").trim() : "";
    const ceNom = mapping.ceNombre ? String(row[mapping.ceNombre] || "").trim() : "";
    let ceFull = "";
    if (ceCod && ceNom && !ceNom.includes(ceCod)) {
      ceFull = `${ceCod} - ${ceNom}`;
    } else {
      ceFull = ceNom || ceCod || "Sin Tienda";
    }

    // 2. Columna L: Nom.Docum. (Los que empiezan con "A-" son Remontes / Alto Costo)
    const nomDocum = mapping.nomDocum ? String(row[mapping.nomDocum] || "").trim() : "";
    const esDocumRemonte = nomDocum.toUpperCase().startsWith("A-");

    // 3. Tipo Pallet
    let tipoPallet = mapping.tipoPallet ? String(row[mapping.tipoPallet] || "").trim().toUpperCase() : "";
    if (!tipoPallet) tipoPallet = "SIN TIPO";

    // 4. Transporte
    let transporte = mapping.transporte ? String(row[mapping.transporte] || "").trim() : "";
    const cleanTrans = transporte.toLowerCase();
    const tieneTransporte =
      transporte !== "" &&
      cleanTrans !== "0" &&
      cleanTrans !== "sin transporte" &&
      cleanTrans !== "pendiente" &&
      cleanTrans !== "-";

    if (!tieneTransporte) {
      transporte = "";
    }

    // 5. Cálculo de Tarimas Libres y Remontes (Alto Costo Libre):
    //    - Si existen las columnas T ("Tarimas Libres") y U ("Alto costo Libre"), las toma directamente.
    //    - Si NO existen (reporte crudo de SAP), lo calcula automáticamente con la Columna L (Nom.Docum.):
    //      * Si no tiene Transporte y Nom.Docum. empieza con "A-" -> Remonte / Alto Costo Libre (1)
    //      * Si no tiene Transporte y Nom.Docum. NO empieza con "A-" (y tiene documento/pallet válido) -> Tarima Libre (1)
    let tarimaLibreCount = 0;
    let altoCostoLibreCount = 0;

    if (mapping.tarimasLibres !== null && row[mapping.tarimasLibres] !== undefined && String(row[mapping.tarimasLibres]).trim() !== "") {
      tarimaLibreCount = parseNumber(row[mapping.tarimasLibres]);
    } else if (!tieneTransporte && nomDocum !== "" && !esDocumRemonte && tipoPallet !== "SIN TIPO") {
      tarimaLibreCount = 1;
    }

    if (mapping.altoCostoLibre !== null && row[mapping.altoCostoLibre] !== undefined && String(row[mapping.altoCostoLibre]).trim() !== "") {
      altoCostoLibreCount = parseNumber(row[mapping.altoCostoLibre]);
    } else if (!tieneTransporte && esDocumRemonte) {
      altoCostoLibreCount = 1;
    }

    // Determinar si el registro general (incluso con transporte) es un remonte ("A-" en Col. L)
    const esRemonteAltoCosto =
      esDocumRemonte ||
      altoCostoLibreCount > 0 ||
      tipoPallet === "ALTOCOSTO" ||
      tipoPallet.startsWith("AC");

    // 6. Valor monetario (Columna S)
    const valor = mapping.valor ? parseNumber(row[mapping.valor]) : 0;

    // 7. Estatus (Dscrp.Sts.)
    const estatusDesc = mapping.estatusDescripcion ? String(row[mapping.estatusDescripcion] || "").trim() : "";

    // 8. Fecha de Creación (Fch. Crea.)
    const rawFecha = mapping.fechaCreacion ? String(row[mapping.fechaCreacion] || "").trim() : "";
    const horaCrea = mapping.horaCreacion ? String(row[mapping.horaCreacion] || "").trim() : "";
    const fechaObj = tempDates[idx];
    const fechaISO = formatDateISO(fechaObj);
    const fechaDisplay = formatDateDisplay(fechaObj, rawFecha);

    let diasAntiguedad = 0;
    if (fechaObj) {
      const diffMs = referenceDate.getTime() - fechaObj.getTime();
      diasAntiguedad = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    normalized.push({
      id: idx + 1,
      numConteo,
      nomDocum,
      ceCodigo: ceCod,
      ceNombre: ceFull,
      tarimasLibres: tarimaLibreCount,
      altoCostoLibre: altoCostoLibreCount,
      esTarimaLibre: tarimaLibreCount > 0,
      esAltoCostoLibre: altoCostoLibreCount > 0,
      esRemonteAltoCosto,
      tipoPallet,
      transporte,
      tieneTransporte,
      valor,
      estatusDesc,
      fechaObj,
      fechaISO,
      fechaDisplay,
      horaCrea,
      diasAntiguedad,
      esRezagoTarima: tarimaLibreCount > 0 && diasAntiguedad >= EMBARQUES_CONFIG.AGING_WARNING_DAYS,
      rawRow: row
    });
  });

  state.normalizedRecords = normalized;
  populateFilterDropdowns();
  applyFiltersAndRender();

  updateConnectionBadge(sourceType, sourceLabel);
  const alertBanner = document.getElementById("connection-alert");
  if (sourceType === "demo") {
    alertBanner.classList.remove("hidden");
  } else {
    alertBanner.classList.add("hidden");
  }

  const timeStr = state.lastUpdated.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  document.getElementById("last-updated-label").textContent = `Actualizado: ${timeStr}`;
}

function updateConnectionBadge(type, text) {
  const badge = document.getElementById("connection-badge");
  const label = document.getElementById("connection-text");
  label.textContent = text;

  if (type === "gviz" || type === "apps_script") {
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30";
  } else if (type === "local_file") {
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30";
  } else if (type === "demo") {
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30";
  } else {
    badge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/20 text-slate-300 border border-slate-400/30";
  }
}

// =========================================================================================
// FILTROS Y RENDERIZADO PRINCIPAL
// =========================================================================================
function populateFilterDropdowns() {
  const stores = Array.from(new Set(state.normalizedRecords.map(r => r.ceNombre))).sort((a, b) => a.localeCompare(b, "es"));
  const palletTypes = Array.from(new Set(state.normalizedRecords.map(r => r.tipoPallet))).sort();
  const dates = Array.from(new Set(state.normalizedRecords.map(r => r.fechaISO))).sort().reverse();

  const storeSelect = document.getElementById("filter-store");
  storeSelect.innerHTML = `<option value="ALL">Todas las tiendas (${stores.length})</option>` +
    stores.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  const typeSelect = document.getElementById("filter-pallet-type");
  typeSelect.innerHTML = `<option value="ALL">Todos los tipos (${palletTypes.length})</option>` +
    palletTypes.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");

  const dateSelect = document.getElementById("filter-date");
  dateSelect.innerHTML = `<option value="ALL">Todas las fechas (${dates.length})</option>` +
    dates.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("");
}

function applyFiltersAndRender() {
  const { search, store, palletType, status, date } = state.filters;

  state.filteredRecords = state.normalizedRecords.filter(r => {
    if (store !== "ALL" && r.ceNombre !== store) return false;
    if (palletType !== "ALL" && r.tipoPallet !== palletType) return false;
    if (date !== "ALL" && r.fechaISO !== date) return false;

    if (status === "TARIMA_LIBRE" && r.tarimasLibres <= 0) return false;
    if (status === "CON_TRANSPORTE" && !r.tieneTransporte) return false;
    if (status === "ALTO_COSTO_LIBRE" && r.altoCostoLibre <= 0) return false;
    if (status === "REZAGO" && !r.esRezagoTarima) return false;

    if (search) {
      const haystack = `${r.numConteo} ${r.ceNombre} ${r.tipoPallet} ${r.transporte} ${r.fechaDisplay} ${r.estatusDesc}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  renderKPIs();
  renderSmartInsights();
  renderCharts();
  renderStoresTable();
  renderTransportsGrid();
  renderDetailTable();
}

// =========================================================================================
// RENDERIZADO DE TARJETAS KPI (BASADO ESTRICTAMENTE EN COLUMNA T Y COLUMNA U)
// =========================================================================================
function renderKPIs() {
  const records = state.filteredRecords;

  // 1. Suma exacta de Columna T (Tarimas Libres)
  const totalTarimasLibres = records.reduce((acc, r) => acc + r.tarimasLibres, 0);
  const valorTarimasLibres = records
    .filter(r => r.tarimasLibres > 0)
    .reduce((acc, r) => acc + r.valor, 0);

  // 2. Suma exacta de Columna U (Alto Costo Libre / Remontes)
  const totalAltoCostoLibre = records.reduce((acc, r) => acc + r.altoCostoLibre, 0);

  // 3. Con Transporte Asignado (diferenciando tarimas físicas vs remontes de alto costo en transporte)
  const assignedRecords = records.filter(r => r.tieneTransporte);
  const assignedPhysicalPallets = assignedRecords.filter(r => !r.esRemonteAltoCosto).length;
  const assignedAltoCosto = assignedRecords.filter(r => r.esRemonteAltoCosto).length;

  // 4. Tiendas activas y tiendas con Tarimas Libres (Col. T > 0)
  const uniqueStores = new Set(records.map(r => r.ceNombre));
  const storesWithTarimasLibres = new Set(records.filter(r => r.tarimasLibres > 0).map(r => r.ceNombre));

  // 5. Transportes activos
  const activeTransports = new Set(assignedRecords.map(r => r.transporte));
  const avgPhysicalPerTransport = activeTransports.size > 0
    ? (assignedPhysicalPallets / activeTransports.size).toFixed(1)
    : "0";

  // 6. Rezago en Tarimas Libres (únicamente donde Columna T > 0 y antigüedad >= 2 días)
  const agingTarimasLibres = records
    .filter(r => r.esRezagoTarima)
    .reduce((acc, r) => acc + r.tarimasLibres, 0);

  const avgAgingTarimasLibres = totalTarimasLibres > 0
    ? (
        records
          .filter(r => r.tarimasLibres > 0)
          .reduce((acc, r) => acc + r.diasAntiguedad * r.tarimasLibres, 0) / totalTarimasLibres
      ).toFixed(1)
    : "0.0";

  // Pintar en el DOM
  document.getElementById("kpi-unassigned-pallets").textContent = totalTarimasLibres.toLocaleString("es-MX");
  document.getElementById("kpi-unassigned-pct").textContent =
    `Valor en piso: $${Math.round(valorTarimasLibres).toLocaleString("es-MX")}`;

  document.getElementById("kpi-altocosto-libres").textContent = totalAltoCostoLibre.toLocaleString("es-MX");
  document.getElementById("kpi-altocosto-sub").textContent = `Remontes Col. U (No son tarimas)`;

  document.getElementById("kpi-assigned-pallets").textContent = assignedRecords.length.toLocaleString("es-MX");
  document.getElementById("kpi-assigned-pct").textContent =
    `${assignedPhysicalPallets.toLocaleString("es-MX")} tarimas + ${assignedAltoCosto.toLocaleString("es-MX")} remontes AC`;

  document.getElementById("kpi-active-stores").textContent = uniqueStores.size.toLocaleString("es-MX");
  document.getElementById("kpi-stores-sub").textContent =
    `${storesWithTarimasLibres.size} tiendas tienen Tarimas Libres`;

  document.getElementById("kpi-active-transports").textContent = activeTransports.size.toLocaleString("es-MX");
  document.getElementById("kpi-transports-avg").textContent =
    `Prom. ${avgPhysicalPerTransport} tarimas físicas / viaje`;

  document.getElementById("kpi-aging-pallets").textContent = agingTarimasLibres.toLocaleString("es-MX");
  document.getElementById("kpi-aging-sub").textContent =
    `Prom. antigüedad Col. T: ${avgAgingTarimasLibres} días`;

  const totalAllTarimasLibres = state.normalizedRecords.reduce((acc, r) => acc + r.tarimasLibres, 0);
  document.getElementById("active-filter-summary").textContent =
    `Mostrando ${totalTarimasLibres.toLocaleString("es-MX")} de ${totalAllTarimasLibres.toLocaleString("es-MX")} Tarimas Libres (Col. T) | ${records.length.toLocaleString("es-MX")} filas`;
}

// =========================================================================================
// INTELIGENCIA OPERATIVA (BASADA EN COLUMNA T = TARIMAS LIBRES)
// =========================================================================================
function renderSmartInsights() {
  const records = state.filteredRecords;
  const totalTarimasLibres = records.reduce((acc, r) => acc + r.tarimasLibres, 0);
  const trucksNeeded = Math.ceil(totalTarimasLibres / EMBARQUES_CONFIG.TRUCK_PALLET_CAPACITY);
  document.getElementById("insight-trucks-needed").textContent = trucksNeeded;

  // 1. Tienda con más Tarimas Libres reales (Columna T)
  const storeTarimasMap = {};
  const storeRemontesMap = {};
  records.forEach(r => {
    if (r.tarimasLibres > 0) {
      storeTarimasMap[r.ceNombre] = (storeTarimasMap[r.ceNombre] || 0) + r.tarimasLibres;
    }
    if (r.altoCostoLibre > 0) {
      storeRemontesMap[r.ceNombre] = (storeRemontesMap[r.ceNombre] || 0) + r.altoCostoLibre;
    }
  });
  const topStoresByColT = Object.entries(storeTarimasMap).sort((a, b) => b[1] - a[1]);

  // 2. Tipo de Pallet dominante exclusivamente en Tarimas Libres (Columna T = 1)
  const typeTarimasMap = {};
  records.filter(r => r.tarimasLibres > 0).forEach(r => {
    typeTarimasMap[r.tipoPallet] = (typeTarimasMap[r.tipoPallet] || 0) + r.tarimasLibres;
  });
  const topTypesColT = Object.entries(typeTarimasMap).sort((a, b) => b[1] - a[1]);

  // 3. Tarimas Libres (Col. T) más antiguas
  const oldestTarimasLibres = records
    .filter(r => r.tarimasLibres > 0 && r.diasAntiguedad >= EMBARQUES_CONFIG.AGING_WARNING_DAYS)
    .sort((a, b) => b.diasAntiguedad - a.diasAntiguedad);

  const container = document.getElementById("insights-container");

  const card1 = topStoresByColT.length > 0
    ? `<div class="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15">
         <div class="text-[11px] font-bold uppercase tracking-wider text-amber-300 mb-1">🔥 Mayor Acumulación de Tarimas Libres (Col. T)</div>
         <p class="text-xs sm:text-sm font-semibold text-white">
           ${escapeHtml(topStoresByColT[0][0])} tiene <span class="text-amber-300 font-extrabold">${topStoresByColT[0][1]} tarimas libres</span> (+ ${storeRemontesMap[topStoresByColT[0][0]] || 0} remontes AC).
         </p>
         <p class="text-[11px] text-slate-300 mt-1">
           ${topStoresByColT.length > 1 ? `2° lugar: ${escapeHtml(topStoresByColT[1][0])} con ${topStoresByColT[1][1]} tarimas libres.` : "Única tienda seleccionada con tarimas libres."}
         </p>
       </div>`
    : `<div class="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15">
         <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-1">✅ Sin Tarimas Libres en Piso</div>
         <p class="text-xs sm:text-sm font-semibold text-white">0 Tarimas Libres en la Columna T para el filtro actual.</p>
       </div>`;

  const card2 = topTypesColT.length > 0
    ? `<div class="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15">
         <div class="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1">📦 Tipo Pallet en Tarimas Libres (Col. T)</div>
         <p class="text-xs sm:text-sm font-semibold text-white">
           <span class="text-cyan-300 font-extrabold">${escapeHtml(topTypesColT[0][0])}</span> lidera con ${topTypesColT[0][1]} tarimas libres.
         </p>
         <p class="text-[11px] text-slate-300 mt-1">
           ${topTypesColT.slice(1, 3).map(([t, c]) => `${escapeHtml(t)}: ${c}`).join(" • ") || "Sin otros tipos pendientes"}
         </p>
       </div>`
    : `<div class="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15">
         <div class="text-[11px] font-bold uppercase tracking-wider text-cyan-300 mb-1">📦 Perfil de Tarimas Libres</div>
         <p class="text-xs sm:text-sm font-semibold text-white">No hay tarimas libres pendientes de clasificar.</p>
       </div>`;

  const card3 = oldestTarimasLibres.length > 0
    ? `<div class="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15">
         <div class="text-[11px] font-bold uppercase tracking-wider text-rose-300 mb-1">⏱️ Antigüedad de Tarimas Libres (Fch. Crea.)</div>
         <p class="text-xs sm:text-sm font-semibold text-white">
           Hay <span class="text-rose-300 font-extrabold">${oldestTarimasLibres.reduce((a, b) => a + b.tarimasLibres, 0)} tarimas libres</span> con +${EMBARQUES_CONFIG.AGING_WARNING_DAYS} días en piso.
         </p>
         <p class="text-[11px] text-slate-300 mt-1">
           Más antigua: ${escapeHtml(oldestTarimasLibres[0].ceNombre)} (${oldestTarimasLibres[0].fechaDisplay} • ${oldestTarimasLibres[0].diasAntiguedad} días).
         </p>
       </div>`
    : `<div class="bg-white/10 backdrop-blur-xs rounded-xl p-3.5 border border-white/15">
         <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-1">⏱️ Sin Rezago en Columna T</div>
         <p class="text-xs sm:text-sm font-semibold text-white">Todas las tarimas libres fueron creadas recientemente.</p>
       </div>`;

  container.innerHTML = card1 + card2 + card3;
}

// =========================================================================================
// GRÁFICOS INTERACTIVOS (CHART.JS)
// =========================================================================================
function renderCharts() {
  renderStoresChart();
  renderPalletTypesChart();
  renderDatesChart();
  renderAgingChart();
}

/**
 * Gráfico 1: Top 15 Tiendas ordenadas por TARIMAS LIBRES (Columna T)
 * Muestra las 3 series separadas: Tarimas Libres (Col. T), Remontes Alto Costo (Col. U) y Con Transporte.
 */
function renderStoresChart() {
  const storeStats = {};
  state.filteredRecords.forEach(r => {
    if (!storeStats[r.ceNombre]) {
      storeStats[r.ceNombre] = { tarimasLibres: 0, altoCostoLibre: 0, conTransporte: 0 };
    }
    storeStats[r.ceNombre].tarimasLibres += r.tarimasLibres;
    storeStats[r.ceNombre].altoCostoLibre += r.altoCostoLibre;
    if (r.tieneTransporte) {
      storeStats[r.ceNombre].conTransporte += 1;
    }
  });

  // Ordenar por mayor número de Tarimas Libres (Col. T)
  const topStores = Object.entries(storeStats)
    .sort((a, b) => b[1].tarimasLibres - a[1].tarimasLibres || b[1].conTransporte - a[1].conTransporte)
    .slice(0, 15);

  const labels = topStores.map(([name]) => (name.length > 22 ? name.slice(0, 22) + "…" : name));
  const tarimasLibresData = topStores.map(([, s]) => s.tarimasLibres);
  const altoCostoData = topStores.map(([, s]) => s.altoCostoLibre);
  const conTransporteData = topStores.map(([, s]) => s.conTransporte);

  const ctx = document.getElementById("chart-stores").getContext("2d");
  if (state.charts.stores) state.charts.stores.destroy();

  state.charts.stores = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tarimas Libres (Col. T)",
          data: tarimasLibresData,
          backgroundColor: "#f59e0b",
          borderRadius: 5
        },
        {
          label: "Remontes Alto Costo Libre (Col. U)",
          data: altoCostoData,
          backgroundColor: "#a855f7",
          borderRadius: 5
        },
        {
          label: "Con Transporte Asignado",
          data: conTransporteData,
          backgroundColor: "#10b981",
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
      },
      scales: {
        x: { ticks: { font: { size: 10 } } },
        y: { beginAtZero: true, title: { display: true, text: "Cantidad" } }
      }
    }
  });
}

/**
 * Gráfico 2: Distribución de Tipo Pallet de las Tarimas Libres (Col. T > 0)
 * Si el usuario filtró sólo registros con transporte, muestra el desglose de esos registros.
 */
function renderPalletTypesChart() {
  const typeCounts = {};
  const tarimasLibresRecords = state.filteredRecords.filter(r => r.tarimasLibres > 0);
  const sourceList = tarimasLibresRecords.length > 0 ? tarimasLibresRecords : state.filteredRecords;

  sourceList.forEach(r => {
    const qty = tarimasLibresRecords.length > 0 ? r.tarimasLibres : 1;
    typeCounts[r.tipoPallet] = (typeCounts[r.tipoPallet] || 0) + qty;
  });

  const entries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  const topEntries = entries.slice(0, 8);
  const labels = topEntries.map(e => e[0]);
  const data = topEntries.map(e => e[1]);
  const palette = ["#0055a6", "#f59e0b", "#10b981", "#00a8e8", "#8b5cf6", "#ec4899", "#f97316", "#64748b"];

  const ctx = document.getElementById("chart-pallet-types").getContext("2d");
  if (state.charts.palletTypes) state.charts.palletTypes.destroy();

  state.charts.palletTypes = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
          borderColor: "#ffffff"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "64%",
      plugins: {
        legend: { display: false }
      }
    }
  });

  const total = entries.reduce((a, b) => a + b[1], 0);
  const legendEl = document.getElementById("pallet-type-legend");
  legendEl.innerHTML = entries
    .slice(0, 6)
    .map(([type, count], i) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const color = palette[i % palette.length];
      return `
        <div class="flex items-center justify-between bg-slate-50 px-2.5 py-1.5 rounded-lg">
          <div class="flex items-center gap-1.5 truncate">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${color}"></span>
            <span class="font-medium text-slate-700 truncate" title="${escapeHtml(type)}">${escapeHtml(type)}</span>
          </div>
          <span class="font-bold text-slate-900 ml-2">${count} (${pct}%)</span>
        </div>
      `;
    })
    .join("");
}

/**
 * Gráfico 3: Evolución por Fecha de Creación (Fch. Crea.)
 */
function renderDatesChart() {
  const dateMap = {};
  state.filteredRecords.forEach(r => {
    const key = r.fechaISO;
    if (!dateMap[key]) {
      dateMap[key] = { label: r.fechaDisplay, tarimasLibres: 0, altoCostoLibre: 0, conTransporte: 0 };
    }
    dateMap[key].tarimasLibres += r.tarimasLibres;
    dateMap[key].altoCostoLibre += r.altoCostoLibre;
    if (r.tieneTransporte) {
      dateMap[key].conTransporte += 1;
    }
  });

  const sortedKeys = Object.keys(dateMap).sort();
  const labels = sortedKeys.map(k => dateMap[k].label);
  const tarimasLibresData = sortedKeys.map(k => dateMap[k].tarimasLibres);
  const altoCostoData = sortedKeys.map(k => dateMap[k].altoCostoLibre);
  const assignedData = sortedKeys.map(k => dateMap[k].conTransporte);

  const ctx = document.getElementById("chart-dates").getContext("2d");
  if (state.charts.dates) state.charts.dates.destroy();

  state.charts.dates = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tarimas Libres (Col. T)",
          data: tarimasLibresData,
          backgroundColor: "#f59e0b",
          borderRadius: 4
        },
        {
          label: "Remontes Alto Costo (Col. U)",
          data: altoCostoData,
          backgroundColor: "#a855f7",
          borderRadius: 4
        },
        {
          label: "Con Transporte Asignado",
          data: assignedData,
          backgroundColor: "#0055a6",
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12, font: { size: 11 } } }
      },
      scales: {
        x: { stacked: true, ticks: { font: { size: 10 } } },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}

/**
 * Gráfico 4: Antigüedad exclusivamente de las Tarimas Libres (Columna T)
 */
function renderAgingChart() {
  const buckets = {
    "0 a 1 día (Reciente)": 0,
    "2 a 3 días": 0,
    "4 a 6 días": 0,
    "7 a 9 días": 0,
    "10+ días (Crítico)": 0
  };

  state.filteredRecords
    .filter(r => r.tarimasLibres > 0)
    .forEach(r => {
      if (r.diasAntiguedad <= 1) buckets["0 a 1 día (Reciente)"] += r.tarimasLibres;
      else if (r.diasAntiguedad <= 3) buckets["2 a 3 días"] += r.tarimasLibres;
      else if (r.diasAntiguedad <= 6) buckets["4 a 6 días"] += r.tarimasLibres;
      else if (r.diasAntiguedad <= 9) buckets["7 a 9 días"] += r.tarimasLibres;
      else buckets["10+ días (Crítico)"] += r.tarimasLibres;
    });

  const labels = Object.keys(buckets);
  const data = Object.values(buckets);
  const colors = ["#10b981", "#0ea5e9", "#f59e0b", "#f97316", "#e11d48"];

  const ctx = document.getElementById("chart-aging").getContext("2d");
  if (state.charts.aging) state.charts.aging.destroy();

  state.charts.aging = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Tarimas Libres (Col. T)",
          data,
          backgroundColor: colors,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { beginAtZero: true }
      }
    }
  });
}

// =========================================================================================
// VISTA B: TABLA SEMÁFORO POR TIENDA (Ce. Nombre)
// =========================================================================================
function renderStoresTable() {
  const storeMap = {};

  state.filteredRecords.forEach(r => {
    if (!storeMap[r.ceNombre]) {
      storeMap[r.ceNombre] = {
        ceNombre: r.ceNombre,
        tarimasLibres: 0,
        altoCostoLibre: 0,
        conTransporte: 0,
        valorTarimasLibres: 0,
        palletTypesColT: {},
        transports: new Set(),
        oldestTarimaDisplay: "—",
        maxAgingColT: -1
      };
    }

    const st = storeMap[r.ceNombre];
    st.tarimasLibres += r.tarimasLibres;
    st.altoCostoLibre += r.altoCostoLibre;

    if (r.tieneTransporte) {
      st.conTransporte += 1;
      st.transports.add(r.transporte);
    }

    // Solo sumar al desglose de Tipo Pallet de Tarimas Libres cuando Columna T > 0
    if (r.tarimasLibres > 0) {
      st.valorTarimasLibres += r.valor;
      st.palletTypesColT[r.tipoPallet] = (st.palletTypesColT[r.tipoPallet] || 0) + r.tarimasLibres;
      if (r.diasAntiguedad > st.maxAgingColT) {
        st.maxAgingColT = r.diasAntiguedad;
        st.oldestTarimaDisplay = r.fechaDisplay;
      }
    }
  });

  // Ordenar primero por mayor cantidad de Tarimas Libres (Col. T)
  const storesList = Object.values(storeMap).sort(
    (a, b) => b.tarimasLibres - a.tarimasLibres || b.altoCostoLibre - a.altoCostoLibre || b.conTransporte - a.conTransporte
  );
  const tbody = document.getElementById("stores-table-body");

  if (storesList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No hay tiendas que coincidan con los filtros seleccionados.</td></tr>`;
    return;
  }

  tbody.innerHTML = storesList
    .map(st => {
      const typesBadges = Object.entries(st.palletTypesColT)
        .sort((a, b) => b[1] - a[1])
        .map(([t, c]) => `<span class="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium mr-1 mb-1">${escapeHtml(t)}: <strong>${c}</strong></span>`)
        .join("") || `<span class="text-xs text-slate-400">Sin tarimas libres</span>`;

      const transportsBadges = st.transports.size > 0
        ? Array.from(st.transports)
            .slice(0, 6)
            .map(tr => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold mr-1 mb-1">🚚 ${escapeHtml(tr)}</span>`)
            .join("") + (st.transports.size > 6 ? `<span class="text-xs text-slate-500">+${st.transports.size - 6} más</span>` : "")
        : `<span class="text-xs text-amber-600 font-semibold">Sin transporte</span>`;

      return `
        <tr class="hover:bg-slate-50/90 transition cursor-pointer" onclick="filterByStore('${escapeHtml(st.ceNombre.replace(/'/g, "\\'"))}')">
          <td class="py-3 px-4 font-bold text-slate-800">${escapeHtml(st.ceNombre)}</td>
          <td class="py-3 px-4 text-center bg-amber-50/40">
            ${
              st.tarimasLibres > 0
                ? `<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-extrabold bg-amber-100 text-amber-900 border border-amber-300">${st.tarimasLibres}</span>`
                : `<span class="text-xs text-slate-400 font-medium">0</span>`
            }
          </td>
          <td class="py-3 px-4 text-center">
            ${
              st.altoCostoLibre > 0
                ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">${st.altoCostoLibre} remontes</span>`
                : `<span class="text-xs text-slate-400">0</span>`
            }
          </td>
          <td class="py-3 px-4 text-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">${st.conTransporte}</span>
          </td>
          <td class="py-3 px-4">${typesBadges}</td>
          <td class="py-3 px-4">${transportsBadges}</td>
          <td class="py-3 px-4 text-center text-xs">
            ${
              st.maxAgingColT >= 0
                ? `<div class="font-semibold text-slate-700">${escapeHtml(st.oldestTarimaDisplay)}</div>
                   <div class="${st.maxAgingColT >= 2 ? "text-rose-600 font-bold" : "text-slate-400"}">hace ${st.maxAgingColT} día(s)</div>`
                : `<span class="text-slate-400">—</span>`
            }
          </td>
          <td class="py-3 px-4 text-right font-mono text-xs font-bold text-slate-700">
            $${st.valorTarimasLibres.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
        </tr>
      `;
    })
    .join("");
}

window.filterByStore = function (storeName) {
  state.filters.store = storeName;
  document.getElementById("filter-store").value = storeName;
  applyFiltersAndRender();
  switchTab("view-table");
};

// =========================================================================================
// VISTA C: CONSOLIDADO POR TRANSPORTE (DIFERENCIANDO TARIMAS VS REMONTES ALTO COSTO)
// =========================================================================================
function renderTransportsGrid() {
  const transportMap = {};

  state.filteredRecords
    .filter(r => r.tieneTransporte)
    .forEach(r => {
      if (!transportMap[r.transporte]) {
        transportMap[r.transporte] = {
          transporte: r.transporte,
          tarimasFisicas: 0,
          remontesAltoCosto: 0,
          valorTotal: 0,
          stores: new Set(),
          palletTypes: {},
          dates: new Set()
        };
      }
      const tr = transportMap[r.transporte];
      if (r.esRemonteAltoCosto) {
        tr.remontesAltoCosto += 1;
      } else {
        tr.tarimasFisicas += 1;
        tr.palletTypes[r.tipoPallet] = (tr.palletTypes[r.tipoPallet] || 0) + 1;
      }
      tr.valorTotal += r.valor;
      tr.stores.add(r.ceNombre);
      tr.dates.add(r.fechaDisplay);
    });

  const list = Object.values(transportMap).sort((a, b) => b.tarimasFisicas - a.tarimasFisicas);
  const grid = document.getElementById("transports-grid");

  if (list.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-10 text-center text-slate-400">No hay transportes asignados con los filtros actuales.</div>`;
    return;
  }

  grid.innerHTML = list
    .map(tr => {
      const capPct = Math.min(100, Math.round((tr.tarimasFisicas / EMBARQUES_CONFIG.TRUCK_PALLET_CAPACITY) * 100));
      const storesArr = Array.from(tr.stores);
      const typesArr = Object.entries(tr.palletTypes).sort((a, b) => b[1] - a[1]);

      return `
        <div class="rounded-2xl border border-slate-200 p-4 bg-slate-50/60 hover:bg-white hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2">
                <div class="w-9 h-9 rounded-xl bg-[#001952] text-white flex items-center justify-center font-bold text-xs">
                  🚚
                </div>
                <div>
                  <h4 class="font-extrabold text-slate-900 text-sm">Transporte #${escapeHtml(tr.transporte)}</h4>
                  <span class="text-[11px] text-slate-500">Valor: $${Math.round(tr.valorTotal).toLocaleString("es-MX")}</span>
                </div>
              </div>
              <div class="text-right">
                <span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 block">
                  ${tr.tarimasFisicas} tarimas
                </span>
                ${
                  tr.remontesAltoCosto > 0
                    ? `<span class="text-[11px] text-purple-700 font-semibold">+ ${tr.remontesAltoCosto} remontes AC</span>`
                    : ""
                }
              </div>
            </div>

            <div class="mb-3">
              <div class="text-[11px] font-semibold uppercase text-slate-400 mb-1">Tiendas Destino (${storesArr.length}):</div>
              <div class="flex flex-wrap gap-1">
                ${storesArr
                  .map(s => `<span class="px-2 py-0.5 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700">${escapeHtml(s)}</span>`)
                  .join("")}
              </div>
            </div>

            <div class="mb-3">
              <div class="text-[11px] font-semibold uppercase text-slate-400 mb-1">Tarimas Físicas por Tipo:</div>
              <div class="flex flex-wrap gap-1">
                ${
                  typesArr.length > 0
                    ? typesArr
                        .map(([t, c]) => `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-semibold">${escapeHtml(t)}: ${c}</span>`)
                        .join("")
                    : `<span class="text-xs text-slate-400">Solo remontes de Alto Costo</span>`
                }
              </div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200/80">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-slate-500">Ocupación de piso (${tr.tarimasFisicas}/24 tarimas)</span>
              <span class="font-bold text-slate-800">${capPct}%</span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div class="h-full bg-[#0055a6]" style="width:${capPct}%"></div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// =========================================================================================
// VISTA D: TABLA DETALLADA DE REGISTROS
// =========================================================================================
function renderDetailTable() {
  const records = state.filteredRecords;
  const sumColT = records.reduce((a, b) => a + b.tarimasLibres, 0);
  const sumColU = records.reduce((a, b) => a + b.altoCostoLibre, 0);
  document.getElementById("table-count-label").textContent =
    `Mostrando ${records.length.toLocaleString("es-MX")} registros (Suma Col. T Tarimas Libres: ${sumColT.toLocaleString("es-MX")} | Suma Col. U Remontes AC: ${sumColU.toLocaleString("es-MX")})`;

  const tbody = document.getElementById("detail-table-body");
  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="py-8 text-center text-slate-400">No se encontraron registros para los filtros aplicados.</td></tr>`;
    return;
  }

  tbody.innerHTML = records
    .slice(0, 600)
    .map(r => {
      let classificationBadge = "";
      if (r.tarimasLibres > 0) {
        classificationBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">🟡 Tarima Libre (Col. T)</span>`;
      } else if (r.altoCostoLibre > 0) {
        classificationBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">🟣 Remonte Alto Costo (Col. U)</span>`;
      } else if (r.tieneTransporte) {
        classificationBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">🟢 Con Transporte</span>`;
      } else {
        classificationBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${escapeHtml(r.estatusDesc || "Finalizado")}</span>`;
      }

      return `
        <tr class="hover:bg-slate-50 transition ${r.tarimasLibres > 0 ? "bg-amber-50/20" : ""}">
          <td class="py-2.5 px-4 font-mono text-xs text-slate-600">${escapeHtml(r.numConteo)}</td>
          <td class="py-2.5 px-4 font-bold text-slate-800">${escapeHtml(r.ceNombre)}</td>
          <td class="py-2.5 px-4">
            <span class="px-2.5 py-0.5 rounded-md ${
              r.esRemonteAltoCosto
                ? "bg-purple-50 text-purple-800 border border-purple-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            } font-semibold text-xs">
              ${escapeHtml(r.tipoPallet)}
            </span>
          </td>
          <td class="py-2.5 px-4 text-center font-extrabold ${r.tarimasLibres > 0 ? "text-amber-700 bg-amber-50/60" : "text-slate-300"}">
            ${r.tarimasLibres}
          </td>
          <td class="py-2.5 px-4 text-center font-bold ${r.altoCostoLibre > 0 ? "text-purple-700" : "text-slate-300"}">
            ${r.altoCostoLibre}
          </td>
          <td class="py-2.5 px-4 font-mono text-xs font-bold ${r.tieneTransporte ? "text-emerald-700" : "text-slate-400"}">
            ${r.tieneTransporte ? `🚚 ${escapeHtml(r.transporte)}` : "—"}
          </td>
          <td class="py-2.5 px-4 text-center text-xs font-medium text-slate-700">
            ${escapeHtml(r.fechaDisplay)}
            <span class="block text-[10px] text-slate-400">hace ${r.diasAntiguedad}d</span>
          </td>
          <td class="py-2.5 px-4 text-right font-mono text-xs text-slate-700">
            $${r.valor.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </td>
          <td class="py-2.5 px-4 text-center">${classificationBadge}</td>
        </tr>
      `;
    })
    .join("");
}

// =========================================================================================
// EXPORTACIÓN A EXCEL
// =========================================================================================
function exportCurrentViewToExcel() {
  if (!window.XLSX) {
    alert("Librería XLSX no cargada.");
    return;
  }

  const exportRows = state.filteredRecords.map(r => ({
    "Num.Conteo": r.numConteo,
    "Ce. Nombre (Tienda)": r.ceNombre,
    "Tipo Pallet": r.tipoPallet,
    "Tarimas Libres (Col. T)": r.tarimasLibres,
    "Alto costo Libre / Remontes (Col. U)": r.altoCostoLibre,
    "Transporte": r.tieneTransporte ? r.transporte : "",
    "Fch. Crea.": r.fechaDisplay,
    "Días Antigüedad": r.diasAntiguedad,
    "Valor": r.valor,
    "Estatus": r.estatusDesc
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Embarques_Petco");

  const todayStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Reporte_Embarques_Petco_${todayStr}.xlsx`);
}

// =========================================================================================
// MODAL DE CONFIGURACIÓN
// =========================================================================================
function openSettingsModal() {
  document.getElementById("input-sheet-id").value = EMBARQUES_CONFIG.SHEET_ID;
  document.getElementById("input-sheet-tab").value = EMBARQUES_CONFIG.SHEET_TAB;
  document.getElementById("input-script-url").value = EMBARQUES_CONFIG.APPS_SCRIPT_URL;
  document.getElementById("input-connection-mode").value = EMBARQUES_CONFIG.CONNECTION_MODE;
  document.getElementById("settings-modal").classList.remove("hidden");
}

function closeSettingsModal() {
  document.getElementById("settings-modal").classList.add("hidden");
}

function saveSettingsAndReload() {
  const sheetTab = document.getElementById("input-sheet-tab").value.trim();
  const scriptUrl = document.getElementById("input-script-url").value.trim();
  const mode = document.getElementById("input-connection-mode").value;

  EMBARQUES_CONFIG.SHEET_TAB = sheetTab;
  localStorage.setItem("petco_embarques_sheet_tab", sheetTab);

  EMBARQUES_CONFIG.APPS_SCRIPT_URL = scriptUrl;
  localStorage.setItem("petco_embarques_script_url", scriptUrl);

  EMBARQUES_CONFIG.CONNECTION_MODE = mode;
  localStorage.setItem("petco_embarques_mode", mode);

  closeSettingsModal();
  loadDashboardData(false);
}

function useDemoDataset(alertMessage) {
  if (alertMessage) {
    document.getElementById("connection-alert-msg").innerHTML = alertMessage;
  }
  const demoRows = [
    { "Num.Conteo": "7601940939", "Ce.": "7269", "Nombre": "Punta Museo (Express)", "Transporte": "", "Dscrp.Sts.": "Embarcado", "Fch. Crea.": "13.10.2026", "Tipo Pallet": "ROYAL", "Valor": "41,742.36", "Tarimas Libres": "1", "Alto costo Libre": "0" },
    { "Num.Conteo": "7601932414", "Ce.": "7269", "Nombre": "Punta Museo (Express)", "Transporte": "", "Dscrp.Sts.": "Embarcado", "Fch. Crea.": "29.09.2026", "Tipo Pallet": "ALTOCOSTO", "Valor": "1,780.16", "Tarimas Libres": "0", "Alto costo Libre": "1" }
  ];
  processLoadedRows(demoRows, "demo", "Modo Demo");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
