// ==========================================================================
// CONFIGURACIÓN FIJA DEL DASHBOARD DE EMBARQUES PETCO
// ==========================================================================

const EMBARQUES_CONFIG = {
  // ID FIJO de la hoja de Google Sheets de Embarques Petco
  SHEET_ID: "1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E",

  // URLs directas fijas de la hoja pública
  SHEET_PUBLIC_URL: "https://docs.google.com/spreadsheets/d/1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E/edit?usp=sharing",
  SHEET_CSV_URL: "https://docs.google.com/spreadsheets/d/1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E/export?format=csv",
  SHEET_GVIZ_CSV_URL: "https://docs.google.com/spreadsheets/d/1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E/gviz/tq?tqx=out:csv",

  // Nombre de la pestaña (opcional; si se deja vacío lee la primera pestaña activa)
  SHEET_TAB: "",

  // URL opcional de Google Apps Script (respaldo adicional)
  APPS_SCRIPT_URL: "",

  // Modo de conexión fijo: "live" (conecta directamente a la hoja 1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E)
  CONNECTION_MODE: "live",

  // Intervalo de auto-actualización en segundos (cada 60s)
  AUTO_REFRESH_SECONDS: 60,

  // Umbral de días para considerar una tarima como "Rezago / Antiguo"
  AGING_WARNING_DAYS: 2,
  AGING_CRITICAL_DAYS: 4,

  // Capacidad estándar de tarimas por unidad de transporte (referencia para consolidación de cargas)
  TRUCK_PALLET_CAPACITY: 24,

  // Mapeo exacto de las columnas de la hoja 1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E
  COLUMN_ALIASES: {
    numConteo: ["num.conteo", "num conteo", "numconteo", "conteo", "folio", "hu"],
    ceCodigo: ["ce.", "ce", "centro", "id tienda", "num tienda", "no. tienda", "sucursal"],
    ceNombre: ["nombre", "ce. nombre", "ce.nombre", "ce nombre", "cenombre", "tienda", "nombre tienda", "destino"],
    grupo: ["grupo", "ola", "wave"],
    transporte: ["transporte", "num transporte", "no. transporte", "id transporte", "shipment", "viaje"],
    estatusCodigo: ["sts.cnt.", "stscnt", "sts.fase", "fase"],
    estatusDescripcion: ["dscrp.sts.", "dscrpsts", "descripcion estatus", "estatus", "estado"],
    nomDocum: ["nom.docum.", "nomdocum", "documento", "usuario"],
    fechaCreacion: ["fch. crea.", "fch.crea.", "fch crea", "fch. crea", "fecha creacion", "fecha"],
    horaCreacion: ["hora crea", "horacrea", "hora creacion"],
    tipoPallet: ["tipo pallet", "tipopallet", "tipo de pallet", "tipo tarima"],
    fechaTransporte: ["fecha transporte", "fechatransporte"],
    valor: ["valor", "importe", "monto", "costo"],
    tarimasLibres: ["tarimas libres", "tarimaslibres", "tarima libre"],
    altoCostoLibre: ["alto costo libre", "altocostolibre", "remonte libre", "alto costo"]
  }
};

// Mantener siempre fijo el SHEET_ID principal y permitir ajustes opcionales de pestaña
(function loadSavedConfig() {
  EMBARQUES_CONFIG.SHEET_ID = "1oiXc9I5HX9JkvUNao3u0Ofzm65DDVIlFGlGaua_s8_E";
  localStorage.removeItem("petco_embarques_sheet_id");

  const savedScriptUrl = localStorage.getItem("petco_embarques_script_url");
  if (savedScriptUrl !== null && savedScriptUrl.trim() !== "") {
    EMBARQUES_CONFIG.APPS_SCRIPT_URL = savedScriptUrl.trim();
  }
  const savedTab = localStorage.getItem("petco_embarques_sheet_tab");
  if (savedTab !== null) {
    EMBARQUES_CONFIG.SHEET_TAB = savedTab.trim();
  }
})();
