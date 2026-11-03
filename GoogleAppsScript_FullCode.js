/**
 * ==========================================================================
 * KMA PRINTWORKS - MASTER BACKEND GOOGLE APPS SCRIPT
 * Sistem Alur Kerja Internal: Project Tracker, Invoicing, & Laporan Keuangan
 * ==========================================================================
 * 
 * PANDUAN PEMASANGAN:
 * 1. Buka Google Spreadsheet database KMA kamu.
 * 2. Di menu atas, klik Extensions (Ekstensi) > Apps Script.
 * 3. Hapus semua kode lama di file Code.gs, lalu paste seluruh isi file ini.
 * 4. Klik tombol Save (ikon Disket).
 * 5. Klik Deploy (Terapkan) > Manage Deployments (Kelola Penerapan) > Edit (ikon Pensil)
 *    atau New Deployment (Penerapan Baru):
 *    - Type: Web app
 *    - Description: KMA Master API v2.0
 *    - Execute as: Me (email kamu)
 *    - Who has access: Anyone (Siapa saja)
 * 6. Klik Deploy dan berikan otorisasi jika diminta.
 * 7. Copy Web App URL yang dihasilkan dan pastikan URL tersebut terpasang di
 *    projecttracker.html, invoicing.html, dan laporankeuangan.html.
 */

// Nama-nama Sheet Database
const SHEET_PROJECTS     = "Projects";
const SHEET_ITEMS        = "Items";
const SHEET_INVOICES     = "Invoices";
const SHEET_TRANSACTIONS = "Transactions";

/**
 * Handle GET Request (Mengambil seluruh data sistem)
 */
function doGet(e) {
  try {
    ensureSheetsSetup();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const projectsData = getSheetObjects(ss.getSheetByName(SHEET_PROJECTS));
    const itemsData = getSheetObjects(ss.getSheetByName(SHEET_ITEMS));
    const invoicesData = getSheetObjects(ss.getSheetByName(SHEET_INVOICES));
    const transactionsData = getSheetObjects(ss.getSheetByName(SHEET_TRANSACTIONS));

    const response = {
      status: "success",
      projects: projectsData,
      items: itemsData,
      invoices: invoicesData,
      transactions: transactionsData,
      serverTime: new Date().toISOString()
    };

    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handle POST Request (Menyimpan dan mengupdate data)
 */
function doPost(e) {
  try {
    ensureSheetsSetup();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Parse body payload
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error("Payload kosong.");
    }

    const action = data.action;

    // 1. UPDATE CEPAT STATUS PROJECT (LUNAS / SELESAI)
    if (action === "update_project_status") {
      const res = updateProjectStatusFast(ss, data.id, data.payment_status, data.work_status, data.status);
      return sendJsonResponse({ status: "success", updated: res });
    }

    // 2. SIMPAN / UPDATE LENGKAP PROJECT
    if (action === "save_project") {
      const prjId = saveProjectComplete(ss, data.project, data.items || []);
      return sendJsonResponse({ status: "success", id: prjId });
    }

    // 3. SIMPAN / UPDATE INVOICE
    if (action === "save_invoice") {
      const invId = saveInvoice(ss, data.invoice);
      return sendJsonResponse({ status: "success", id: invId });
    }

    // 4. HAPUS INVOICE
    if (action === "delete_invoice") {
      deleteRowById(ss.getSheetByName(SHEET_INVOICES), "Invoice_ID", data.id);
      return sendJsonResponse({ status: "success", deletedId: data.id });
    }

    // 5. SIMPAN / UPDATE TRANSAKSI KEUANGAN
    if (action === "save_transaction") {
      const trxId = saveTransaction(ss, data.transaction);
      return sendJsonResponse({ status: "success", id: trxId });
    }

    // 6. HAPUS TRANSAKSI KEUANGAN
    if (action === "delete_transaction") {
      deleteRowById(ss.getSheetByName(SHEET_TRANSACTIONS), "Transaction_ID", data.id);
      return sendJsonResponse({ status: "success", deletedId: data.id });
    }

    return sendJsonResponse({ status: "error", message: "Action tidak dikenal: " + action });

  } catch (error) {
    return sendJsonResponse({ status: "error", message: error.toString() });
  }
}

function sendJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================================
// BUSINESS LOGIC: PROJECT TRACKER
// ==========================================================================

function updateProjectStatusFast(ss, projectId, paymentStatus, workStatus, status) {
  const sheet = ss.getSheetByName(SHEET_PROJECTS);
  const headerMap = getHeaderMap(sheet);
  const rows = sheet.getDataRange().getValues();
  const idCol = headerMap["ID"];

  if (!idCol) throw new Error("Kolom 'ID' tidak ditemukan di sheet Projects");

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol - 1]) === String(projectId)) {
      const rowNum = i + 1;
      if (headerMap["Payment_Status"]) sheet.getRange(rowNum, headerMap["Payment_Status"]).setValue(paymentStatus);
      if (headerMap["Work_Status"])    sheet.getRange(rowNum, headerMap["Work_Status"]).setValue(workStatus);
      if (headerMap["Status"])         sheet.getRange(rowNum, headerMap["Status"]).setValue(status);
      return { row: rowNum, id: projectId, paymentStatus: paymentStatus, workStatus: workStatus, status: status };
    }
  }
  throw new Error("Project ID tidak ditemukan: " + projectId);
}

