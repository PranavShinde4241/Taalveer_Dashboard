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
  "Show_नोंद"
];

const DASHBOARD_SHEET = "Dashboard_Summary";
const DASHBOARD_RANGE = "A4:B6";

const TABLE_RANGES = {
  "व्यवहार_नोंद": "A1:AZ1000",
  "Show_नोंद": "A1:AZ1000"
};

// Website button name and actual Google Sheet tab mapping.
// Current website name: Show_नोंद
// Actual source tab: Event_Show_Master
const SHEET_SOURCE_MAP = {
  "व्यवहार_नोंद": ["व्यवहार_नोंद"],
  "Show_नोंद": ["Show_नोंद", "Event_Show_Master"]
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

  "Show_नोंद": [
    "Event ID",
    "Event/Show Name",
    "Event Date",
    "Day",
    "Start Time",
    "End Time",
    "Location",
    "Organizer/Client",
    "Expected Income",
    "Actual Income"
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

  "Show_नोंद": [
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
// EXCEL-LIKE FILTER STATE
// ===============================

let CURRENT_TABLE = {
  sheetName: "",
  headers: [],
  rows: []
};

let TRANSACTION_FILTERS = {
  monthExcluded: [],
  typeExcluded: [],
  paidByExcluded: [],
  paymentModeExcluded: [],
  amountSort: "none"
};

const FILTERABLE_TRANSACTION_COLUMNS = {
  "Transaction Date": {
    filterType: "month",
    stateKey: "monthExcluded"
  },
  "Amount": {
    filterType: "amountSort"
  },
  "Type": {
    filterType: "value",
    stateKey: "typeExcluded"
  },
  "Paid By / Received From": {
    filterType: "value",
    stateKey: "paidByExcluded"
  },
  "Payment Mode": {
    filterType: "value",
    stateKey: "paymentModeExcluded"
  }
};

const BLANK_VALUE_KEY = "__BLANK__";


// ===============================
// LOAD DASHBOARD ON PAGE OPEN
// ===============================

document.addEventListener("DOMContentLoaded", function () {
  loadDashboardBalance();
});

document.addEventListener("click", function () {
  closeAllFilterMenus();
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


async function fetchSheetDataWithFallback(displaySheetName, range = "") {
  const possibleSheetNames = SHEET_SOURCE_MAP[displaySheetName] || [displaySheetName];

  let lastError = null;

  for (const actualSheetName of possibleSheetNames) {
    try {
      return await fetchSheetData(actualSheetName, range);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to load sheet data.");
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
    const data = await fetchSheetDataWithFallback(sheetName, range);

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
      renderTransactionTable();
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

  const headerIndex = findHeaderRowIndex(sheetName, rows);

  if (MANUAL_HEADERS[sheetName]) {
    headers = [...MANUAL_HEADERS[sheetName]];

    if (headerIndex !== -1) {
      bodyRows = rows.slice(headerIndex + 1);
    } else {
      bodyRows = rows;
    }
  }

  else if (headerIndex !== -1) {
    headers = rows[headerIndex].map((x, i) => String(x).trim() || `Column ${i + 1}`);
    bodyRows = rows.slice(headerIndex + 1);
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


function findHeaderRowIndex(sheetName, rows) {
  for (let i = 0; i < rows.length; i++) {
    if (rowLooksLikeHeader(rows[i], sheetName)) {
      return i;
    }
  }

  return -1;
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
// EXCEL-LIKE FILTER RENDERING
// ===============================

function resetTransactionFilters() {
  TRANSACTION_FILTERS = {
    monthExcluded: [],
    typeExcluded: [],
    paidByExcluded: [],
    paymentModeExcluded: [],
    amountSort: "none"
  };
}


function renderTransactionTable() {
  const container = document.getElementById("tableContainer");
  const headers = CURRENT_TABLE.headers;
  const allRows = CURRENT_TABLE.rows;

  const filteredRows = applyTransactionFilters(headers, allRows);

  container.innerHTML = "";

  const topBar = document.createElement("div");
  topBar.className = "excel-filter-topbar";
  topBar.innerHTML = `
    <span>Showing ${filteredRows.length} record(s)</span>
    <button type="button" onclick="resetTransactionFiltersAndRender()">Clear All Filters</button>
  `;
  container.appendChild(topBar);

  const table = buildTableElement(headers, filteredRows, {
    enableExcelFilters: true,
    allRows: allRows
  });

  container.appendChild(table);
}


function resetTransactionFiltersAndRender() {
  resetTransactionFilters();
  renderTransactionTable();
}


function buildTableElement(headers, rows, options = {}) {
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  headers.forEach(header => {
    const th = document.createElement("th");

    if (
      options.enableExcelFilters &&
      FILTERABLE_TRANSACTION_COLUMNS[header]
    ) {
      th.className = "excel-filter-th";
      th.appendChild(
        createFilterableHeader(header, headers, options.allRows || [])
      );
    } else {
      th.textContent = header || "";
    }

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


function createFilterableHeader(header, headers, allRows) {
  const wrapper = document.createElement("div");
  wrapper.className = "excel-filter-header";

  const label = document.createElement("span");
  label.textContent = header;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "excel-filter-button";
  button.innerHTML = "▼";

  if (isFilterActive(header)) {
    button.classList.add("active");
  }

  const menu = createFilterMenu(header, headers, allRows);

  button.addEventListener("click", function (event) {
    event.stopPropagation();

    const isOpen = menu.classList.contains("show");
    closeAllFilterMenus();

    if (!isOpen) {
      menu.classList.add("show");
    }
  });

  menu.addEventListener("click", function (event) {
    event.stopPropagation();
  });

  wrapper.appendChild(label);
  wrapper.appendChild(button);
  wrapper.appendChild(menu);

  return wrapper;
}


function createFilterMenu(header, headers, allRows) {
  const config = FILTERABLE_TRANSACTION_COLUMNS[header];

  const menu = document.createElement("div");
  menu.className = "excel-filter-menu";

  const menuTitle = document.createElement("div");
  menuTitle.className = "excel-filter-title";
  menuTitle.textContent = header;
  menu.appendChild(menuTitle);

  if (config.filterType === "amountSort") {
    menu.appendChild(createAmountSortOptions());
    return menu;
  }

  const columnIndex = headers.indexOf(header);

  const options =
    config.filterType === "month"
      ? getUniqueMonths(allRows, columnIndex)
      : getUniqueFilterValues(allRows, columnIndex);

  const actionRow = document.createElement("div");
  actionRow.className = "excel-filter-actions";

  const selectAllBtn = document.createElement("button");
  selectAllBtn.type = "button";
  selectAllBtn.textContent = "Select All";
  selectAllBtn.onclick = function () {
    TRANSACTION_FILTERS[config.stateKey] = [];
    renderTransactionTable();
  };

  const clearAllBtn = document.createElement("button");
  clearAllBtn.type = "button";
  clearAllBtn.textContent = "Clear All";
  clearAllBtn.onclick = function () {
    TRANSACTION_FILTERS[config.stateKey] = options.map(x => x.value);
    renderTransactionTable();
  };

  actionRow.appendChild(selectAllBtn);
  actionRow.appendChild(clearAllBtn);
  menu.appendChild(actionRow);

  const list = document.createElement("div");
  list.className = "excel-filter-list";

  options.forEach(option => {
    const row = document.createElement("label");
    row.className = "excel-filter-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !TRANSACTION_FILTERS[config.stateKey].includes(option.value);

    checkbox.onchange = function () {
      updateExcludedFilterValue(config.stateKey, option.value, checkbox.checked);
      renderTransactionTable();
    };

    const text = document.createElement("span");
    text.textContent = option.label;

    row.appendChild(checkbox);
    row.appendChild(text);

    list.appendChild(row);
  });

  menu.appendChild(list);

  return menu;
}


function createAmountSortOptions() {
  const wrapper = document.createElement("div");
  wrapper.className = "excel-filter-list";

  const options = [
    { value: "none", label: "No Sort" },
    { value: "asc", label: "Sort Smallest to Largest" },
    { value: "desc", label: "Sort Largest to Smallest" }
  ];

  options.forEach(option => {
    const row = document.createElement("label");
    row.className = "excel-filter-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "amountSort";
    radio.value = option.value;
    radio.checked = TRANSACTION_FILTERS.amountSort === option.value;

    radio.onchange = function () {
      TRANSACTION_FILTERS.amountSort = option.value;
      renderTransactionTable();
    };

    const text = document.createElement("span");
    text.textContent = option.label;

    row.appendChild(radio);
    row.appendChild(text);

    wrapper.appendChild(row);
  });

  return wrapper;
}


function updateExcludedFilterValue(stateKey, value, isChecked) {
  let values = TRANSACTION_FILTERS[stateKey];

  if (isChecked) {
    values = values.filter(x => x !== value);
  } else {
    if (!values.includes(value)) {
      values.push(value);
    }
  }

  TRANSACTION_FILTERS[stateKey] = values;
}


function closeAllFilterMenus() {
  document.querySelectorAll(".excel-filter-menu.show").forEach(menu => {
    menu.classList.remove("show");
  });
}


function isFilterActive(header) {
  const config = FILTERABLE_TRANSACTION_COLUMNS[header];

  if (!config) return false;

  if (config.filterType === "amountSort") {
    return TRANSACTION_FILTERS.amountSort !== "none";
  }

  return TRANSACTION_FILTERS[config.stateKey].length > 0;
}


// ===============================
// APPLY FILTERS
// ===============================

function applyTransactionFilters(headers, rows) {
  const dateIndex = headers.indexOf("Transaction Date");
  const amountIndex = headers.indexOf("Amount");
  const typeIndex = headers.indexOf("Type");
  const paidByIndex = headers.indexOf("Paid By / Received From");
  const paymentModeIndex = headers.indexOf("Payment Mode");

  let filteredRows = rows.filter(row => {
    const monthKey = getMonthKey(row[dateIndex]);
    const typeKey = getFilterValueKey(row[typeIndex]);
    const paidByKey = getFilterValueKey(row[paidByIndex]);
    const paymentModeKey = getFilterValueKey(row[paymentModeIndex]);

    const monthAllowed =
      !TRANSACTION_FILTERS.monthExcluded.includes(monthKey);

    const typeAllowed =
      !TRANSACTION_FILTERS.typeExcluded.includes(typeKey);

    const paidByAllowed =
      !TRANSACTION_FILTERS.paidByExcluded.includes(paidByKey);

    const paymentModeAllowed =
      !TRANSACTION_FILTERS.paymentModeExcluded.includes(paymentModeKey);

    return monthAllowed && typeAllowed && paidByAllowed && paymentModeAllowed;
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


function getUniqueFilterValues(rows, columnIndex) {
  if (columnIndex === -1) return [];

  const map = new Map();

  rows.forEach(row => {
    const rawValue = row[columnIndex];
    const key = getFilterValueKey(rawValue);
    const label = key === BLANK_VALUE_KEY ? "(Blank)" : String(rawValue).trim();

    map.set(key, label);
  });

  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => {
      return { value, label };
    });
}


function getFilterValueKey(value) {
  const text = String(value || "").trim();
  return text === "" ? BLANK_VALUE_KEY : text;
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
    return text.includes("sr no") && text.includes("transaction");
  }

  if (sheetName === "Show_नोंद") {
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
// NORMAL TABLE RENDERING
// ===============================

function renderTable(headers, rows, container) {
  container.innerHTML = "";

  const table = buildTableElement(headers, rows, {
    enableExcelFilters: false
  });

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
