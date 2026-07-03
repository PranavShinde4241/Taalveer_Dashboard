// ===============================
// DASHBOARD PAGE ACCESS CHECK
// ===============================

if (sessionStorage.getItem("loggedIn") !== "true") {
  window.location.href = "index.html";
}

function logout() {
  sessionStorage.removeItem("loggedIn");
  window.location.href = "index.html";
}


// ===============================
// BASIC CONFIGURATION
// ===============================

const SPREADSHEET_ID = "1_nlRFxAST7ErzyqiBr9b_Tw8OhjNCAXz";

const ALLOWED_SHEETS = ["व्यवहार_नोंद", "Event_Show_Master"];

const DASHBOARD_SHEET = "Dashboard_Summary";
const DASHBOARD_RANGE = "A4:B6";

// Important:
// We force table sheets to start from A1 so actual Google Sheet headers are captured.
const TABLE_RANGES = {
  "व्यवहार_नोंद": "A1:AZ1000",
  "Event_Show_Master": "A1:AZ1000"
};


// ===============================
// LOAD DASHBOARD ON PAGE OPEN
// ===============================

window.onload = function () {
  loadDashboardBalance();
};


// ===============================
// GOOGLE SHEET RAW ROW FETCH FUNCTION
// ===============================

async function fetchSheetRows(sheetName, range = "") {
  const encodedSheet = encodeURIComponent(sheetName);
  const encodedRange = range ? `&range=${encodeURIComponent(range)}` : "";

  // headers=0 is very important.
  // It prevents Google from treating first transaction row as header.
  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodedSheet}${encodedRange}&headers=0&_=${Date.now()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to access Google Sheet. Please check sharing permissions.");
  }

  const text = await response.text();
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonText);

  if (!json.table || !json.table.rows) {
    return [];
  }

  const colCount = json.table.cols ? json.table.cols.length : 0;

  let rows = json.table.rows.map(row => {
    const output = [];

    for (let i = 0; i < colCount; i++) {
      const cell = row.c && row.c[i] ? row.c[i] : null;

      if (!cell) {
        output.push("");
      } else {
        output.push(cell.f !== undefined ? cell.f : cell.v !== undefined ? cell.v : "");
      }
    }

    return output;
  });

  rows = trimEmptyRowsAndColumns(rows);

  return rows;
}


// ===============================
// REMOVE EMPTY ROWS AND EXTRA BLANK COLUMNS
// ===============================

function trimEmptyRowsAndColumns(rows) {
  let cleanedRows = rows.filter(row => {
    return row.some(cell => String(cell).trim() !== "");
  });

  if (!cleanedRows.length) {
    return [];
  }

  let lastUsedColumnIndex = 0;

  cleanedRows.forEach(row => {
    row.forEach((cell, index) => {
      if (String(cell).trim() !== "") {
        lastUsedColumnIndex = Math.max(lastUsedColumnIndex, index);
      }
    });
  });

  cleanedRows = cleanedRows.map(row => row.slice(0, lastUsedColumnIndex + 1));

  return cleanedRows;
}


// ===============================
// DASHBOARD BALANCE
// ===============================

