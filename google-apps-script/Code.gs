/**
 * 플릭핏(FleekFit) v2 멀티유저 Google Sheets 동기화용 Apps Script 코드
 *
 * 업데이트/재배포 방법:
 * 1. 내 구글 시트 -> [확장 프로그램] -> [Apps Script] 열기
 * 2. 기존 코드를 모두 지우고 이 파일 전체 내용을 붙여넣기 후 저장(Ctrl+S)
 * 3. 오른쪽 위 [배포] -> [배포 관리] 클릭
 * 4. 연필(수정) 아이콘 클릭 -> 버전에서 [새 버전] 선택 -> [배포] 클릭!
 *    (※ 처음 배포하는 경우라면 [배포] -> [새 배포] -> 웹 앱 -> 액세스 권한: 모든 사용자)
 */

const SHEET_USERS = "Users";
const SHEET_WORKOUTS = "Workouts";
const SHEET_ROUTINES = "Routines";
const SHEET_SET_LOGS = "SetLogs";
const SHEET_SUPP_ITEMS = "SupplementItems";
const SHEET_SUPP_LOGS = "SupplementLogs";
const SHEET_INBODY = "InBody";

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action || "ping";
    if (action === "ping") {
      ensureAllSheets_();
      return jsonResponse_({
        ok: true,
        version: 2,
        message: "플릭핏 v2 멀티유저 구글 시트 연결이 정상입니다.",
        serverTime: new Date().toISOString()
      });
    }
    return jsonResponse_({ ok: false, error: "알 수 없는 GET 요청입니다: " + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    ensureAllSheets_();
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    const action = body.action || "";

    if (action === "register") {
      return handleRegister_(body);
    }
    if (action === "login") {
      return handleLogin_(body);
    }
    if (action === "sync") {
      return handleSync_(body);
    }

    return jsonResponse_({ ok: false, error: "지원하지 않는 POST action입니다: " + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function normalizeNick_(nickname) {
  return String(nickname || "").trim().toLowerCase();
}

function validateCreds_(nickname, pin) {
  const cleanNick = String(nickname || "").trim();
  const cleanPin = String(pin || "").trim();
  if (cleanNick.length < 2 || cleanNick.length > 12) {
    throw new Error("닉네임은 2~12자로 입력해 주세요.");
  }
  if (!/^\d{4}$/.test(cleanPin)) {
    throw new Error("PIN은 숫자 4자리여야 합니다.");
  }
  return { nickname: cleanNick, nicknameKey: normalizeNick_(cleanNick), pin: cleanPin };
}

function findUser_(nicknameKey) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1] || "").trim().toLowerCase() === nicknameKey) {
      return {
        nickname: String(rows[i][0] || ""),
        nicknameKey: String(rows[i][1] || "").trim().toLowerCase(),
        pin: String(rows[i][2] || "").padStart(4, "0")
      };
    }
  }
  return null;
}

function handleRegister_(body) {
  const creds = validateCreds_(body.nickname, body.pin);
  if (findUser_(creds.nicknameKey)) {
    return jsonResponse_({
      ok: false,
      error: "이미 사용 중인 닉네임입니다. 다른 닉네임을 쓰거나 [기존 사용자로 로그인]을 이용해 주세요."
    });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_USERS);
  const nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 3).setNumberFormat("@");
  sheet.getRange(nextRow, 1, 1, 4).setValues([
    [creds.nickname, creds.nicknameKey, String(creds.pin), new Date().toISOString()]
  ]);

  return jsonResponse_({ ok: true, nickname: creds.nickname });
}

