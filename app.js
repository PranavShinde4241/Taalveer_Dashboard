// ===============================
// BASIC CONFIGURATION
// ===============================

// Your Google Sheet ID from the shared link
const SPREADSHEET_ID = "1_nlRFxAST7ErzyqiBr9b_Tw8OhjNCAXz";

// Basic website login
const VALID_USERNAME = "guest";
const VALID_PASSWORD = "taalveer@2026";

// Allowed sheets only
const ALLOWED_SHEETS = ["व्यवहार_नोंद", "Event_Show_Master"];

// Dashboard range
const DASHBOARD_SHEET = "Dashboard_Summary";
const DASHBOARD_RANGE = "A4:B6";


// ===============================
// LOGIN FUNCTIONS
// ===============================

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorBox = document.getElementById("loginError");

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    sessionStorage.setItem("loggedIn", "true");

    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("mainPage").classList.remove("hidden");

    loadDashboardBalance();
  } else {
    errorBox.textContent = "Invalid username or password.";
  }
}

function logout() {
  sessionStorage.removeItem("loggedIn");
  location.reload();
}

window.onload = function () {
  if (sessionStorage.getItem("loggedIn") === "true") {
    document.getElementById("loginPage").classList.add("hidden");
    document.getElementById("mainPage").classList.remove("hidden");
    loadDashboardBalance();
  }
};


// ===============================
// GOOGLE SHEET FETCH FUNCTION
// ===============================

async function fetchSheetData(sheetName, range = "") {
  const encodedSheet = encodeURIComponent(sheetName);
  const encodedRange = range ? `&range=${encodeURIComponent(range)}` : "";

  const url =
    `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodedSheet}${encodedRange}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Unable to access Google Sheet. Please check sharing permissions.");
  }

  const text = await response.text();

  // Google returns JSON wrapped inside: google.visualization.Query.setResponse(...)
  const jsonText = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const json = JSON.parse(jsonText);

  if (!json.table || !json.table.rows) {
    return [];
  }

  return json.table.rows.map(row =>
    row.c.map(cell => {
      if (!cell) return "";
      return cell.f || cell.v || "";
    })
  );
}


// ===============================
// DASHBOARD BALANCE
// ===============================

async function loadDashboardBalance() {
  const container = document.getElementById("balanceCards");
  container.innerHTML = `<p class="loading">Loading balance...</p>`;

  try {
    const rows = await fetchSheetData(DASHBOARD_SHEET, DASHBOARD_RANGE);

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
    container.innerHTML = `<p class="error">${error.message}</p>`;
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
    const rows = await fetchSheetData(sheetName);

    if (!rows.length) {
      container.innerHTML = "<p>No data found in this sheet.</p>";
      return;
    }

    renderTable(rows, container);

  } catch (error) {
    container.innerHTML = `<p class="error">${error.message}</p>`;
  }
}


// ===============================
// TABLE RENDERING
// ===============================

function renderTable(rows, container) {
  const table = document.createElement("table");

  rows.forEach((row, rowIndex) => {
    const tr = document.createElement("tr");

    row.forEach(cell => {
      const cellElement = document.createElement(rowIndex === 0 ? "th" : "td");

      if (rowIndex === 0) {
        cellElement.textContent = cell || "";
      } else {
        cellElement.innerHTML = linkifyCell(cell);
      }

      tr.appendChild(cellElement);
    });

    table.appendChild(tr);
  });

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
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">View Proof</a>`;
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
