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

const ALLOWED_SHEETS = [
  "व्यवहार_नोंद",
  "Event_Show_Master",
  "Income_नोंद"
];

const DASHBOARD_SHEET = "Dashboard_Summary";
const DASHBOARD_RANGE = "A4:B6";

const TABLE_RANGES = {
  "व्यवहार_नोंद": "A1:AZ1000",
  "Event_Show_Master": "A1:AZ1000",
  "Income_नोंद": "A1:AZ1000"
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
    "Day",
    "Start Time",
    "End Time",
    "Location",
    "Organizer/Client",
    "Expected Income",
    "Actual Income",
    "Actual Expense",
    "Net Surplus/(Deficit)",
    "Status",
    "Remarks"
  ]
};


// ===============================
// MANUAL HEADERS
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
  ],

  "Event_Show_Master": [
    "Event ID",
    "Event/Show Name",
    "Event Date",
    "Day",
    "Start Time",
    "End Time",
    "Location",
    "Organizer/Client",
    "Expected Income",
    "Actual Income",
    "Actual Expense",
    "Net Surplus/(Deficit)",
    "Status",
    "Remarks"
  ]
};


// ===============================
// FILTER STATE FOR व्यवहार_नोंद
// ===============================

let CURRENT_TABLE = {
  sheetName: "",
  headers: [],
  rows: []
};

let TRANSACTION_FILTERS = {
  month: "all",
  amountSort: "none",
  type: "all",
  paidBy: "all",
  paymentMode: "all"
};


// ===============================
// LOAD DASHBOARD ON PAGE OPEN
// ===============================

document.addEventListener("DOMContentLoaded", function () {
  loadDashboardBalance();
});


// ===============================
// GOOGLE SHEET JSONP DATA FETCH
// ===============================

