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

const TABLE_RANGES = {
  "व्यवहार_नोंद": "A1:AZ1000",
  "Event_Show_Master": "A1:AZ1000"
};


// ===============================
// SELECTED COLUMNS TO DISPLAY
// ===============================

const DISPLAY_COLUMNS = {
  "व्यवहार_नोंद": [
    "Sr No",
    "Transaction Date",
    "Transaction Time",
    "Amount",
    "Type",
    "Transaction Details",
    "Proof Link",
    "Paid By / Received From",
    "Payment Mode"
  ],

  "Event_Show_Master": [
    "Event ID",
    "Event/Show Name",
    "Event Date",
    "Location",
    "Organizer/Client",
    "Expected Income",
    "Actual Income",
    "Status"
  ]
};


// ===============================
// MANUAL HEADERS FOR व्यवहार_नोंद
// ===============================

const MANUAL_HEADERS = {
  "व्यवहार_नोंद": [
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
    "Paid By / Received From",
    "Role",
    "Proof Link",
    "Proof Date",
    "Notes"
  ]
};


// ===============================
// LOAD DASHBOARD ON PAGE OPEN
// ===============================

window.onload = function () {
  loadDashboardBalance();
};


// ===============================
// GOOGLE SHEET RAW DATA FETCH
// ===============================

async function fetchSheetData(sheetName, range = "") {
  const encodedSheet = encodeURIComponent(sheetName);
  const encodedRange = range ? `&range=${encodeURIComponent(range)}` : "";

  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodedSheet}${encodedRange}&headers=0&_=${Date.now()}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to access Google Sheet. Please check sharing permissions.");
  }

  const text = await response.text();
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonText);

  if (!json.table) {
    return {
      colLabels: [],
      rows: []
    };
  }

  const cols = json.table.cols || [];

  const colLabels = cols.map((col, index) => {
    if (col.label && String(col.label).trim() !== "") {
      return String(col.label).trim();
    }
    return `Column ${index + 1}`;
  });

  const colCount = cols.length;

  let rows = (json.table.rows || []).map(row => {
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

  return {
    colLabels,
    rows
  };
}


// ===============================
// CLEAN EMPTY ROWS / COLUMNS
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

  return cleanedRows.map(row => row.slice(0, lastUsedColumnIndex + 1));
}


// ===============================
// DASHBOARD BALANCE
// ===============================

