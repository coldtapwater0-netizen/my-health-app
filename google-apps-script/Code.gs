/**
 * 플릭핏(FleekFit) Google Sheets 동기화용 Apps Script 코드
 *
 * 사용 방법:
 * 1. 내 구글 드라이브에서 새 구글 스프레드시트 만들기
 * 2. 상단 메뉴 [확장 프로그램] -> [Apps Script] 클릭
 * 3. 기존 코드를 모두 지우고 이 파일 내용을 그대로 붙여넣기
 * 4. [배포] -> [새 배포] -> 유형: [웹 앱]
 *    - 다음 사용자 권한으로 실행: 나
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 5. 발급된 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 앱 [설정] 탭에 입력!
 */

// (선택사항) 보안을 강화하고 싶다면 원하는 비밀번호를 적고, 앱 설정에도 똑같이 입력하세요.
// 빈 문자열("")로 두면 비밀번호 없이 바로 연결됩니다.
const SECRET_KEY = "";

const SHEET_WORKOUTS = "Workouts";
const SHEET_ROUTINES = "Routines";
const SHEET_SET_LOGS = "SetLogs";

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    verifySecret_(params.secret);

    const action = params.action || "ping";
    if (action === "ping") {
      ensureSheets_();
      return jsonResponse_({
        ok: true,
        message: "구글 시트 Apps Script 연결이 정상입니다.",
        serverTime: new Date().toISOString()
      });
    }

    if (action === "getAll") {
      ensureSheets_();
      return jsonResponse_({
        ok: true,
        workouts: readTable_(SHEET_WORKOUTS, parseWorkoutRow_),
        routines: readTable_(SHEET_ROUTINES, parseRoutineRow_)
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
    ensureSheets_();
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const body = JSON.parse(raw);
    verifySecret_(body.secret);

    if (body.action !== "sync") {
      return jsonResponse_({ ok: false, error: "지원하지 않는 POST action입니다." });
    }

    const existingWorkouts = readTable_(SHEET_WORKOUTS, parseWorkoutRow_);
    const existingRoutines = readTable_(SHEET_ROUTINES, parseRoutineRow_);

    const mergedWorkouts = mergeByUpdatedAt_(existingWorkouts, body.workouts || []);
    const mergedRoutines = mergeByUpdatedAt_(existingRoutines, body.routines || []);

    writeWorkoutsSheet_(mergedWorkouts);
    writeRoutinesSheet_(mergedRoutines);
    rebuildSetLogsSheet_(mergedWorkouts);

    return jsonResponse_({
      ok: true,
      workouts: mergedWorkouts,
      routines: mergedRoutines,
      syncedAt: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function verifySecret_(incoming) {
  if (!SECRET_KEY) return;
  if ((incoming || "") !== SECRET_KEY) {
    throw new Error("보안 키가 일치하지 않습니다. 설정 탭의 보안 키를 확인해 주세요.");
  }
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function ensureSheets_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheetWithHeaders_(ss, SHEET_WORKOUTS, [
    "id", "date", "title", "routineId", "durationSec", "totalVolume", "totalSets", "exercisesJson", "updatedAt", "deleted"
  ]);
  ensureSheetWithHeaders_(ss, SHEET_ROUTINES, [
    "id", "name", "split", "description", "exercisesJson", "isDefault", "updatedAt", "deleted"
  ]);
  ensureSheetWithHeaders_(ss, SHEET_SET_LOGS, [
    "workoutId", "date", "workoutTitle", "exerciseName", "muscleGroup", "setNumber", "weightKg", "reps", "volume", "est1RM"
  ]);
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readTable_(sheetName, rowParser) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const items = [];
  for (let i = 0; i < values.length; i++) {
    const parsed = rowParser(values[i]);
    if (parsed && parsed.id) items.push(parsed);
  }
  return items;
}

function parseWorkoutRow_(row) {
  if (!row[0]) return null;
  let exercises = [];
  try {
    exercises = row[7] ? JSON.parse(row[7]) : [];
  } catch (e) {
    exercises = [];
  }
  return {
    id: String(row[0]),
    date: String(row[1] || ""),
    title: String(row[2] || ""),
    routineId: row[3] ? String(row[3]) : null,
    durationSec: Number(row[4]) || 0,
    totalVolume: Number(row[5]) || 0,
    totalSets: Number(row[6]) || 0,
    exercises: exercises,
    updatedAt: String(row[8] || ""),
    deleted: row[9] === true || String(row[9]).toLowerCase() === "true"
  };
}

function parseRoutineRow_(row) {
  if (!row[0]) return null;
  let exercises = [];
  try {
    exercises = row[4] ? JSON.parse(row[4]) : [];
  } catch (e) {
    exercises = [];
  }
  return {
    id: String(row[0]),
    name: String(row[1] || ""),
    split: String(row[2] || "커스텀"),
    description: String(row[3] || ""),
    exercises: exercises,
    isDefault: row[5] === true || String(row[5]).toLowerCase() === "true",
    updatedAt: String(row[6] || ""),
    deleted: row[7] === true || String(row[7]).toLowerCase() === "true"
  };
}

function mergeByUpdatedAt_(existing, incoming) {
  const map = {};
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] && existing[i].id) map[existing[i].id] = existing[i];
  }
  for (let j = 0; j < incoming.length; j++) {
    const item = incoming[j];
    if (!item || !item.id) continue;
    const prev = map[item.id];
    const prevTs = prev && prev.updatedAt ? Date.parse(prev.updatedAt) || 0 : 0;
    const nextTs = item.updatedAt ? Date.parse(item.updatedAt) || 0 : 0;
    if (!prev || nextTs >= prevTs) {
      map[item.id] = item;
    }
  }
  return Object.keys(map).map(function (k) { return map[k]; });
}

function writeWorkoutsSheet_(workouts) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_WORKOUTS);
  const headers = ["id", "date", "title", "routineId", "durationSec", "totalVolume", "totalSets", "exercisesJson", "updatedAt", "deleted"];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!workouts.length) return;

  const rows = workouts.map(function (w) {
    return [
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
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function writeRoutinesSheet_(routines) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ROUTINES);
  const headers = ["id", "name", "split", "description", "exercisesJson", "isDefault", "updatedAt", "deleted"];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!routines.length) return;

  const rows = routines.map(function (r) {
    return [
      r.id,
      r.name || "",
      r.split || "커스텀",
      r.description || "",
      JSON.stringify(r.exercises || []),
      Boolean(r.isDefault),
      r.updatedAt || new Date().toISOString(),
      Boolean(r.deleted)
    ];
  });
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function rebuildSetLogsSheet_(workouts) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SET_LOGS);
  const headers = ["workoutId", "date", "workoutTitle", "exerciseName", "muscleGroup", "setNumber", "weightKg", "reps", "volume", "est1RM"];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const rows = [];
  const active = workouts.filter(function (w) { return !w.deleted; });
  active.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")); });

  for (let i = 0; i < active.length; i++) {
    const w = active[i];
    const exList = w.exercises || [];
    for (let j = 0; j < exList.length; j++) {
      const ex = exList[j];
      const sets = ex.sets || [];
      for (let k = 0; k < sets.length; k++) {
        const s = sets[k];
        if (!s.completed) continue;
        const weight = Number(s.weight) || 0;
        const reps = Number(s.reps) || 0;
        const vol = Math.round(weight * reps * 10) / 10;
        const est1rm = weight > 0 && reps > 0
          ? (reps === 1 ? weight : Math.round(weight * (1 + reps / 30) * 10) / 10)
          : 0;
        rows.push([
          w.id,
          w.date || "",
          w.title || "",
          ex.name || "",
          ex.muscle || "",
          k + 1,
          weight,
          reps,
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
