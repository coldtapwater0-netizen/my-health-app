import {
  DEFAULT_ROUTINES,
  DEFAULT_SCRIPT_URL,
  DEFAULT_SUPPLEMENTS,
  EXERCISE_CATALOG,
  calcEst1RM,
  createDemoInBody,
  createDemoSupplementLogs,
  createDemoWorkouts,
  toLocalDateStr
} from './data.js';

const GLOBAL_KEYS = {
  SESSION: 'fleekfit_session_v2',
  SETTINGS: 'fleekfit_global_settings_v2'
};

export const DEFAULT_SETTINGS = {
  theme: 'dark', // 'dark' | 'light' | 'system'
  scriptUrl: DEFAULT_SCRIPT_URL,
  autoSync: true,
  defaultRestSec: 90,
  autoStartRest: true,
  timerSound: true
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getUserScope() {
  const session = getSession();
  const nick = session?.nickname ? session.nickname.trim().toLowerCase() : 'guest';
  return `fleekfit_v2_${encodeURIComponent(nick)}`;
}

function userKey(suffix) {
  return `${getUserScope()}_${suffix}`;
}

// ===== 세션 & 전역 설정 =====
export function getSession() {
  return readJSON(GLOBAL_KEYS.SESSION, null);
}

export function setSession(session) {
  writeJSON(GLOBAL_KEYS.SESSION, session);
}

export function clearSession() {
  localStorage.removeItem(GLOBAL_KEYS.SESSION);
}

export function getSettings() {
  const saved = readJSON(GLOBAL_KEYS.SETTINGS, {});
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    scriptUrl: saved.scriptUrl || DEFAULT_SCRIPT_URL
  };
}

export function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  writeJSON(GLOBAL_KEYS.SETTINGS, next);
  return next;
}

export function initUserStorage(nickname, { seedDemo = false } = {}) {
  const scope = `fleekfit_v2_${encodeURIComponent(nickname.trim().toLowerCase())}`;
  const k = (s) => `${scope}_${s}`;

  if (localStorage.getItem(k('routines')) === null) {
    writeJSON(k('routines'), DEFAULT_ROUTINES);
  }
  if (localStorage.getItem(k('supp_items')) === null) {
    writeJSON(k('supp_items'), DEFAULT_SUPPLEMENTS);
  }
  if (localStorage.getItem(k('workouts')) === null) {
    writeJSON(k('workouts'), seedDemo ? createDemoWorkouts() : []);
  }
  if (localStorage.getItem(k('supp_logs')) === null) {
    writeJSON(k('supp_logs'), seedDemo ? createDemoSupplementLogs() : []);
  }
  if (localStorage.getItem(k('inbody')) === null) {
    writeJSON(k('inbody'), seedDemo ? createDemoInBody() : []);
  }
}

// ===== 운동 기록 =====
export function getAllWorkoutsRaw() {
  return readJSON(userKey('workouts'), []);
}

export function getActiveWorkouts() {
  return getAllWorkoutsRaw()
    .filter((w) => !w.deleted)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function saveAllWorkoutsRaw(workouts) {
  writeJSON(userKey('workouts'), workouts);
}

export function upsertWorkout(workout) {
  const list = getAllWorkoutsRaw();
  const idx = list.findIndex((item) => item.id === workout.id);
  const next = {
    ...workout,
    updatedAt: workout.updatedAt || new Date().toISOString(),
    deleted: Boolean(workout.deleted)
  };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  saveAllWorkoutsRaw(list);
  return next;
}

export function softDeleteWorkout(id) {
  const list = getAllWorkoutsRaw();
  const idx = list.findIndex((item) => item.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], deleted: true, updatedAt: new Date().toISOString() };
    saveAllWorkoutsRaw(list);
  }
}

export function clearDemoWorkouts() {
  saveAllWorkoutsRaw(getAllWorkoutsRaw().filter((w) => !w.isDemo));
  saveAllSupplementLogsRaw(getAllSupplementLogsRaw().filter((l) => !l.isDemo));
  saveAllInBodyRaw(getAllInBodyRaw().filter((r) => !r.isDemo));
}

// ===== 루틴 =====
export function getAllRoutinesRaw() {
  return readJSON(userKey('routines'), DEFAULT_ROUTINES);
}

export function getActiveRoutines() {
  return getAllRoutinesRaw().filter((r) => !r.deleted);
}

export function saveAllRoutinesRaw(routines) {
  writeJSON(userKey('routines'), routines);
}

