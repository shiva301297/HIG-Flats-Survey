// ══════════════════════════════════════════════════════════════════
//  HIG Flats Adyar — Redevelopment Survey
//  Google Apps Script v2 — Form POST + Duplicate Check + Dashboard GET
//  Sheet ID: 1JnLKice3F7HYkyElytoaGHEjgYsFaCyb3-H665tcz2w
// ══════════════════════════════════════════════════════════════════

const SHEET_ID   = '1JnLKice3F7HYkyElytoaGHEjgYsFaCyb3-H665tcz2w';
const SHEET_NAME = 'Responses';

const HEADERS = [
  'Timestamp','Owner Name','Mobile','Email','Block','Flat Number','Flat ID',
  'Q1 — Post-Redevelopment Utilisation','Q2 — Flat Purpose',
  'Q3 — Preferred Sq.Ft.','Q4 — BHK Preference',
  'Q5 — Car Parking Slots','Q5 — Bike Parking Slots',
  'Q6 — Greenery Preference','Q7 — Physical Infrastructure',
  'Q8 — Social Infrastructure','Q9 — Building Height',
  'Q10 — New Members Willing to Add','Q11 — Transit Accommodation',
  'Q12 — Min. Rent Allowance (₹)','Q13 — Developer Criteria (up to 2)',
  'Q14 — Acceptable Timeline','Q15 — Redevelopment Support (1–5)',
  'Open Feedback'
];

const KEYS = [
  'timestamp','owner_name','mobile','email','block','flat_number','flat_id',
  'q1_utilisation','q2_purpose','q3_sqft_preference','q4_bhk_preference',
  'q5_car_slots','q5_bike_slots','q6_greenery','q7_physical_infra',
  'q8_social_infra','q9_building_height','q10_new_members','q11_transit_pref',
  'q12_rent_allowance','q13_developer_criteria','q14_timeline',
  'q15_support_level','feedback'
];

// ══════════════════════════════════════════════════════════════════
//  doGet — handles duplicate check AND dashboard data
// ══════════════════════════════════════════════════════════════════
function doGet(e) {
  const action = e.parameter.action || '';

  // ── 1. Duplicate check ──
  if (action === 'checkDuplicate') {
    const flatId = (e.parameter.flat_id || '').trim().toUpperCase();
    const mobile = (e.parameter.mobile || '').trim();
    const sheet  = getOrCreateSheet();
    const data   = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      const rowFlatId = (data[i][6] || '').toString().trim().toUpperCase();  // col G = Flat ID
      const rowMobile = (data[i][2] || '').toString().trim();               // col C = Mobile

      if (rowFlatId === flatId) {
        return json({ duplicate: true, type: 'flat', existing_flat: rowFlatId });
      }
      if (rowMobile === mobile && mobile !== '') {
        return json({ duplicate: true, type: 'mobile', existing_flat: rowFlatId });
      }
    }
    return json({ duplicate: false });
  }

  // ── 2. Dashboard data ──
  if (action === 'getDashboard') {
    const sheet  = getOrCreateSheet();
    const data   = sheet.getDataRange().getValues();
    if (data.length <= 1) return json({ rows: [] });

    const headers = data[0];
    const rows = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return json({ rows, total: 138, responded: rows.length });
  }

  // ── Default health check ──
  return ContentService.createTextOutput('HIG Flats Survey Apps Script v2 — Live ✓')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ══════════════════════════════════════════════════════════════════
//  doPost — receives form submission and appends to sheet
// ══════════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const data  = JSON.parse(e.postData.contents);
    const sheet = getOrCreateSheet();

    // Final duplicate guard on write (safety net)
    const existing = sheet.getDataRange().getValues();
    for (let i = 1; i < existing.length; i++) {
      if ((existing[i][6]||'').toString().trim().toUpperCase() ===
          (data.flat_id||'').trim().toUpperCase()) {
        return json({ status: 'duplicate', message: 'Flat already submitted' });
      }
    }

    const row = KEYS.map(k => {
      let val = data[k] || '—';
      // Remap timeline values to unambiguous strings
      // to prevent Google Sheets auto-converting "2-3", "3-4" into dates
      if (k === 'q14_timeline') {
        const tlMap = {'<2':'LT2YR','2-3':'2TO3YR','3-4':'3TO4YR','>4':'GT4YR'};
        val = tlMap[val] || val;
      }
      return val;
    });
    sheet.appendRow(row);
    if (sheet.getLastRow() <= 2) sheet.autoResizeColumns(1, HEADERS.length);

    return json({ status: 'ok', flat: data.flat_id });
  } catch(err) {
    return json({ status: 'error', message: err.message });
  }
}

// ══════════════════════════════════════════════════════════════════
//  Helpers
// ══════════════════════════════════════════════════════════════════
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet() {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  let sheet   = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    const hr = sheet.getRange(1, 1, 1, HEADERS.length);
    hr.setBackground('#1c2b3a').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(11);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