function handleLogin_(body) {
  const creds = validateCreds_(body.nickname, body.pin);
  const user = findUser_(creds.nicknameKey);
  if (!user || user.pin !== creds.pin) {
    return jsonResponse_({ ok: false, error: "닉네임 또는 4자리 PIN이 일치하지 않습니다." });
  }

  return jsonResponse_({
    ok: true,
    nickname: user.nickname,
    workouts: readUserRows_(SHEET_WORKOUTS, creds.nicknameKey, parseWorkoutRow_),
    routines: readUserRows_(SHEET_ROUTINES, creds.nicknameKey, parseRoutineRow_),
    supplementItems: readUserRows_(SHEET_SUPP_ITEMS, creds.nicknameKey, parseSuppItemRow_),
    supplementLogs: readUserRows_(SHEET_SUPP_LOGS, creds.nicknameKey, parseSuppLogRow_),
    inbodyRecords: readUserRows_(SHEET_INBODY, creds.nicknameKey, parseInBodyRow_)
  });
}

function handleSync_(body) {
  const creds = validateCreds_(body.nickname, body.pin);
  const user = findUser_(creds.nicknameKey);
  if (!user || user.pin !== creds.pin) {
    return jsonResponse_({ ok: false, error: "인증에 실패했습니다. 다시 로그인해 주세요." });
  }

  const workouts = syncTableForUser_(
    SHEET_WORKOUTS,
    creds.nicknameKey,
    body.workouts || [],
    parseWorkoutRow_,
    serializeWorkoutRow_,
    ["nicknameKey", "id", "date", "title", "routineId", "durationSec", "totalVolume", "totalSets", "exercisesJson", "updatedAt", "deleted"]
  );
  const routines = syncTableForUser_(
    SHEET_ROUTINES,
    creds.nicknameKey,
    body.routines || [],
    parseRoutineRow_,
    serializeRoutineRow_,
    ["nicknameKey", "id", "name", "split", "description", "exercisesJson", "isDefault", "updatedAt", "deleted"]
  );
  const supplementItems = syncTableForUser_(
    SHEET_SUPP_ITEMS,
    creds.nicknameKey,
    body.supplementItems || [],
    parseSuppItemRow_,
    serializeSuppItemRow_,
    ["nicknameKey", "id", "name", "timeHint", "isDefault", "updatedAt", "deleted"]
  );
  const supplementLogs = syncTableForUser_(
    SHEET_SUPP_LOGS,
    creds.nicknameKey,
    body.supplementLogs || [],
    parseSuppLogRow_,
    serializeSuppLogRow_,
    ["nicknameKey", "id", "date", "checkedIdsJson", "updatedAt", "deleted"]
  );
  const inbodyRecords = syncTableForUser_(
    SHEET_INBODY,
    creds.nicknameKey,
    body.inbodyRecords || [],
    parseInBodyRow_,
    serializeInBodyRow_,
    ["nicknameKey", "id", "date", "weightKg", "muscleMassKg", "bodyFatPct", "memo", "updatedAt", "deleted"]
  );

  rebuildSetLogsSheet_();

  return jsonResponse_({
    ok: true,
    workouts: workouts,
    routines: routines,
    supplementItems: supplementItems,
    supplementLogs: supplementLogs,
    inbodyRecords: inbodyRecords,
    syncedAt: new Date().toISOString()
  });
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ensureAllSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_USERS, ["nickname", "nicknameKey", "pin", "createdAt"], false);
  ensureSheet_(ss, SHEET_WORKOUTS, ["nicknameKey", "id", "date", "title", "routineId", "durationSec", "totalVolume", "totalSets", "exercisesJson", "updatedAt", "deleted"], true);
  ensureSheet_(ss, SHEET_ROUTINES, ["nicknameKey", "id", "name", "split", "description", "exercisesJson", "isDefault", "updatedAt", "deleted"], true);
  ensureSheet_(ss, SHEET_SUPP_ITEMS, ["nicknameKey", "id", "name", "timeHint", "isDefault", "updatedAt", "deleted"], true);
  ensureSheet_(ss, SHEET_SUPP_LOGS, ["nicknameKey", "id", "date", "checkedIdsJson", "updatedAt", "deleted"], true);
  ensureSheet_(ss, SHEET_INBODY, ["nicknameKey", "id", "date", "weightKg", "muscleMassKg", "bodyFatPct", "memo", "updatedAt", "deleted"], true);
  ensureSheet_(ss, SHEET_SET_LOGS, ["nicknameKey", "workoutId", "date", "workoutTitle", "exerciseName", "muscleGroup", "setType", "setNumber", "weightKg", "reps", "durationSec", "volume", "est1RM"], false);
}