async function loadDashboardBalance() {
  const container = document.getElementById("balanceCards");
  container.innerHTML = `<p class="loading">Loading balance...</p>`;

  try {
    const data = await fetchSheetData(DASHBOARD_SHEET, DASHBOARD_RANGE);
    const rows = data.rows;

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
  container.innerHTML = `<p class="loading">Loading ${escapeHtml(sheetName)}...</p>`;

  try {
    const range = TABLE_RANGES[sheetName] || "A1:AZ1000";
    const data = await fetchSheetData(sheetName, range);

    if (!data.rows.length) {
      container.innerHTML = "<p>No data found in this sheet.</p>";
      return;
    }

    let tableData = prepareTableData(sheetName, data);

    tableData = filterSelectedColumns(
      sheetName,
      tableData.headers,
      tableData.bodyRows
    );

    renderTable(tableData.headers, tableData.bodyRows, container);

  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}


// ===============================
// PREPARE HEADER AND BODY
// ===============================

function prepareTableData(sheetName, data) {
  let rows = data.rows;
  let headers = [];
  let bodyRows = [];

  const firstRow = rows[0] || [];

  if (MANUAL_HEADERS[sheetName]) {
    headers = [...MANUAL_HEADERS[sheetName]];

    if (rowLooksLikeHeader(firstRow, sheetName)) {
      bodyRows = rows.slice(1);
    } else {
      bodyRows = rows;
    }
  }

  else if (rowLooksLikeHeader(firstRow, sheetName)) {
    headers = firstRow.map((x, i) => String(x).trim() || `Column ${i + 1}`);
    bodyRows = rows.slice(1);
  }

  else if (hasMeaningfulColumnLabels(data.colLabels)) {
    headers = data.colLabels;
    bodyRows = rows;
  }

  else {
    const maxCols = getMaxColumnCount(rows);
    headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
    bodyRows = rows;
  }

  const normalised = normaliseTable(headers, bodyRows);

  normalised.bodyRows = removeRepeatedHeaderRows(
    sheetName,
    normalised.headers,
    normalised.bodyRows
  );

  return normalised;
}


// ===============================
// REMOVE EXTRA HEADER ROW FROM BODY
// ===============================

function removeRepeatedHeaderRows(sheetName, headers, rows) {
  return rows.filter(row => {
    const rowText = row
      .map(x => normaliseHeaderName(x))
      .join("|");

    const headerText = headers
      .map(x => normaliseHeaderName(x))
      .join("|");

    if (rowText === headerText) {
      return false;
    }

    const headerKeywordCount = countHeaderKeywords(sheetName, row);

    if (headerKeywordCount >= 3) {
      return false;
    }

    return true;
  });
}


function countHeaderKeywords(sheetName, row) {
  const keywords = sheetName === "व्यवहार_नोंद"
    ? [
        "sr no",
        "transaction id",
        "transaction date",
        "transaction time",
        "event id",
        "event/show name",
        "month",
        "year",
        "category",
        "sub category",
        "type",
        "transaction details",
        "payment mode",
        "amount",
        "proof link",
        "paid by / received from"
      ]
    : [
        "event id",
        "event/show name",
        "event date",
        "location",
        "organizer/client",
        "expected income",
        "actual income",
        "status"
      ];

  let count = 0;

  row.forEach(cell => {
    const value = normaliseHeaderName(cell);

    if (keywords.includes(value)) {
      count++;
    }
  });

  return count;
}


// ===============================
// SELECT ONLY REQUIRED COLUMNS
// ===============================

function filterSelectedColumns(sheetName, headers, rows) {
  const selectedColumns = DISPLAY_COLUMNS[sheetName];

  if (!selectedColumns) {
    return {
      headers,
      bodyRows: rows
    };
  }

  const selectedIndexes = selectedColumns.map(columnName => {
    return findColumnIndex(headers, columnName);
  });

  const filteredRows = rows.map(row => {
    return selectedIndexes.map(index => {
      if (index === -1) return "";
      return row[index] || "";
    });
  });

  return {
    headers: selectedColumns,
    bodyRows: filteredRows
  };
}


function findColumnIndex(headers, requiredColumn) {
  const required = normaliseHeaderName(requiredColumn);

  const aliases = {
    "proof link": [
      "proof link",
      "proof link/file name",
      "proof/file name",
      "proof reference",
      "proof / reference",
      "proof",
      "file name"
    ],

    "paid by / received from": [
      "paid by / received from",
      "paid by",
      "received from",
      "person name",
      "name",
      "member name"
    ],

    "event/show name": [
      "event/show name",
      "event name",
      "show name",
      "event show name"
    ],

    "organizer/client": [
      "organizer/client",
      "organizer",
      "client",
      "organizer name",
      "client name"
    ]
  };

  const possibleNames = aliases[required] || [required];

  for (let i = 0; i < headers.length; i++) {
    const current = normaliseHeaderName(headers[i]);

    if (possibleNames.includes(current)) {
      return i;
    }
  }

  return -1;
}


// ===============================
// HEADER DETECTION
// ===============================

function rowLooksLikeHeader(row, sheetName) {
  const text = row.map(x => String(x).trim().toLowerCase()).join("|");

  if (sheetName === "व्यवहार_नोंद") {
    return text.includes("sr no") && text.includes("transaction id");
  }

  if (sheetName === "Event_Show_Master") {
    return text.includes("event id") || text.includes("event/show name");
  }

  return false;
}


function hasMeaningfulColumnLabels(labels) {
  if (!labels || !labels.length) return false;

  const meaningful = labels.filter(label => {
    const text = String(label).trim().toLowerCase();
    return text !== "" && !text.startsWith("column ");
  });

  return meaningful.length >= Math.ceil(labels.length / 2);
}


function normaliseTable(headers, rows) {
  rows = rows.filter(row => {
    return row.some(cell => String(cell).trim() !== "");
  });

  const maxCols = Math.max(headers.length, getMaxColumnCount(rows));

  while (headers.length < maxCols) {
    headers.push(`Column ${headers.length + 1}`);
  }

  headers = headers.slice(0, maxCols);

  rows = rows.map(row => {
    const output = [...row];

    while (output.length < maxCols) {
      output.push("");
    }

    return output.slice(0, maxCols);
  });

  return {
    headers,
    bodyRows: rows
  };
}


function getMaxColumnCount(rows) {
  if (!rows.length) return 0;

  return Math.max(...rows.map(row => row.length));
}


function normaliseHeaderName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
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
// HTML SAFETY
// ===============================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
