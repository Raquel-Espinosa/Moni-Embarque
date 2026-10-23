/**
 * =========================================================================================
 * BACKEND GOOGLE APPS SCRIPT - DASHBOARD DE EMBARQUES PETCO
 * =========================================================================================
 *
 * ID del archivo Google Sheets: 1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E
 *
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abre tu hoja de Google Sheets (1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E).
 * 2. Ve a Extensiones > Apps Script.
 * 3. Pega todo este código en Code.gs y guarda (Ctrl + S).
 * 4. Haz clic en Implementar > Nueva implementación > Aplicación web.
 * 5. Ejecutar como: "Yo" | Quién tiene acceso: "Cualquiera" (Anyone).
 * 6. Copia la URL generada (/exec) y pégala en el botón de Configuración del Dashboard.
 */

const SHEET_ID = "1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E";

function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || "getData";

    if (action === "ping") {
      return respondJson({
        success: true,
        message: "Conexión exitosa con Google Apps Script - Embarques Petco",
        timestamp: new Date().toISOString()
      });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const tabName = params.tab || "";
    let sheet = tabName ? ss.getSheetByName(tabName) : ss.getSheets()[0];

    if (!sheet) {
      sheet = ss.getSheets()[0];
    }

    const sheetsList = ss.getSheets().map(s => s.getName());
    const range = sheet.getDataRange();
    const values = range.getValues();
    const displayValues = range.getDisplayValues();

    if (values.length <= 1) {
      return respondJson({
        success: true,
        sheetName: sheet.getName(),
        availableSheets: sheetsList,
        headers: values[0] || [],
        rows: [],
        totalRows: 0
      });
    }

    // Buscar la fila de encabezados (por si hay filas vacías o títulos arriba en las primeras 10 filas)
    let headerRowIndex = 0;
    for (let r = 0; r < Math.min(10, displayValues.length); r++) {
      const rowText = displayValues[r].join(" ").toLowerCase();
      if (
        rowText.includes("tarima") ||
        rowText.includes("nombre") ||
        rowText.includes("pallet") ||
        rowText.includes("transporte") ||
        rowText.includes("fch")
      ) {
        headerRowIndex = r;
        break;
      }
    }

    const rawHeaders = displayValues[headerRowIndex].map((h, idx) =>
      String(h || "").trim() || ("Columna_" + (idx + 1))
    );

    const rows = [];
    for (let i = headerRowIndex + 1; i < displayValues.length; i++) {
      const dRow = displayValues[i];
      const vRow = values[i];

      // Ignorar filas completamente vacías
      const isEmpty = dRow.every(cell => String(cell || "").trim() === "");
      if (isEmpty) continue;

      const obj = {};
      for (let c = 0; c < rawHeaders.length; c++) {
        const key = rawHeaders[c];
        obj[key] = dRow[c] !== undefined && dRow[c] !== "" ? dRow[c] : vRow[c];
      }
      rows.push(obj);
    }

    return respondJson({
      success: true,
      sheetName: sheet.getName(),
      availableSheets: sheetsList,
      headers: rawHeaders,
      rows: rows,
      totalRows: rows.length,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    return respondJson({
      success: false,
      error: err.toString(),
      stack: err.stack
    });
  }
}

function respondJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