function ensureSheet_(ss, name, headers, migrateV1) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    return sheet;
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  if (migrateV1 && String(sheet.getRange(1, 1).getValue()) === "id") {
    sheet.insertColumnBefore(1);
    sheet.getRange(1, 1).setValue("nicknameKey");
  }
  return sheet;
}

function readAllParsed_(sheetName, parser) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const item = parser(values[i]);
    if (item && item.id) out.push(item);
  }
  return out;
}

function readUserRows_(sheetName, nicknameKey, parser) {
  return readAllParsed_(sheetName, parser).filter(function (item) {
    return item.nicknameKey === nicknameKey;
  });
}

function syncTableForUser_(sheetName, nicknameKey, incomingItems, parser, serializer, headers) {
  const all = readAllParsed_(sheetName, parser);
  const others = [];
  const mineMap = {};

  for (let i = 0; i < all.length; i++) {
    const row = all[i];
    if (row.nicknameKey === nicknameKey) {
      mineMap[row.id] = row;
    } else {
      others.push(row);
    }
  }

  for (let j = 0; j < incomingItems.length; j++) {
    const inc = incomingItems[j];
    if (!inc || !inc.id) continue;
    inc.nicknameKey = nicknameKey;
    const prev = mineMap[inc.id];
    const prevTs = prev && prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
    const nextTs = inc.updatedAt ? Date.parse(inc.updatedAt) || 0 : 0;
    if (!prev || nextTs >= prevTs) {
      mineMap[inc.id] = inc;
    }
  }

  const mineMerged = Object.keys(mineMap).map(function (k) { return mineMap[k]; });
  const combined = others.concat(mineMerged);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (combined.length > 0) {
    const rows = combined.map(serializer);
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  return mineMerged;
}

function safeJson_(val, fallback) {
  try { return val ? JSON.parse(val) : fallback; } catch (e) { return fallback; }
}

function toBool_(val) {
  return val === true || String(val).toLowerCase() === "true";
}

function parseWorkoutRow_(r) {
  if (!r[1]) return null;
  return {
    nicknameKey: String(r[0] || "").trim().toLowerCase(),
    id: String(r[1]),
    date: String(r[2] || ""),
    title: String(r[3] || ""),
    routineId: r[4] ? String(r[4]) : null,
    durationSec: Number(r[5]) || 0,
    totalVolume: Number(r[6]) || 0,
    totalSets: Number(r[7]) || 0,
    exercises: safeJson_(r[8], []),
    updatedAt: String(r[9] || ""),
    deleted: toBool_(r[10])
  };
}

function serializeWorkoutRow_(w) {
  return [
    w.nicknameKey || "",
    w.id,
    w.date || "",
    w.title || "",
    w.routineId || "",
    Number(w.durationSec) || 0,
    Number(w.totalVolume) || 0,
    Number(w.totalSets) || 0,
    JSON.stringify(w.exercises || []),
    w.updatedAt || new Date().toISOString(),
    Boolean(w.deleted)
  ];
}

function parseRoutineRow_(r) {
  if (!r[1]) return null;
  return {
    nicknameKey: String(r[0] || "").trim().toLowerCase(),
    id: String(r[1]),
    name: String(r[2] || ""),
    split: String(r[3] || "커스텀"),
    description: String(r[4] || ""),
    exercises: safeJson_(r[5], []),
    isDefault: toBool_(r[6]),
    updatedAt: String(r[7] || ""),
    deleted: toBool_(r[8])
  };
}

function serializeRoutineRow_(rt) {
  return [
    rt.nicknameKey || "",
    rt.id,
    rt.name || "",
    rt.split || "커스텀",
    rt.description || "",
    JSON.stringify(rt.exercises || []),
    Boolean(rt.isDefault),
    rt.updatedAt || new Date().toISOString(),
    Boolean(rt.deleted)
  ];
}

function parseSuppItemRow_(r) {
  if (!r[1]) return null;
  return {
    nicknameKey: String(r[0] || "").trim().toLowerCase(),
    id: String(r[1]),
    name: String(r[2] || ""),
    timeHint: String(r[3] || ""),
    isDefault: toBool_(r[4]),
    updatedAt: String(r[5] || ""),
    deleted: toBool_(r[6])
  };
}

function serializeSuppItemRow_(item) {
  return [
    item.nicknameKey || "",
    item.id,
    item.name || "",
    item.timeHint || "",
    Boolean(item.isDefault),
    item.updatedAt || new Date().toISOString(),
    Boolean(item.deleted)
  ];
}

function parseSuppLogRow_(r) {
  if (!r[1]) return null;
  return {
    nicknameKey: String(r[0] || "").trim().toLowerCase(),
    id: String(r[1]),
    date: String(r[2] || ""),
    checkedIds: safeJson_(r[3], []),
    updatedAt: String(r[4] || ""),
    deleted: toBool_(r[5])
  };
}

function serializeSuppLogRow_(log) {
  return [
    log.nicknameKey || "",
    log.id,
    log.date || "",
    JSON.stringify(log.checkedIds || []),
    log.updatedAt || new Date().toISOString(),
    Boolean(log.deleted)
  ];
}

function parseInBodyRow_(r) {
  if (!r[1]) return null;
  return {
    nicknameKey: String(r[0] || "").trim().toLowerCase(),
    id: String(r[1]),
    date: String(r[2] || ""),
    weightKg: r[3] === "" || r[3] === null ? null : Number(r[3]),
    muscleMassKg: r[4] === "" || r[4] === null ? null : Number(r[4]),
    bodyFatPct: r[5] === "" || r[5] === null ? null : Number(r[5]),
    memo: String(r[6] || ""),
    updatedAt: String(r[7] || ""),
    deleted: toBool_(r[8])
  };
}

function serializeInBodyRow_(rec) {
  return [
    rec.nicknameKey || "",
    rec.id,
    rec.date || "",
    rec.weightKg === null || rec.weightKg === undefined ? "" : Number(rec.weightKg),
    rec.muscleMassKg === null || rec.muscleMassKg === undefined ? "" : Number(rec.muscleMassKg),
    rec.bodyFatPct === null || rec.bodyFatPct === undefined ? "" : Number(rec.bodyFatPct),
    rec.memo || "",
    rec.updatedAt || new Date().toISOString(),
    Boolean(rec.deleted)
  ];
}

function rebuildSetLogsSheet_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SET_LOGS);
  const headers = ["nicknameKey", "workoutId", "date", "workoutTitle", "exerciseName", "muscleGroup", "setType", "setNumber", "weightKg", "reps", "durationSec", "volume", "est1RM"];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const active = readAllParsed_(SHEET_WORKOUTS, parseWorkoutRow_).filter(function (w) { return !w.deleted; });
  active.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });

  const rows = [];
  for (let i = 0; i < active.length; i++) {
    const w = active[i];
    const exList = w.exercises || [];
    for (let j = 0; j < exList.length; j++) {
      const ex = exList[j];
      const sets = ex.sets || [];
      for (let k = 0; k < sets.length; k++) {
        const s = sets[k];
        if (!s.completed) continue;
        const setType = s.setType || "normal";
        const weight = Number(s.weight) || 0;
        const reps = Number(s.reps) || 0;
        const dur = Number(s.durationSec) || 0;
        const isWarmup = setType === "warmup";
        const vol = isWarmup ? 0 : Math.round(weight * reps * 10) / 10;
        const est1rm = isWarmup || weight <= 0 || reps <= 0
          ? 0
          : (reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10);
        rows.push([
          w.nicknameKey || "",
          w.id,
          w.date || "",
          w.title || "",
          ex.name || "",
          ex.muscle || "",
          setType,
          k + 1,
          weight,
          reps,
          dur,
          vol,
          est1rm
        ]);
      }
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}