async function loadDashboardBalance() {
  const container = document.getElementById("balanceCards");
  container.innerHTML = `<p class="loading">Loading balance...</p>`;

  try {
    const rows = await fetchSheetRows(DASHBOARD_SHEET, DASHBOARD_RANGE);

    if (!rows.length) {
      container.innerHTML = "<p>No balance data found.</p>";
      return;
    }

    container.innerHTML = "";

    rows.forEach(row => {
      const label = row[0] || "Balance";
      const value = row[1] || "-";

      const card = document.createElement("div");
      card.className = "balance-card";

      card.innerHTML = `
        <h3>${escapeHtml(label)}</h3>
        <p>${escapeHtml(value)}</p>
      `;

      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}


// ===============================
// LOAD ONLY ALLOWED SHEETS
// ===============================

async function loadSheet(sheetName) {
  if (!ALLOWED_SHEETS.includes(sheetName)) {
    alert("This sheet is not allowed.");
    return;
  }

  const title = document.getElementById("tableTitle");
  const container = document.getElementById("tableContainer");

  title.textContent = sheetName;
  container.innerHTML = `<p class="loading">Loading ${sheetName}...</p>`;

  try {
    const range = TABLE_RANGES[sheetName] || "A1:AZ1000";
    const rows = await fetchSheetRows(sheetName, range);

    if (!rows.length) {
      container.innerHTML = "<p>No data found in this sheet.</p>";
      return;
    }

    const tableData = prepareTableData(sheetName, rows);

    renderTable(tableData.headers, tableData.bodyRows, container);

  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}


// ===============================
// PREPARE HEADER AND BODY ROWS
// ===============================

function prepareTableData(sheetName, rows) {
  let headerIndex = findHeaderRowIndex(sheetName, rows);

  let headers = rows[headerIndex] || [];
  let bodyRows = rows.slice(headerIndex + 1);

  // Fallback:
  // If Google still gives data row as header, manually fix it.
  if (looksLikeTransactionDataRow(headers) && sheetName === "व्यवहार_नोंद") {
    bodyRows = rows;
    headers = [
      "Sr No",
      "Transaction ID",
      "Transaction Date",
      "Transaction Time",
      "Event ID",
      "Event/Show Name",
      "Month",
      "Year",
      "Category",
      "Sub Category",
      "Type",
      "Transaction Details",
      "Payment Mode",
      "Amount",
      "Person Name",
      "Role",
      "Proof / Reference",
      "Notes"
    ];
  }

  headers = headers.map((header, index) => {
    const text = String(header).trim();
    return text !== "" ? text : `Column ${index + 1}`;
  });

  bodyRows = bodyRows.filter(row => {
    return row.some(cell => String(cell).trim() !== "");
  });

  // Remove repeated header row if it appears again inside body
  bodyRows = bodyRows.filter(row => {
    return row.join("|") !== headers.join("|");
  });

  return {
    headers,
    bodyRows
  };
}


// ===============================
// FIND ACTUAL HEADER ROW
// ===============================

function findHeaderRowIndex(sheetName, rows) {
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].map(x => String(x).trim().toLowerCase()).join("|");

    if (
      sheetName === "व्यवहार_नोंद" &&
      rowText.includes("sr no") &&
      rowText.includes("transaction id")
    ) {
      return i;
    }

    if (
      sheetName === "event_show_master" &&
      rowText.includes("event id") &&
      rowText.includes("event/show name")
    ) {
      return i;
    }
  }

  // If exact header not found, use first non-empty row.
  return 0;
}


// ===============================
// CHECK IF HEADER IS ACTUALLY DATA ROW
// ===============================

function looksLikeTransactionDataRow(row) {
  if (!row || row.length < 3) return false;

  const firstCell = String(row[0]).trim();
  const secondCell = String(row[1]).trim();

  return /^\d+$/.test(firstCell) && secondCell.startsWith("TXN-");
}


// ===============================
// TABLE RENDERING
// ===============================

function renderTable(headers, rows, container) {
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header || "";
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  rows.forEach(row => {
    const tr = document.createElement("tr");

    headers.forEach((header, index) => {
      const td = document.createElement("td");
      td.innerHTML = linkifyCell(row[index] || "");
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);

  container.innerHTML = "";
  container.appendChild(table);
}


// ===============================
// LINKIFY DRIVE / PROOF LINKS
// ===============================

function linkifyCell(value) {
  if (!value) return "";

  const text = String(value).trim();
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  if (urlRegex.test(text)) {
    return escapeHtml(text).replace(urlRegex, function (url) {
      const cleanUrl = url.replaceAll("&amp;", "&");
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">View Proof</a>`;
    });
  }

  return escapeHtml(text);
}


// ===============================
// SECURITY HELPER
// ===============================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
