// ===============================
// BASIC CONFIGURATION
// ===============================

const SPREADSHEET_ID = "1_nlRFxAST7ErzyqiBr9b_Tw8OhjNCAXz";

const VALID_USERNAME = "guest";
const VALID_PASSWORD = "taalveer@2026";

const ALLOWED_SHEETS = ["व्यवहार_नोंद", "Event_Show_Master"];

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
// GOOGLE SHEET JSONP FETCH
// This fixes "Failed to fetch" / CORS issue
// ===============================

function fetchSheetData(sheetName, range = "") {
  return new Promise((resolve, reject) => {
    const callbackName = "googleSheetCallback_" + Date.now();

    window[callbackName] = function (data) {
      try {
        delete window[callbackName];
        document.body.removeChild(script);

        if (!data || !data.table || !data.table.rows) {
          resolve([]);
          return;
        }

        const rows = data.table.rows.map(row => {
          return row.c.map(cell => {
            if (!cell) return "";
            return cell.f || cell.v || "";
          });
        });

        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };

    const encodedSheet = encodeURIComponent(sheetName);

    let url =
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?` +
      `tqx=responseHandler:${callbackName}` +
      `&sheet=${encodedSheet}`;

    if (range) {
      url += `&range=${encodeURIComponent(range)}`;
    }

    const script = document.createElement("script");
    script.src = url;

    script.onerror = function () {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(
        new Error(
          "Google Sheet could not be loaded. Please check sheet sharing permission and sheet name."
        )
      );
    };

    document.body.appendChild(script);
  });
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
// DRIVE / PROOF LINKS CLICKABLE
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
// HTML SECURITY HELPER
// ===============================

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