function fetchSheetData(sheetName, range = "") {
  return new Promise((resolve, reject) => {
    const callbackName =
      "sheetCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const encodedSheet = encodeURIComponent(sheetName);
    const encodedRange = range ? `&range=${encodeURIComponent(range)}` : "";

    const url =
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq` +
      `?tqx=out:json;responseHandler:${callbackName}` +
      `&sheet=${encodedSheet}` +
      `${encodedRange}` +
      `&headers=0` +
      `&_=${Date.now()}`;

    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          "Unable to load Google Sheet data. Please confirm the sheet is shared as Anyone with the link → Viewer."
        )
      );
    }, 20000);

    window[callbackName] = function (json) {
      clearTimeout(timeout);
      cleanup();

      if (!json || json.status === "error") {
        let msg = "Google Sheet returned an error.";

        if (json && json.errors && json.errors.length) {
          msg = json.errors
            .map(e => e.detailed_message || e.message)
            .join(" | ");
        }

        reject(new Error(msg));
        return;
      }

      if (!json.table) {
        resolve({
          colLabels: [],
          rows: []
        });
        return;
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
            output.push(
              cell.f !== undefined
                ? cell.f
                : cell.v !== undefined
                  ? cell.v
                  : ""
            );
          }
        }

        return output;
      });

      rows = trimEmptyRowsAndColumns(rows);

      resolve({
        colLabels,
        rows
      });
    };

    script.onerror = function () {
      clearTimeout(timeout);
      cleanup();
      reject(
        new Error(
          "Unable to load Google Sheet. Check sharing permission and sheet name."
        )
      );
    };

    function cleanup() {
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    script.src = url;
    document.body.appendChild(script);
  });
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
    container.innerHTML = `
      <p class="error">${escapeHtml(error.message)}</p>
      <p style="font-size:14px;color:#666;">
        Please check Google Sheet sharing: Anyone with the link → Viewer.
      </p>
    `;
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

    CURRENT_TABLE = {
      sheetName,
      headers: tableData.headers,
      rows: tableData.bodyRows
    };

    if (sheetName === "व्यवहार_नोंद") {
      resetTransactionFilters();
      renderTransactionTableWithFilters();
    } else {
      renderTable(tableData.headers, tableData.bodyRows, container);
    }

  } catch (error) {
    container.innerHTML = `
      <p class="error">${escapeHtml(error.message)}</p>
      <p style="font-size:14px;color:#666;">
        Please check whether this sheet name exists in Google Sheet.
      </p>
    `;
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
        "day",
        "start time",
        "end time",
        "location",
        "organizer/client",
        "expected income",
        "actual income",
        "actual expense",
        "net surplus/(deficit)",
        "status",
        "remarks"
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
    ],

    "expected income": [
      "expected income",
      "expected amount",
      "estimated income"
    ],

    "actual income": [
      "actual income",
      "received income",
      "total income"
    ],

    "actual expense": [
      "actual expense",
      "actual expenses",
      "total expense",
      "total expenses"
    ],

    "net surplus/(deficit)": [
      "net surplus/(deficit)",
      "net surplus / deficit",
      "net surplus",
      "surplus deficit",
      "net surplus deficit",
      "surplus/(deficit)"
    ],

    "start time": [
      "start time",
      "starting time",
      "event start time"
    ],

    "end time": [
      "end time",
      "ending time",
      "event end time"
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
// व्यवहार_नोंद FILTER FUNCTIONS
// ===============================

function resetTransactionFilters() {
  TRANSACTION_FILTERS = {
    month: "all",
    amountSort: "none",
    type: "all",
    paidBy: "all",
    paymentMode: "all"
  };
}


function renderTransactionTableWithFilters() {
  const container = document.getElementById("tableContainer");

  const headers = CURRENT_TABLE.headers;
  const allRows = CURRENT_TABLE.rows;

  const filteredRows = applyTransactionFilters(headers, allRows);

  container.innerHTML = "";

  const filterPanel = createTransactionFilterPanel(headers, allRows, filteredRows.length);
  container.appendChild(filterPanel);

  const table = buildTableElement(headers, filteredRows);
  container.appendChild(table);
}


function createTransactionFilterPanel(headers, rows, visibleCount) {
  const panel = document.createElement("div");
  panel.className = "filter-panel";

  const dateIndex = headers.indexOf("Transaction Date");
  const typeIndex = headers.indexOf("Type");
  const paidByIndex = headers.indexOf("Paid By / Received From");
  const paymentModeIndex = headers.indexOf("Payment Mode");

  const months = getUniqueMonths(rows, dateIndex);
  const types = getUniqueValues(rows, typeIndex);
  const paidByNames = getUniqueValues(rows, paidByIndex);
  const paymentModes = getUniqueValues(rows, paymentModeIndex);

  panel.appendChild(
    createSelectFilter(
      "Transaction Month",
      "monthFilter",
      months,
      TRANSACTION_FILTERS.month,
      function (value) {
        TRANSACTION_FILTERS.month = value;
        renderTransactionTableWithFilters();
      },
      true
    )
  );

  panel.appendChild(
    createSelectFilter(
      "Amount Sort",
      "amountSortFilter",
      [
        { value: "none", label: "No Sort" },
        { value: "asc", label: "Amount: Low to High" },
        { value: "desc", label: "Amount: High to Low" }
      ],
      TRANSACTION_FILTERS.amountSort,
      function (value) {
        TRANSACTION_FILTERS.amountSort = value;
        renderTransactionTableWithFilters();
      },
      false
    )
  );

  panel.appendChild(
    createSelectFilter(
      "Type",
      "typeFilter",
      types,
      TRANSACTION_FILTERS.type,
      function (value) {
        TRANSACTION_FILTERS.type = value;
        renderTransactionTableWithFilters();
      },
      true
    )
  );

  panel.appendChild(
    createSelectFilter(
      "Paid By / Received From",
      "paidByFilter",
      paidByNames,
      TRANSACTION_FILTERS.paidBy,
      function (value) {
        TRANSACTION_FILTERS.paidBy = value;
        renderTransactionTableWithFilters();
      },
      true
    )
  );

  panel.appendChild(
    createSelectFilter(
      "Payment Mode",
      "paymentModeFilter",
      paymentModes,
      TRANSACTION_FILTERS.paymentMode,
      function (value) {
        TRANSACTION_FILTERS.paymentMode = value;
        renderTransactionTableWithFilters();
      },
      true
    )
  );

  const countBox = document.createElement("div");
  countBox.className = "filter-count";
  countBox.textContent = `Showing ${visibleCount} record(s)`;
  panel.appendChild(countBox);

  const resetButton = document.createElement("button");
  resetButton.className = "filter-reset-btn";
  resetButton.textContent = "Reset Filters";
  resetButton.onclick = function () {
    resetTransactionFilters();
    renderTransactionTableWithFilters();
  };
  panel.appendChild(resetButton);

  return panel;
}


function createSelectFilter(labelText, id, options, selectedValue, onChange, addAllOption) {
  const wrapper = document.createElement("div");
  wrapper.className = "filter-item";

  const label = document.createElement("label");
  label.setAttribute("for", id);
  label.textContent = labelText;

  const select = document.createElement("select");
  select.id = id;

  if (addAllOption) {
    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    select.appendChild(allOption);
  }

  options.forEach(option => {
    const opt = document.createElement("option");

    if (typeof option === "object") {
      opt.value = option.value;
      opt.textContent = option.label;
    } else {
      opt.value = option;
      opt.textContent = option;
    }

    select.appendChild(opt);
  });

  select.value = selectedValue;

  select.onchange = function () {
    onChange(select.value);
  };

  wrapper.appendChild(label);
  wrapper.appendChild(select);

  return wrapper;
}


function applyTransactionFilters(headers, rows) {
  const dateIndex = headers.indexOf("Transaction Date");
  const amountIndex = headers.indexOf("Amount");
  const typeIndex = headers.indexOf("Type");
  const paidByIndex = headers.indexOf("Paid By / Received From");
  const paymentModeIndex = headers.indexOf("Payment Mode");

  let filteredRows = rows.filter(row => {
    const rowMonth = getMonthKey(row[dateIndex]);
    const rowType = String(row[typeIndex] || "").trim();
    const rowPaidBy = String(row[paidByIndex] || "").trim();
    const rowPaymentMode = String(row[paymentModeIndex] || "").trim();

    const monthMatch =
      TRANSACTION_FILTERS.month === "all" ||
      rowMonth === TRANSACTION_FILTERS.month;

    const typeMatch =
      TRANSACTION_FILTERS.type === "all" ||
      rowType === TRANSACTION_FILTERS.type;

    const paidByMatch =
      TRANSACTION_FILTERS.paidBy === "all" ||
      rowPaidBy === TRANSACTION_FILTERS.paidBy;

    const paymentModeMatch =
      TRANSACTION_FILTERS.paymentMode === "all" ||
      rowPaymentMode === TRANSACTION_FILTERS.paymentMode;

    return monthMatch && typeMatch && paidByMatch && paymentModeMatch;
  });

  filteredRows = [...filteredRows];

  if (TRANSACTION_FILTERS.amountSort === "asc") {
    filteredRows.sort((a, b) => parseAmount(a[amountIndex]) - parseAmount(b[amountIndex]));
  }

  if (TRANSACTION_FILTERS.amountSort === "desc") {
    filteredRows.sort((a, b) => parseAmount(b[amountIndex]) - parseAmount(a[amountIndex]));
  }

  return filteredRows;
}


function getUniqueValues(rows, columnIndex) {
  if (columnIndex === -1) return [];

  const values = rows
    .map(row => String(row[columnIndex] || "").trim())
    .filter(value => value !== "");

  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}


function getUniqueMonths(rows, dateIndex) {
  if (dateIndex === -1) return [];

  const monthMap = new Map();

  rows.forEach(row => {
    const key = getMonthKey(row[dateIndex]);

    if (key) {
      monthMap.set(key, getMonthLabel(key));
    }
  });

  return [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([value, label]) => {
      return { value, label };
    });
}


function getMonthKey(dateValue) {
  if (!dateValue) return "";

  const text = String(dateValue).trim();

  const monthNames = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };

  let match = text.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/);

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  match = text.match(/(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})/);

  if (match) {
    const monthText = match[2].toLowerCase();
    const year = Number(match[3]);

    if (monthNames[monthText] !== undefined) {
      const month = monthNames[monthText] + 1;
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  match = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);

  if (match) {
    const month = Number(match[2]);
    const year = Number(match[3]);
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  const parsedDate = new Date(text);

  if (!isNaN(parsedDate.getTime())) {
    const year = parsedDate.getFullYear();
    const month = parsedDate.getMonth() + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  return "";
}


function getMonthLabel(monthKey) {
  const [year, month] = monthKey.split("-");
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  const monthIndex = Number(month) - 1;
  return `${monthNames[monthIndex]} ${year}`;
}


function parseAmount(value) {
  const cleanValue = String(value || "")
    .replace(/[₹,\s]/g, "")
    .replace(/[^\d.-]/g, "");

  const amount = parseFloat(cleanValue);

  return isNaN(amount) ? 0 : amount;
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

  if (sheetName === "Income_नोंद") {
    return text.includes("income") || text.includes("amount") || text.includes("date");
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
  container.innerHTML = "";
  const table = buildTableElement(headers, rows);
  container.appendChild(table);
}


function buildTableElement(headers, rows) {
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

  return table;
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
