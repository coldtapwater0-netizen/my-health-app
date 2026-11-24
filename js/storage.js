import {
  DEFAULT_ROUTINES,
  EXERCISE_CATALOG,
  calcEst1RM,
  createDemoWorkouts,
  toLocalDateStr
} from './data.js';

const KEYS = {
  WORKOUTS: 'fleekfit_workouts_v1',
  ROUTINES: 'fleekfit_routines_v1',
  DRAFT: 'fleekfit_draft_v1',
  SETTINGS: 'fleekfit_settings_v1',
  CUSTOM_EXERCISES: 'fleekfit_custom_exercises_v1',
  SYNC_META: 'fleekfit_sync_meta_v1'
};

export const DEFAULT_SETTINGS = {
  scriptUrl: '',
  scriptSecret: '',
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

export function initStorage() {
  if (localStorage.getItem(KEYS.ROUTINES) === null) {
    writeJSON(KEYS.ROUTINES, DEFAULT_ROUTINES);
  }
  if (localStorage.getItem(KEYS.WORKOUTS) === null) {
    writeJSON(KEYS.WORKOUTS, createDemoWorkouts());
  }
  if (localStorage.getItem(KEYS.SETTINGS) === null) {
    writeJSON(KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
}

export function getAllWorkoutsRaw() {
  return readJSON(KEYS.WORKOUTS, []);
}

export function getActiveWorkouts() {
  return getAllWorkoutsRaw()
    .filter((w) => !w.deleted)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function saveAllWorkoutsRaw(workouts) {
  writeJSON(KEYS.WORKOUTS, workouts);
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
    list[idx] = {
      ...list[idx],
      deleted: true,
      updatedAt: new Date().toISOString()
    };
    saveAllWorkoutsRaw(list);
  }
}

export function clearDemoWorkouts() {
  const list = getAllWorkoutsRaw().filter((w) => !w.isDemo);
  saveAllWorkoutsRaw(list);
}

export function getAllRoutinesRaw() {
  return readJSON(KEYS.ROUTINES, DEFAULT_ROUTINES);
}

export function getActiveRoutines() {
  return getAllRoutinesRaw().filter((r) => !r.deleted);
}

export function saveAllRoutinesRaw(routines) {
  writeJSON(KEYS.ROUTINES, routines);
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
    list[idx] = {
      ...list[idx],
      deleted: true,
      updatedAt: new Date().toISOString()
    };
    saveAllRoutinesRaw(list);
  }
}

export function resetDefaultRoutines() {
  const customOnly = getAllRoutinesRaw().filter((r) => !r.isDefault);
  const now = new Date().toISOString();
  const defaults = DEFAULT_ROUTINES.map((r) => ({ ...r, updatedAt: now, deleted: false }));
  saveAllRoutinesRaw([...defaults, ...customOnly]);
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(KEYS.SETTINGS, {}) };
}

export function saveSettings(partial) {
  const next = { ...getSettings(), ...partial };
  writeJSON(KEYS.SETTINGS, next);
  return next;
}

export function getSyncMeta() {
  return readJSON(KEYS.SYNC_META, {
    lastSyncAt: null,
    status: 'idle',
    message: ''
  });
}

export function saveSyncMeta(meta) {
  const next = { ...getSyncMeta(), ...meta };
  writeJSON(KEYS.SYNC_META, next);
  return next;
}

export function getCustomExercises() {
  return readJSON(KEYS.CUSTOM_EXERCISES, []);
}

export function addCustomExercise(name, muscle) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const all = getAllExercises();
  const existing = all.find((ex) => ex.name === trimmed);
  if (existing) return existing;

  const custom = getCustomExercises();
  const created = {
    id: `ex_custom_${Date.now()}`,
    name: trimmed,
    muscle: muscle || '코어',
    isCustom: true
  };
  custom.push(created);
  writeJSON(KEYS.CUSTOM_EXERCISES, custom);
  return created;
}

export function getAllExercises() {
  return [...EXERCISE_CATALOG, ...getCustomExercises()];
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
  return readJSON(KEYS.DRAFT, null) || createEmptyDraft();
}

export function saveDraft(draft) {
  writeJSON(KEYS.DRAFT, draft);
}

export function clearDraft() {
  const fresh = createEmptyDraft();
  writeJSON(KEYS.DRAFT, fresh);
  return fresh;
}

export function getLastExerciseRecord(exerciseName) {
  const workouts = getActiveWorkouts();
  for (const w of workouts) {
    const found = (w.exercises || []).find((ex) => ex.name === exerciseName);
    if (!found) continue;
    const completed = (found.sets || []).filter((s) => s.completed);
    if (completed.length === 0) continue;

    let bestSet = completed[0];
    let best1RM = calcEst1RM(bestSet.weight, bestSet.reps);
    for (const s of completed) {
      const rm = calcEst1RM(s.weight, s.reps);
      if (rm > best1RM) {
        best1RM = rm;
        bestSet = s;
      }
    }
    return {
      date: w.date,
      sets: completed,
      bestSet,
      best1RM
    };
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
      version: 1,
      exportedAt: new Date().toISOString(),
      workouts: getAllWorkoutsRaw(),
      routines: getAllRoutinesRaw(),
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
  if (Array.isArray(parsed.workouts)) {
    saveAllWorkoutsRaw(mergeById(getAllWorkoutsRaw(), parsed.workouts));
  }
  if (Array.isArray(parsed.routines)) {
    saveAllRoutinesRaw(mergeById(getAllRoutinesRaw(), parsed.routines));
  }
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
    writeJSON(KEYS.CUSTOM_EXERCISES, merged);
  }
}