export function upsertRoutine(routine) {
  const list = getAllRoutinesRaw();
  const idx = list.findIndex((item) => item.id === routine.id);
  const next = {
    ...routine,
    updatedAt: new Date().toISOString(),
    deleted: Boolean(routine.deleted)
  };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveAllRoutinesRaw(list);
  return next;
}

export function softDeleteRoutine(id) {
  const list = getAllRoutinesRaw();
  const idx = list.findIndex((item) => item.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], deleted: true, updatedAt: new Date().toISOString() };
    saveAllRoutinesRaw(list);
  }
}

export function resetDefaultRoutines() {
  const customOnly = getAllRoutinesRaw().filter((r) => !r.isDefault);
  const now = new Date().toISOString();
  const defaults = DEFAULT_ROUTINES.map((r) => ({ ...r, updatedAt: now, deleted: false }));
  saveAllRoutinesRaw([...defaults, ...customOnly]);
}

// ===== 보충제 항목 & 체크 로그 =====
export function getAllSupplementItemsRaw() {
  return readJSON(userKey('supp_items'), DEFAULT_SUPPLEMENTS);
}

export function getActiveSupplementItems() {
  return getAllSupplementItemsRaw().filter((item) => !item.deleted);
}

export function saveAllSupplementItemsRaw(items) {
  writeJSON(userKey('supp_items'), items);
}

export function upsertSupplementItem(item) {
  const list = getAllSupplementItemsRaw();
  const idx = list.findIndex((x) => x.id === item.id);
  const next = {
    ...item,
    updatedAt: new Date().toISOString(),
    deleted: Boolean(item.deleted)
  };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  saveAllSupplementItemsRaw(list);
  return next;
}

export function softDeleteSupplementItem(id) {
  const list = getAllSupplementItemsRaw();
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], deleted: true, updatedAt: new Date().toISOString() };
    saveAllSupplementItemsRaw(list);
  }
}

export function getAllSupplementLogsRaw() {
  return readJSON(userKey('supp_logs'), []);
}

export function saveAllSupplementLogsRaw(logs) {
  writeJSON(userKey('supp_logs'), logs);
}

export function getSupplementLogByDate(dateStr) {
  return (
    getAllSupplementLogsRaw().find((l) => !l.deleted && l.date === dateStr) || {
      id: `supp_log_${dateStr}`,
      date: dateStr,
      checkedIds: []
    }
  );
}

export function toggleSupplementCheck(dateStr, itemId) {
  const list = getAllSupplementLogsRaw();
  const logId = `supp_log_${dateStr}`;
  const idx = list.findIndex((l) => l.id === logId || l.date === dateStr);
  const current = idx >= 0 ? list[idx] : { id: logId, date: dateStr, checkedIds: [], deleted: false };
  const set = new Set(current.checkedIds || []);
  if (set.has(itemId)) set.delete(itemId);
  else set.add(itemId);

  const next = {
    ...current,
    id: current.id || logId,
    date: dateStr,
    checkedIds: Array.from(set),
    updatedAt: new Date().toISOString(),
    deleted: false
  };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  saveAllSupplementLogsRaw(list);
  return next;
}

// ===== 체중 · 인바디 =====
export function getAllInBodyRaw() {
  return readJSON(userKey('inbody'), []);
}

export function getActiveInBodyRecords() {
  return getAllInBodyRaw()
    .filter((r) => !r.deleted)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function saveAllInBodyRaw(records) {
  writeJSON(userKey('inbody'), records);
}

export function upsertInBodyRecord(record) {
  const list = getAllInBodyRaw();
  const id = record.id || `inbody_${record.date}`;
  const idx = list.findIndex((r) => r.id === id || (!r.deleted && r.date === record.date));
  const next = {
    ...record,
    id,
    updatedAt: new Date().toISOString(),
    deleted: false
  };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  saveAllInBodyRaw(list);
  return next;
}

export function softDeleteInBodyRecord(id) {
  const list = getAllInBodyRaw();
  const idx = list.findIndex((r) => r.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], deleted: true, updatedAt: new Date().toISOString() };
    saveAllInBodyRaw(list);
  }
}

// ===== 동기화 메타, 커스텀 종목, 초안 =====
export function getSyncMeta() {
  return readJSON(userKey('sync_meta'), { lastSyncAt: null, status: 'idle', message: '' });
}

export function saveSyncMeta(meta) {
  const next = { ...getSyncMeta(), ...meta };
  writeJSON(userKey('sync_meta'), next);
  return next;
}