function saveProjectComplete(ss, p, items) {
  const pSheet = ss.getSheetByName(SHEET_PROJECTS);
  const iSheet = ss.getSheetByName(SHEET_ITEMS);
  const pHeaderMap = getHeaderMap(pSheet);

  let totalSelling = 0;
  let totalCost = 0;
  items.forEach(function(it) {
    totalSelling += Number(it.Selling_Price || 0);
    totalCost += Number(it.Cost_Price || 0);
  });
  const totalProfit = totalSelling - totalCost;

  const pData = {
    "ID": p.ID,
    "Project_Name": p.Project_Name || "",
    "Client_Name": p.Client_Name || "",
    "Start_Date": p.Start_Date || "",
    "Deadline_Date": p.Deadline_Date || "",
    "Delivery_Date": p.Delivery_Date || "",
    "DP_Status": p.DP_Status || "Belum DP",
    "DP_Amount": Number(p.DP_Amount || 0),
    "Total_Nominal": totalSelling,
    "Total_Cost": totalCost,
    "Total_Profit": totalProfit,
    "Status": p.Status || "In Progress",
    "Payment_Status": p.Payment_Status || "Belum Lunas",
    "Work_Status": p.Work_Status || "Belum Selesai"
  };

  upsertRecord(pSheet, pHeaderMap, "ID", p.ID, pData);

  // Update Items: Hapus item lama untuk project ini lalu insert item baru
  deleteRowsByCondition(iSheet, "Project_ID", p.ID);
  const iHeaderMap = getHeaderMap(iSheet);

  items.forEach(function(it, idx) {
    const itProfit = Number(it.Selling_Price || 0) - Number(it.Cost_Price || 0);
    const itemData = {
      "Item_ID": it.Item_ID || ("ITM-" + Date.now() + "-" + (idx + 1)),
      "Project_ID": p.ID,
      "Item_Name": it.Item_Name || "",
      "Vendor_Name": it.Vendor_Name || "",
      "Cost_Price": Number(it.Cost_Price || 0),
      "Selling_Price": Number(it.Selling_Price || 0),
      "Sent_To_Vendor_Date": it.Sent_To_Vendor_Date || "",
      "Received_From_Vendor_Date": it.Received_From_Vendor_Date || "",
      "Item_Profit": itProfit
    };
    appendRecord(iSheet, iHeaderMap, itemData);
  });

  return p.ID;
}

// ==========================================================================
// BUSINESS LOGIC: INVOICING
// ==========================================================================

function saveInvoice(ss, inv) {
  const sheet = ss.getSheetByName(SHEET_INVOICES);
  const headerMap = getHeaderMap(sheet);

  const invId = inv.Invoice_ID || ("INV-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd") + "-" + Math.floor(100 + Math.random() * 900));
  
  const invData = {
    "Invoice_ID": invId,
    "Invoice_Number": inv.Invoice_Number || invId,
    "Project_ID": inv.Project_ID || "",
    "Project_Name": inv.Project_Name || "",
    "Client_Name": inv.Client_Name || "",
    "Client_Phone": inv.Client_Phone || "",
    "Client_Address": inv.Client_Address || "",
    "Invoice_Date": inv.Invoice_Date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd"),
    "Due_Date": inv.Due_Date || "",
    "Subtotal": Number(inv.Subtotal || 0),
    "Discount": Number(inv.Discount || 0),
    "Tax": Number(inv.Tax || 0),
    "Total_Amount": Number(inv.Total_Amount || 0),
    "DP_Paid": Number(inv.DP_Paid || 0),
    "Balance_Due": Number(inv.Balance_Due || 0),
    "Payment_Status": inv.Payment_Status || "Belum Lunas",
    "Notes": inv.Notes || "",
    "Items_JSON": typeof inv.Items_JSON === "string" ? inv.Items_JSON : JSON.stringify(inv.Items || [])
  };

  upsertRecord(sheet, headerMap, "Invoice_ID", invId, invData);
  return invId;
}

// ==========================================================================
// BUSINESS LOGIC: LAPORAN KEUANGAN & KAS
// ==========================================================================

function saveTransaction(ss, trx) {
  const sheet = ss.getSheetByName(SHEET_TRANSACTIONS);
  const headerMap = getHeaderMap(sheet);

  const trxId = trx.Transaction_ID || ("TRX-" + Date.now());

  const trxData = {
    "Transaction_ID": trxId,
    "Date": trx.Date || Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd"),
    "Type": trx.Type || "Pengeluaran", // "Pemasukan" atau "Pengeluaran"
    "Category": trx.Category || "Operasional",
    "Amount": Number(trx.Amount || 0),
    "Project_ID": trx.Project_ID || "",
    "Description": trx.Description || "",
    "Payment_Method": trx.Payment_Method || "Transfer Bank",
    "Created_At": trx.Created_At || new Date().toISOString()
  };

  upsertRecord(sheet, headerMap, "Transaction_ID", trxId, trxData);
  return trxId;
}

