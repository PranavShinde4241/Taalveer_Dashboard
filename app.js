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

// Your Google Sheet ID from the shared link
const SPREADSHEET_ID = "1_nlRFxAST7ErzyqiBr9b_Tw8OhjNCAXz";

// Allowed sheets only
const ALLOWED_SHEETS = ["व्यवहार_नोंद", "Event_Show_Master"];

// Dashboard range
const DASHBOARD_SHEET = "Dashboard_Summary";
const DASHBOARD_RANGE = "A4:B6";


// ===============================
// LOAD DASHBOARD ON PAGE OPEN
// ===============================

window.onload = function () {
  loadDashboardBalance();
};


// ===============================
// GOOGLE SHEET FETCH FUNCTION
// ===============================

async function fetchGoogleSheetTable(sheetName, range = "") {
  const encodedSheet = encodeURIComponent(sheetName);
  const encodedRange = range ? `&range=${encodeURIComponent(range)}` : "";

  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodedSheet}${encodedRange}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to access Google Sheet. Please check sharing permissions.");
  }

  const text = await response.text();

  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonText);

  if (!json.table) {
    return {
      headers: [],
      rows: []
    };
  }

  const headers = (json.table.cols || []).map((col, index) => {
    if (col.label && col.label.trim() !== "") {
      return col.label;
    }
    return `Column ${index + 1}`;
  });

  const rows = (json.table.rows || []).map(row => {
    return (json.table.cols || []).map((col, index) => {
      const cell = row.c && row.c[index] ? row.c[index] : null;

      if (!cell) return "";

      return cell.f !== undefined ? cell.f : cell.v !== undefined ? cell.v : "";
    });
  });

  return {
    headers,
    rows
  };
}


// ===============================
// DASHBOARD BALANCE
// ===============================

async function loadDashboardBalance() {
  const container = document.getElementById("balanceCards");
  container.innerHTML = `<p class="loading">Loading balance...</p>`;

  try {
    const tableData = await fetchGoogleSheetTable(DASHBOARD_SHEET, DASHBOARD_RANGE);
    const rows = tableData.rows;

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
    const tableData = await fetchGoogleSheetTable(sheetName);

    if (!tableData.rows.length) {
      container.innerHTML = "<p>No data found in this sheet.</p>";
      return;
    }

    renderTable(tableData.headers, tableData.rows, container);

  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}


// ===============================
// TABLE RENDERING WITH PROPER HEADER
// ===============================

function renderTable(headers, rows, container) {
  const table = document.createElement("table");

  // Create table header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach(header => {
    const th = document.createElement("th");
    th.textContent = header || "";
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create table body
  const tbody = document.createElement("tbody");

  rows.forEach(row => {
    const tr = document.createElement("tr");

    row.forEach(cell => {
      const td = document.createElement("td");
      td.innerHTML = linkifyCell(cell);
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