export function getCustomExercises() {
  return readJSON(userKey('custom_ex'), []);
}

export function addCustomExercise(name, muscle, trackingType = 'weighted') {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = getAllExercises().find((ex) => ex.name === trimmed);
  if (existing) return existing;

  const custom = getCustomExercises();
  const created = {
    id: `ex_custom_${Date.now()}`,
    name: trimmed,
    muscle: muscle || '코어',
    trackingType: trackingType || 'weighted',
    isCustom: true
  };
  custom.push(created);
  writeJSON(userKey('custom_ex'), custom);
  return created;
}

export function getAllExercises() {
  return [...EXERCISE_CATALOG, ...getCustomExercises()];
}

export function hasSavedDraft() {
  return localStorage.getItem(userKey('draft')) !== null;
}

export function createEmptyDraft() {
  return {
    id: `w_${Date.now()}`,
    title: '오늘의 운동',
    date: toLocalDateStr(),
    routineId: null,
    startedAt: Date.now(),
    exercises: []
  };
}

export function getDraft() {
  return readJSON(userKey('draft'), null) || createEmptyDraft();
}

export function saveDraft(draft) {
  writeJSON(userKey('draft'), draft);
}

export function clearDraft() {
  const fresh = createEmptyDraft();
  writeJSON(userKey('draft'), fresh);
  return fresh;
}

export function getLastExerciseRecord(exerciseName) {
  const workouts = getActiveWorkouts();
  for (const w of workouts) {
    const found = (w.exercises || []).find((ex) => ex.name === exerciseName);
    if (!found) continue;
    const completed = (found.sets || []).filter((s) => s.completed && s.setType !== 'warmup');
    if (!completed.length) continue;

    let bestSet = completed[0];
    let best1RM = calcEst1RM(bestSet.weight, bestSet.reps);
    for (const s of completed) {
      const rm = calcEst1RM(s.weight, s.reps);
      if (rm > best1RM || (rm === best1RM && (Number(s.reps) || 0) > (Number(bestSet.reps) || 0))) {
        best1RM = rm;
        bestSet = s;
      }
    }
    return { date: w.date, sets: completed, bestSet, best1RM };
  }
  return null;
}

function toEpoch(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  const parsed = Date.parse(ts);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function mergeById(localItems = [], remoteItems = []) {
  const map = new Map();
  for (const item of localItems) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const remote of remoteItems) {
    if (!remote || !remote.id) continue;
    const local = map.get(remote.id);
    if (!local || toEpoch(remote.updatedAt) >= toEpoch(local.updatedAt)) {
      map.set(remote.id, remote);
    }
  }
  return Array.from(map.values());
}

export function exportAllDataJSON() {
  return JSON.stringify(
    {
      version: 2,
      nickname: getSession()?.nickname || 'guest',
      exportedAt: new Date().toISOString(),
      workouts: getAllWorkoutsRaw(),
      routines: getAllRoutinesRaw(),
      supplementItems: getAllSupplementItemsRaw(),
      supplementLogs: getAllSupplementLogsRaw(),
      inbodyRecords: getAllInBodyRaw(),
      customExercises: getCustomExercises()
    },
    null,
    2
  );
}

export function importAllDataJSON(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('올바른 백업 파일 형식이 아닙니다.');
  }
  if (Array.isArray(parsed.workouts)) saveAllWorkoutsRaw(mergeById(getAllWorkoutsRaw(), parsed.workouts));
  if (Array.isArray(parsed.routines)) saveAllRoutinesRaw(mergeById(getAllRoutinesRaw(), parsed.routines));
  if (Array.isArray(parsed.supplementItems)) saveAllSupplementItemsRaw(mergeById(getAllSupplementItemsRaw(), parsed.supplementItems));
  if (Array.isArray(parsed.supplementLogs)) saveAllSupplementLogsRaw(mergeById(getAllSupplementLogsRaw(), parsed.supplementLogs));
  if (Array.isArray(parsed.inbodyRecords)) saveAllInBodyRaw(mergeById(getAllInBodyRaw(), parsed.inbodyRecords));
  if (Array.isArray(parsed.customExercises)) {
    const existing = getCustomExercises();
    const names = new Set(existing.map((e) => e.name));
    const merged = [...existing];
    for (const ex of parsed.customExercises) {
      if (ex && ex.name && !names.has(ex.name)) {
        merged.push(ex);
        names.add(ex.name);
      }
    }
    writeJSON(userKey('custom_ex'), merged);
  }
}
