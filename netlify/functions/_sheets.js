// Helper central de conexión con Google Sheets API
// Todas las functions lo importan con require('./_sheets')

const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

let _sheetsClient = null;

async function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  _sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return _sheetsClient;
}

// Lee todas las filas de un rango. Devuelve array de arrays sin encabezado.
async function readSheet(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  const rows = res.data.values || [];
  return rows.slice(1);
}

// Lee filas incluyendo encabezado (para calcular índices exactos de fila)
async function readSheetRaw(range) {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return res.data.values || [];
}

// Agrega una fila al final de una hoja
async function appendRow(sheetName, values) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [values] },
  });
}

// Actualiza una fila específica (rowIndex es 1-indexed, 2 = primera fila de datos)
async function updateRow(sheetName, rowIndex, values) {
  const sheets = await getSheetsClient();
  const colLetter = columnLetter(values.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:${colLetter}${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

// Busca el índice de fila (1-indexed) por el valor de la columna A (ID)
// Devuelve -1 si no encuentra
async function findRowIndex(sheetName, idValue) {
  const raw = await readSheetRaw(`${sheetName}!A:A`);
  for (let i = 1; i < raw.length; i++) {
    if (raw[i][0] === idValue) return i + 1;
  }
  return -1;
}

// Genera el siguiente ID correlativo: PREFIX-001, PREFIX-002...
async function nextId(sheetName, prefix) {
  const rows = await readSheet(`${sheetName}!A:A`);
  if (rows.length === 0) return `${prefix}-001`;
  const last = rows[rows.length - 1][0] || '';
  const parts = last.split('-');
  const num = parseInt(parts[parts.length - 1], 10) || 0;
  return `${prefix}-${String(num + 1).padStart(3, '0')}`;
}

// Genera ID de venta con fecha: VTA-YYYYMMDD-001
async function nextVentaId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `VTA-${dateStr}`;
  const rows = await readSheet('Ventas!B:B');
  const todayRows = rows.filter(r => r[0] && r[0].startsWith(prefix));
  return `${prefix}-${String(todayRows.length + 1).padStart(3, '0')}`;
}

// Convierte cantidad de columnas a letra Excel (1=A, 9=I, 12=L...)
function columnLetter(n) {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

// Fecha actual YYYY-MM-DD
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Respuesta HTTP estándar con CORS
function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

// Respuesta para preflight CORS
function handleOptions() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: '',
  };
}

module.exports = {
  readSheet,
  readSheetRaw,
  appendRow,
  updateRow,
  findRowIndex,
  nextId,
  nextVentaId,
  today,
  respond,
  handleOptions,
};