// ==========================================================================
// DATABASE HELPERS & DYNAMIC HEADER MAPPING
// ==========================================================================

function ensureSheetsSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const schemas = [
    {
      name: SHEET_PROJECTS,
      headers: ["ID", "Project_Name", "Client_Name", "Start_Date", "Deadline_Date", "Delivery_Date", "DP_Status", "DP_Amount", "Total_Nominal", "Total_Cost", "Total_Profit", "Status", "Payment_Status", "Work_Status"]
    },
    {
      name: SHEET_ITEMS,
      headers: ["Item_ID", "Project_ID", "Item_Name", "Vendor_Name", "Cost_Price", "Selling_Price", "Sent_To_Vendor_Date", "Received_From_Vendor_Date", "Item_Profit"]
    },
    {
      name: SHEET_INVOICES,
      headers: ["Invoice_ID", "Invoice_Number", "Project_ID", "Project_Name", "Client_Name", "Client_Phone", "Client_Address", "Invoice_Date", "Due_Date", "Subtotal", "Discount", "Tax", "Total_Amount", "DP_Paid", "Balance_Due", "Payment_Status", "Notes", "Items_JSON"]
    },
    {
      name: SHEET_TRANSACTIONS,
      headers: ["Transaction_ID", "Date", "Type", "Category", "Amount", "Project_ID", "Description", "Payment_Method", "Created_At"]
    }
  ];

  schemas.forEach(function(schema) {
    let sheet = ss.getSheetByName(schema.name);
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
      sheet.appendRow(schema.headers);
      sheet.getRange(1, 1, 1, schema.headers.length).setFontWeight("bold").setBackground("#2A2A2A").setFontColor("#F4F1EA");
    } else {
      // Pastikan semua kolom penting terdaftar di header row
      ensureHeadersExist(sheet, schema.headers);
    }
  });
}

function ensureHeadersExist(sheet, requiredHeaders) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  
  requiredHeaders.forEach(function(req) {
    if (existingHeaders.indexOf(req) === -1) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol).setValue(req).setFontWeight("bold").setBackground("#2A2A2A").setFontColor("#F4F1EA");
    }
  });
}

function getHeaderMap(sheet) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const headerValues = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};
  for (let i = 0; i < headerValues.length; i++) {
    const key = String(headerValues[i]).trim();
    if (key) {
      map[key] = i + 1; // 1-based index
    }
  }
  return map;
}

function getSheetObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0].map(function(h) { return String(h).trim(); });
  const results = [];

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    // Lewati baris kosong
    const isBlank = row.every(function(cell) { return cell === "" || cell === null; });
    if (isBlank) continue;

    const item = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      if (header) {
        let val = row[c];
        if (val instanceof Date) {
          val = val.toISOString();
        }
        item[header] = val;
      }
    }
    results.push(item);
  }
  return results;
}

function upsertRecord(sheet, headerMap, idField, idValue, dataObj) {
  const idCol = headerMap[idField];
  if (!idCol) throw new Error("Header " + idField + " tidak ditemukan.");

  const rows = sheet.getDataRange().getValues();
  let targetRowNum = -1;

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idCol - 1]) === String(idValue)) {
      targetRowNum = i + 1;
      break;
    }
  }

  if (targetRowNum > 0) {
    // UPDATE baris yang ada
    for (const key in dataObj) {
      if (headerMap[key]) {
        sheet.getRange(targetRowNum, headerMap[key]).setValue(dataObj[key]);
      }
    }
  } else {
    // APPEND baris baru
    appendRecord(sheet, headerMap, dataObj);
  }
}

function appendRecord(sheet, headerMap, dataObj) {
  const lastCol = sheet.getLastColumn();
  const newRow = new Array(lastCol).fill("");
  for (const key in dataObj) {
    if (headerMap[key]) {
      newRow[headerMap[key] - 1] = dataObj[key];
    }
  }
  sheet.appendRow(newRow);
}

function deleteRowById(sheet, idField, idValue) {
  if (!sheet) return;
  const headerMap = getHeaderMap(sheet);
  const idCol = headerMap[idField];
  if (!idCol) return;

  const data = sheet.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][idCol - 1]) === String(idValue)) {
      sheet.deleteRow(r + 1);
      return;
    }
  }
}

function deleteRowsByCondition(sheet, colField, colValue) {
  if (!sheet) return;
  const headerMap = getHeaderMap(sheet);
  const colIndex = headerMap[colField];
  if (!colIndex) return;

  const data = sheet.getDataRange().getValues();
  for (let r = data.length - 1; r >= 1; r--) {
    if (String(data[r][colIndex - 1]) === String(colValue)) {
      sheet.deleteRow(r + 1);
    }
  }
}
