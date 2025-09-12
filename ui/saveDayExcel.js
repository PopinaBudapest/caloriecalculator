// /ui/saveDayExcel.js
// Overwrite the selected Excel file in-place (Chrome/Edge with File System Access API).
// Fallback (other browsers): downloads an updated copy.

const XLSX_CDN =
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

// ---- SheetJS loader ----
function ensureXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = XLSX_CDN;
    s.onload = res;
    s.onerror = () => rej(new Error("Failed to load SheetJS"));
    document.head.appendChild(s);
  });
}

// ---- Daily summary helpers ----
function n1(x) {
  return Math.round((+x || 0) * 10) / 10;
}
function getNum(sel) {
  const t = document.querySelector(sel)?.textContent || "0";
  return parseFloat(t.replace(/[^\d.-]/g, "")) || 0;
}
function summaryRowForToday() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return [
    today,
    Math.round(getNum("#sum-kcal")),
    n1(getNum("#sum-protein")),
    n1(getNum("#sum-fat")),
    n1(getNum("#sum-satfat")),
    n1(getNum("#sum-carbs")),
    n1(getNum("#sum-sugar")),
    n1(getNum("#sum-fiber")),
    n1(getNum("#sum-salt")),
  ];
}

const SUMMARY_HEADERS = [
  "Date",
  "Kcal",
  "Protein",
  "Fat",
  "Sat fat",
  "Carb",
  "Sugar",
  "Fiber",
  "Salt",
];

// ---- File picking helpers ----
async function pickExcelHandle() {
  // Modern API: pick and overwrite in place
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: true,
      types: [
        {
          description: "Excel files",
          accept: {
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
              [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
          },
        },
      ],
    });

    // Ask for read/write permission
    const perm = await handle.queryPermission?.({ mode: "readwrite" });
    if (perm !== "granted") {
      const req = await handle.requestPermission?.({ mode: "readwrite" });
      if (req !== "granted") throw new Error("Write permission denied.");
    }
    return { handle };
  }

  // Fallback: traditional file input (read-only; we'll download an updated copy)
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = () => {
      const file = input.files?.[0] || null;
      resolve({ file });
      input.remove();
    };
    input.click();
  });
}

function downloadBlob(blob, suggestedName = "updated.xlsx") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

// ---- Core: open, modify, save ----
async function appendSummaryToWorkbook(arrayBuffer) {
  await ensureXLSX();
  let wb;
  try {
    wb = XLSX.read(arrayBuffer, { type: "array" });
  } catch {
    // If unreadable, create a blank workbook
    wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Sheet1");
  }

  const sheetName = wb.SheetNames[0] || "Sheet1";
  if (!wb.Sheets[sheetName]) {
    wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet([]);
    if (!wb.SheetNames.length) wb.SheetNames.push(sheetName);
    else wb.SheetNames[0] = sheetName;
  }

  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Ensure header row
  if (aoa.length === 0) {
    aoa.push(SUMMARY_HEADERS);
  } else {
    aoa[0] = SUMMARY_HEADERS; // normalize header names/order
  }

  // Insert today's summary at row 2 (index 1), pushing existing rows down
  aoa.splice(1, 0, summaryRowForToday());

  wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(aoa);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ---- Public init ----
export function initSaveDayExcel() {
  const hdr = document.querySelector(".card__head--summary");
  if (!hdr) return;

  // Make sure the header lays out nicely
  hdr.style.display = "flex";
  hdr.style.alignItems = "center";
  hdr.style.gap = "12px";

  // Create green "Save day" button if it doesn't exist
  let btn = document.getElementById("saveDayBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "saveDayBtn";
    btn.className = "btn btn-success";
    btn.textContent = "Save day";

    // Place it on the LEFT, right after the title
    const title = hdr.querySelector("h3");
    if (title) title.insertAdjacentElement("afterend", btn);
    else hdr.prepend(btn);
  }

  // Push Reset day to the far right
  const reset = document.getElementById("resetBtn");
  if (reset) reset.style.marginLeft = "auto";

  // Click handler
  btn.addEventListener("click", async () => {
    try {
      const picked = await pickExcelHandle();

      if (picked.handle) {
        // Read → modify → overwrite the same file
        const file = await picked.handle.getFile();
        const buf = await file.arrayBuffer();
        const newBlob = await appendSummaryToWorkbook(buf);

        const writable = await picked.handle.createWritable();
        await writable.write(newBlob);
        await writable.close();

        btn.textContent = "Saved!";
        setTimeout(() => (btn.textContent = "Save day"), 1200);
      } else if (picked.file) {
        // Fallback: read and download updated copy
        const buf = await picked.file.arrayBuffer();
        const newBlob = await appendSummaryToWorkbook(buf);
        const suggested =
          picked.file.name.replace(/\.xls(x)?$/i, "") + ".xlsx";
        downloadBlob(newBlob, suggested);
      }
    } catch (err) {
      console.error(err);
      alert(
        "Could not overwrite the file. (Tip: use Chrome/Edge to enable in-place saving.)"
      );
    }
  });
}
