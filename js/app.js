import {
  DEFAULT_APP_URL,
  DEFAULT_ROUTINES,
  DEFAULT_SCRIPT_URL,
  MUSCLE_GROUPS,
  buildExercisePRMap,
  calcEst1RM,
  calcSetVolume,
  calcWorkoutStats,
  calculateBarbellPlates,
  formatKoreanDate,
  inferTrackingType,
  isSetPR,
  toLocalDateStr
} from './data.js';
import {
  addCustomExercise,
  clearDemoWorkouts,
  clearDraft,
  clearSession,
  exportAllDataJSON,
  getActiveInBodyRecords,
  getActiveRoutines,
  getActiveSupplementItems,
  getActiveWorkouts,
  getAllExercises,
  getAllInBodyRaw,
  getAllRoutinesRaw,
  getAllSupplementItemsRaw,
  getAllSupplementLogsRaw,
  getAllWorkoutsRaw,
  getDraft,
  getLastExerciseRecord,
  getSession,
  getSettings,
  getSupplementLogByDate,
  getSyncMeta,
  hasSavedDraft,
  importAllDataJSON,
  initUserStorage,
  mergeById,
  resetDefaultRoutines,
  saveAllInBodyRaw,
  saveAllRoutinesRaw,
  saveAllSupplementItemsRaw,
  saveAllSupplementLogsRaw,
  saveAllWorkoutsRaw,
  saveDraft,
  saveSettings,
  saveSyncMeta,
  setSession,
  softDeleteInBodyRecord,
  softDeleteRoutine,
  softDeleteSupplementItem,
  softDeleteWorkout,
  toggleSupplementCheck,
  upsertInBodyRecord,
  upsertRoutine,
  upsertSupplementItem,
  upsertWorkout
} from './storage.js';
import { RestTimer, formatDuration, formatMMSS } from './timer.js';
import {
  loginUser,
  registerUser,
  syncWithGoogleSheets,
  testScriptConnection
} from './sync.js';
import {
  render1RMChart,
  renderCalendar,
  renderInBodyChart,
  renderMuscleChart,
  renderVolumeChart
} from './charts.js';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const state = {
  session: null,
  settings: null,
  authMode: 'register', // 'register' | 'login'
  activeTab: 'workout',
  draft: null,
  routineFilter: '전체',
  dailyDate: toLocalDateStr(),
  historySubTab: 'workout', // 'workout' | 'inbody'
  historyPeriod: '30',
  muscleMode: 'sets',
  selected1RMExercise: '',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDateFilter: null,
  pickerMode: 'workout',
  pickerMuscle: '전체',
  editingRoutine: null,
  viewingWorkoutId: null,
  isSyncing: false,
  deferredInstallPrompt: null,
  modalZIndex: 65,
  customRestTarget: null
};

const restTimer = new RestTimer({
  onTick: (info) => renderRestTimerBar(info),
  onComplete: () => {
    showToast('휴식 시간이 끝났습니다! 다음 세트를 시작하세요.', 'success');
    renderRestTimerBar({ running: false, remainingSec: 0, totalSec: 90, progress: 0 });
  }
});

// ===== 테마 관리 =====
function resolveTheme(mode) {
  if (mode === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  }
  return mode === 'light' ? 'light' : 'dark';
}

function applyTheme(mode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#F4F7FB' : '#0F131A');

  document.querySelectorAll('#theme-selector .theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeMode === mode);
  });
}

// ===== 부트스트랩 =====
function bootstrap() {
  state.settings = getSettings();
  applyTheme(state.settings.theme);
  restTimer.setSoundEnabled(state.settings.timerSound);

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (state.settings?.theme === 'system') applyTheme('system');
    });
  }

  bindEvents();
  initPwaInstallHelper();
  startElapsedClock();
  registerServiceWorker();

  const existingSession = getSession();
  if (existingSession && existingSession.nickname) {
    enterApp(existingSession, { autoSyncOnStart: true });
  } else {
    showAuthScreen();
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function showAuthScreen() {
  state.session = null;
  document.getElementById('app-shell').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('auth-feedback').classList.add('hidden');
  document.getElementById('auth-pin').value = '';
}

function enterApp(session, { autoSyncOnStart = false } = {}) {
  state.session = session;
  setSession(session);
  initUserStorage(session.nickname, { seedDemo: Boolean(session.isDemo) });

  if (!hasSavedDraft()) {
    state.draft = buildDraftFromRoutine(DEFAULT_ROUTINES[0]);
    saveDraft(state.draft);
  } else {
    state.draft = getDraft();
  }

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');

  renderAll();
  switchTab('workout');

  if (autoSyncOnStart && !session.isDemo && state.settings.autoSync) {
    window.setTimeout(() => {
      if (navigator.onLine) runSync({ silent: true });
    }, 50);
  }
}

// ===== 토스트 & 모달 =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.zIndex = String(++state.modalZIndex);
  el.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ===== 루틴 -> 초안 변환 =====
function buildDraftFromRoutine(routine) {
  const defaultRest = state.settings?.defaultRestSec || 90;
  const exercises = (routine.exercises || []).map((ex) => {
    const tracking = inferTrackingType(ex);
    const last = getLastExerciseRecord(ex.name);
    const count = Math.max(1, Number(ex.targetSets) || 3);
    const sets = [];
    for (let i = 0; i < count; i++) {
      const refSet = last?.sets?.[i] || last?.sets?.[last.sets.length - 1];
      sets.push({
        id: uid('set'),
        weight: refSet ? refSet.weight : Number(ex.defaultWeight) || 0,
        reps: refSet ? refSet.reps : Number(ex.defaultReps) || 10,
        durationSec: refSet ? refSet.durationSec || 60 : Number(ex.defaultDurationSec) || 60,
        setType: 'normal',
        completed: false
      });
    }
    return {
      id: uid('ex'),
      name: ex.name,
      muscle: ex.muscle || '코어',
      trackingType: tracking,
      restSec: Number(ex.restSec) || defaultRest,
      sets
    };
  });

  return {
    id: uid('w'),
    title: routine.name,
    date: toLocalDateStr(),
    routineId: routine.id,
    startedAt: null,
    elapsedSec: 0,
    timerRunning: false,
    exercises
  };
}

// ===== 운동 경과 스톱워치 =====
function getDraftElapsedSec(draft = state.draft) {
  if (!draft) return 0;
  const base = Number(draft.elapsedSec) || 0;
  if (draft.timerRunning && draft.startedAt) {
    return base + Math.max(0, Math.floor((Date.now() - draft.startedAt) / 1000));
  }
  return base;
}

function renderWorkoutTimerUI() {
  const el = document.getElementById('workout-elapsed');
  const toggleBtn = document.getElementById('btn-toggle-workout-timer');
  if (!state.draft) return;

  const sec = getDraftElapsedSec(state.draft);
  if (el) el.textContent = formatDuration(sec);
  if (toggleBtn) {
    const running = Boolean(state.draft.timerRunning);
    toggleBtn.classList.toggle('running', running);
    toggleBtn.textContent = running ? '⏸ 정지' : sec > 0 ? '▶ 재개' : '▶ 시작';
  }
}

function startWorkoutTimer({ silent = false } = {}) {
  if (!state.draft || state.draft.timerRunning) return;
  state.draft.startedAt = Date.now();
  state.draft.timerRunning = true;
  saveDraft(state.draft);
  renderWorkoutTimerUI();
  if (!silent) showToast('운동 시간 측정을 시작했습니다.');
}

function pauseWorkoutTimer() {
  if (!state.draft || !state.draft.timerRunning) return;
  state.draft.elapsedSec = getDraftElapsedSec(state.draft);
  state.draft.startedAt = null;
  state.draft.timerRunning = false;
  saveDraft(state.draft);
  renderWorkoutTimerUI();
  showToast('운동 시간을 일시정지했습니다.');
}

function resetWorkoutTimer() {
  if (!state.draft) return;
  state.draft.startedAt = null;
  state.draft.elapsedSec = 0;
  state.draft.timerRunning = false;
  saveDraft(state.draft);
  renderWorkoutTimerUI();
  showToast('운동 시간을 00:00으로 초기화했습니다.');
}

// ===== 전체 렌더링 =====
function renderAll() {
  renderUserBadge();
  renderSyncIndicators();
  renderWorkoutView();
  renderRoutinesView();
  renderDailyView();
  renderHistoryView();
  renderSettingsView();
  renderSoundButtons();
}

function renderUserBadge() {
  const nick = state.session?.nickname || '사용자';
  const badge = document.getElementById('user-badge');
  const settingsName = document.getElementById('settings-user-name');
  const settingsMode = document.getElementById('settings-user-mode');
  if (badge) badge.textContent = nick;
  if (settingsName) settingsName.textContent = nick;
  if (settingsMode) {
    settingsMode.textContent = state.session?.isDemo
      ? '체험 모드(로컬 전용)입니다. 구글 시트 동기화를 쓰려면 로그인하세요.'
      : '구글 시트와 닉네임별로 자동 동기화되는 계정입니다.';
  }
}

function renderSyncIndicators() {
  const meta = getSyncMeta();
  const pill = document.getElementById('sync-pill');
  const pillText = document.getElementById('sync-pill-text');
  const statusBadge = document.getElementById('settings-sync-status');
  const lastSyncEl = document.getElementById('settings-last-sync');

  pill.classList.remove('synced', 'syncing', 'error');

  if (state.session?.isDemo) {
    pillText.textContent = '체험 모드';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '체험 모드';
    }
  } else if (state.isSyncing) {
    pill.classList.add('syncing');
    pillText.textContent = '동기화 중';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '동기화 중';
    }
  } else if (!navigator.onLine) {
    pillText.textContent = '오프라인 저장';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '오프라인';
    }
  } else if (meta.status === 'error') {
    pill.classList.add('error');
    pillText.textContent = '동기화 오류';
    if (statusBadge) {
      statusBadge.className = 'status-badge err';
      statusBadge.textContent = '연결 오류';
    }
  } else if (meta.status === 'synced') {
    pill.classList.add('synced');
    pillText.textContent = '동기화됨';
    if (statusBadge) {
      statusBadge.className = 'status-badge ok';
      statusBadge.textContent = '연결됨';
    }
  } else {
    pillText.textContent = '시트 대기';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '대기 중';
    }
  }

  if (lastSyncEl) {
    if (meta.lastSyncAt) {
      lastSyncEl.textContent = new Date(meta.lastSyncAt).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      lastSyncEl.textContent = '아직 없음';
    }
  }
}

function renderSoundButtons() {
  const on = Boolean(state.settings.timerSound);
  const inlineBtn = document.getElementById('btn-inline-sound');
  const inlineLabel = document.getElementById('inline-sound-label');
  const barBtn = document.getElementById('btn-rest-sound-toggle');

  if (inlineBtn && inlineLabel) {
    inlineBtn.classList.toggle('muted', !on);
    inlineLabel.textContent = on ? '알림음 ON' : '알림음 OFF';
  }
  if (barBtn) {
    barBtn.classList.toggle('muted', !on);
    barBtn.textContent = on ? '🔔' : '🔕';
  }
}

function renderRestTimerBar(info) {
  const bar = document.getElementById('rest-timer-bar');
  const display = document.getElementById('rest-timer-display');
  const fill = document.getElementById('rest-progress-fill');
  if (!info.running) {
    bar.classList.add('hidden');
    return;
  }
  bar.classList.remove('hidden');
  display.textContent = formatMMSS(info.remainingSec);
  fill.style.width = `${info.progress}%`;
}

function updateWorkoutSummaryDOM() {
  const stats = calcWorkoutStats(state.draft.exercises);
  document.getElementById('summary-sets').textContent = `${stats.completedSets} / ${stats.totalSets}`;
  document.getElementById('summary-volume').textContent = `${Math.round(stats.totalVolume).toLocaleString('ko-KR')} kg`;
  document.getElementById('summary-best-1rm').textContent = `${stats.best1RM} kg`;
}

function renderWorkoutView() {
  const draft = state.draft;
  document.getElementById('workout-title-input').value = draft.title || '';
  document.getElementById('workout-date-input').value = draft.date || toLocalDateStr();
  updateWorkoutSummaryDOM();
  renderWorkoutTimerUI();

  const prMap = buildExercisePRMap(getActiveWorkouts(), draft.id);
  const listEl = document.getElementById('workout-exercises-list');

  if (!draft.exercises.length) {
    listEl.innerHTML = `
      <div class="empty-box">
        <strong>아직 추가된 운동 종목이 없습니다</strong>
        <span>"+ 운동 종목 추가하기"를 누르거나 아래 루틴을 선택해 바로 시작하세요.</span>
      </div>
    `;
  } else {
    listEl.innerHTML = draft.exercises
      .map((ex, exIdx) => {
        const tracking = inferTrackingType(ex);
        const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
        const last = getLastExerciseRecord(ex.name);
        let lastHint = '첫 기록입니다 (완료 시 기준 기록 저장)';
        if (last) {
          if (tracking === 'bodyweight_time') {
            lastHint = `지난 기록 (${formatKoreanDate(last.date)}): 최고 ${last.bestSet.durationSec || 0}초`;
          } else if (tracking === 'bodyweight_reps') {
            const addW = Number(last.bestSet.weight) > 0 ? `+${last.bestSet.weight}kg × ` : '맨몸 ';
            lastHint = `지난 기록 (${formatKoreanDate(last.date)}): ${addW}${last.bestSet.reps}회`;
          } else {
            lastHint = `지난 기록 (${formatKoreanDate(last.date)}): 최고 ${last.bestSet.weight}kg × ${last.bestSet.reps}회`;
          }
        }

        const exVol = (ex.sets || []).reduce((sum, s) => {
          if (!s.completed || s.setType === 'warmup' || tracking === 'bodyweight_time') return sum;
          return sum + calcSetVolume(s.weight, s.reps);
        }, 0);

        const col2Header = tracking === 'weighted' ? '무게(kg)' : '+중량(선택)';
        const col3Header = tracking === 'bodyweight_time' ? '시간(초)' : '횟수';
        const col4Header = tracking === 'weighted' ? '추정1RM' : tracking === 'bodyweight_reps' ? '기록' : '기록';
        const trackingBadge =
          tracking === 'bodyweight_reps'
            ? '<span class="bw-pill">맨몸·횟수</span>'
            : tracking === 'bodyweight_time'
            ? '<span class="bw-pill">맨몸·시간</span>'
            : '';

        return `
          <article class="exercise-card" data-ex-idx="${exIdx}">
            <div class="exercise-card-head">
              <div class="exercise-title-group">
                <div class="exercise-name-row">
                  <h3 class="exercise-name">${escapeHtml(ex.name)}</h3>
                  <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg}">${escapeHtml(ex.muscle)}</span>
                  ${trackingBadge}
                </div>
                <div class="last-record-hint">${escapeHtml(lastHint)}</div>
              </div>
              <div class="exercise-head-actions">
                <select class="rest-mini-select" data-action="change-ex-rest" data-ex-idx="${exIdx}" aria-label="종목 휴식 시간">
                  ${(() => {
                    const presets = [30, 45, 60, 90, 120, 150, 180];
                    const cur = Number(ex.restSec) || state.settings.defaultRestSec || 90;
                    const opts = presets.includes(cur) ? presets : [...presets, cur].sort((a, b) => a - b);
                    return opts
                      .map((sec) => `<option value="${sec}" ${cur === sec ? 'selected' : ''}>휴식 ${sec}초</option>`)
                      .join('') + '<option value="custom">직접 입력...</option>';
                  })()}
                </select>
                <button class="icon-btn" type="button" data-action="remove-ex" data-ex-idx="${exIdx}" title="종목 삭제">✕</button>
              </div>
            </div>

            <div class="sets-header ${tracking === 'bodyweight_time' ? 'bw-time-grid' : ''}">
              <span>유형</span>
              <span>${col2Header}</span>
              <span>${col3Header}</span>
              <span>${col4Header}</span>
              <span>완료</span>
              <span></span>
            </div>

            <div class="sets-list">
              ${(ex.sets || [])
                .map((s, setIdx) => {
                  const setType = s.setType || 'normal';
                  const typeLabel = setType === 'warmup' ? 'W' : setType === 'drop' ? 'D' : String(setIdx + 1);
                  const typeClass = setType === 'warmup' ? 'warmup' : setType === 'drop' ? 'drop' : '';
                  const prHit = isSetPR(s, ex, prMap);
                  let metricText = '-';
                  if (tracking === 'weighted') {
                    const rm = calcEst1RM(s.weight, s.reps);
                    metricText = rm > 0 ? `${rm}` : '-';
                  } else if (tracking === 'bodyweight_reps') {
                    metricText = Number(s.reps) > 0 ? `${s.reps}회` : '-';
                  } else {
                    metricText = Number(s.durationSec) > 0 ? `${s.durationSec}초` : '-';
                  }

                  const col3Field = tracking === 'bodyweight_time' ? 'edit-duration' : 'edit-reps';
                  const col3Val = tracking === 'bodyweight_time' ? s.durationSec || 0 : s.reps || 0;

                  return `
                    <div class="set-row ${s.completed ? 'completed' : ''} ${typeClass} ${tracking === 'bodyweight_time' ? 'bw-time-grid' : ''}" data-ex-idx="${exIdx}" data-set-idx="${setIdx}">
                      <button class="set-type-btn ${typeClass}" type="button" data-action="cycle-set-type" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" title="탭해서 세트 유형 변경 (일반/W/D)">
                        ${typeLabel}
                      </button>
                      <input class="set-input" type="number" inputmode="decimal" step="0.5" min="0"
                        value="${s.weight ?? 0}" data-action="edit-weight" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" aria-label="${col2Header}">
                      <input class="set-input" type="number" inputmode="numeric" step="1" min="0"
                        value="${col3Val}" data-action="${col3Field}" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" aria-label="${col3Header}">
                      <div class="set-1rm-cell">
                        <span class="set-1rm tabular" data-role="set-1rm">${metricText}</span>
                        <span data-role="pr-badge-slot">${prHit ? '<span class="pr-mini-badge">PR</span>' : ''}</span>
                      </div>
                      <button class="set-check-btn" type="button" data-action="toggle-set" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" aria-label="세트 완료 체크">
                        ✓
                      </button>
                      <button class="set-del-btn" type="button" data-action="remove-set" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" title="세트 삭제">×</button>
                    </div>
                  `;
                })
                .join('')}
            </div>

            <div class="exercise-card-foot">
              <button class="btn btn-ghost btn-xs" type="button" data-action="add-set" data-ex-idx="${exIdx}">+ 세트 추가</button>
              <span class="exercise-subtotal tabular">종목 볼륨: <strong data-role="ex-volume">${Math.round(exVol).toLocaleString('ko-KR')} kg</strong></span>
            </div>
          </article>
        `;
      })
      .join('');
  }

  const quickGrid = document.getElementById('quick-routines-grid');
  const routines = getActiveRoutines().slice(0, 4);
  quickGrid.innerHTML = routines
    .map(
      (r) => `
      <button class="quick-routine-tile" type="button" data-action="start-routine" data-routine-id="${escapeHtml(r.id)}">
        <span class="quick-routine-split">${escapeHtml(r.split)}</span>
        <span class="quick-routine-name">${escapeHtml(r.name)}</span>
        <span class="quick-routine-meta">${(r.exercises || []).length}종목 · ${(r.exercises || []).reduce((a, b) => a + (Number(b.targetSets) || 3), 0)}세트</span>
      </button>
    `
    )
    .join('');
}

function renderRoutinesView() {
  document.querySelectorAll('#routine-filter-chips .filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.split === state.routineFilter);
  });

  const routines = getActiveRoutines().filter((r) => {
    if (state.routineFilter === '전체') return true;
    if (state.routineFilter === '커스텀') return !r.isDefault;
    return r.split === state.routineFilter;
  });

  const listEl = document.getElementById('routines-list');
  if (!routines.length) {
    listEl.innerHTML = `
      <div class="empty-box">
        <strong>해당 분할의 루틴이 없습니다</strong>
        <span>오른쪽 위 "+ 새 루틴" 버튼으로 나만의 루틴을 만들어 보세요.</span>
      </div>
    `;
    return;
  }

  listEl.innerHTML = routines
    .map((r) => {
      const totalSets = (r.exercises || []).reduce((sum, ex) => sum + (Number(ex.targetSets) || 3), 0);
      return `
        <article class="card routine-card">
          <div class="routine-top">
            <div>
              <div class="routine-badge-row">
                <span class="split-badge">${escapeHtml(r.split)}</span>
                ${r.isDefault ? '<span class="default-badge">기본 루틴</span>' : '<span class="default-badge">내 커스텀</span>'}
              </div>
              <h2 class="routine-name">${escapeHtml(r.name)}</h2>
              ${r.description ? `<p class="routine-desc">${escapeHtml(r.description)}</p>` : ''}
            </div>
            <span class="text-secondary tabular" style="font-size:12px">${(r.exercises || []).length}종목 · ${totalSets}세트</span>
          </div>

          <div class="routine-exercises-preview">
            ${(r.exercises || [])
              .map((ex) => `<span class="routine-ex-tag">${escapeHtml(ex.name)} · ${ex.targetSets}세트</span>`)
              .join('')}
          </div>

          <div class="routine-actions">
            <button class="btn btn-primary btn-sm" type="button" data-action="start-routine" data-routine-id="${escapeHtml(r.id)}">
              ▶ 이 루틴으로 운동 시작
            </button>
            <div class="routine-secondary-btns">
              <button class="btn btn-ghost btn-xs" type="button" data-action="edit-routine" data-routine-id="${escapeHtml(r.id)}">수정</button>
              <button class="btn btn-ghost btn-xs" type="button" data-action="duplicate-routine" data-routine-id="${escapeHtml(r.id)}">복제</button>
              ${!r.isDefault ? `<button class="btn btn-ghost btn-xs" type="button" data-action="delete-routine" data-routine-id="${escapeHtml(r.id)}">삭제</button>` : ''}
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

// ===== 데일리 (보충제 + 인바디) =====
function renderDailyView() {
  const dateInput = document.getElementById('daily-date-input');
  dateInput.value = state.dailyDate;
  document.getElementById('inbody-date-label').textContent = formatKoreanDate(state.dailyDate);

  const items = getActiveSupplementItems();
  const log = getSupplementLogByDate(state.dailyDate);
  const checkedSet = new Set(log.checkedIds || []);
  const doneCount = items.filter((item) => checkedSet.has(item.id)).length;
  const pct = items.length > 0 ? Math.round((doneCount / items.length) * 100) : 0;

  document.getElementById('daily-supp-progress').textContent = `${doneCount} / ${items.length} 완료`;
  document.getElementById('daily-supp-bar').style.width = `${pct}%`;

  const suppListEl = document.getElementById('daily-supp-list');
  if (!items.length) {
    suppListEl.innerHTML = '<div class="chart-empty">등록된 보충제가 없습니다. "+ 항목 추가"로 추가해 보세요.</div>';
  } else {
    suppListEl.innerHTML = items
      .map((item) => {
        const checked = checkedSet.has(item.id);
        return `
          <div class="supp-item ${checked ? 'checked' : ''}">
            <button class="supp-check-main" type="button" data-action="toggle-supp" data-supp-id="${escapeHtml(item.id)}">
              <span class="supp-checkbox">${checked ? '✓' : ''}</span>
              <span>
                <span class="supp-name">${escapeHtml(item.name)}</span>
                ${item.timeHint ? `<span class="supp-time">${escapeHtml(item.timeHint)}</span>` : ''}
              </span>
            </button>
            ${!item.isDefault ? `<button class="icon-btn" type="button" data-action="delete-supp" data-supp-id="${escapeHtml(item.id)}" title="항목 삭제">✕</button>` : ''}
          </div>
        `;
      })
      .join('');
  }

  // 선택한 날짜의 기존 인바디 값이 있으면 입력창에 채워주기
  const records = getActiveInBodyRecords();
  const existing = records.find((r) => r.date === state.dailyDate);
  document.getElementById('inbody-weight').value = existing?.weightKg ?? '';
  document.getElementById('inbody-muscle').value = existing?.muscleMassKg ?? '';
  document.getElementById('inbody-fat').value = existing?.bodyFatPct ?? '';
  document.getElementById('inbody-memo').value = existing?.memo ?? '';

  const recentEl = document.getElementById('inbody-recent-list');
  if (!records.length) {
    recentEl.innerHTML = '<div class="chart-empty">아직 저장된 체중·인바디 기록이 없습니다.</div>';
  } else {
    recentEl.innerHTML = records
      .slice(0, 6)
      .map(
        (r) => `
        <div class="inbody-row">
          <div>
            <strong>${formatKoreanDate(r.date)}</strong>
            <div class="text-secondary tabular" style="font-size:12px">
              체중 ${r.weightKg ?? '-'}kg · 골격근 ${r.muscleMassKg ?? '-'}kg · 체지방 ${r.bodyFatPct ?? '-'}%
              ${r.memo ? ` · ${escapeHtml(r.memo)}` : ''}
            </div>
          </div>
          <button class="icon-btn" type="button" data-action="delete-inbody" data-inbody-id="${escapeHtml(r.id)}" title="삭제">✕</button>
        </div>
      `
      )
      .join('');
  }
}

// ===== 기록·성장 뷰 =====
function getFilteredHistoryWorkouts() {
  const all = getActiveWorkouts();
  if (state.historyPeriod === 'all') return all;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = toLocalDateStr(cutoff);
  return all.filter((w) => (w.date || '') >= cutoffStr);
}

function renderHistoryView() {
  document.getElementById('period-30d').classList.toggle('active', state.historyPeriod === '30');
  document.getElementById('period-all').classList.toggle('active', state.historyPeriod === 'all');
  document.getElementById('hist-tab-workout').classList.toggle('active', state.historySubTab === 'workout');
  document.getElementById('hist-tab-inbody').classList.toggle('active', state.historySubTab === 'inbody');
  document.getElementById('hist-panel-workout').classList.toggle('hidden', state.historySubTab !== 'workout');
  document.getElementById('hist-panel-inbody').classList.toggle('hidden', state.historySubTab !== 'inbody');
  document.getElementById('muscle-mode-sets').classList.toggle('active', state.muscleMode === 'sets');
  document.getElementById('muscle-mode-volume').classList.toggle('active', state.muscleMode === 'volume');

  const allWorkouts = getActiveWorkouts();
  const suppLogs = getAllSupplementLogsRaw().filter((l) => !l.deleted && (l.checkedIds || []).length > 0);
  const workoutDates = new Set(allWorkouts.map((w) => w.date));
  const suppDates = new Set(suppLogs.map((l) => l.date));

  // 이번 달 출석일 수
  const monthPrefix = `${state.calYear}-${String(state.calMonth + 1).padStart(2, '0')}-`;
  const monthAttendance = Array.from(workoutDates).filter((d) => d.startsWith(monthPrefix)).length;
  document.getElementById('cal-attendance-badge').textContent = `${state.calMonth + 1}월 출석 ${monthAttendance}일`;

  renderCalendar(
    document.getElementById('history-calendar'),
    state.calYear,
    state.calMonth,
    workoutDates,
    suppDates,
    state.selectedDateFilter,
    toLocalDateStr(),
    (dateStr) => {
      state.selectedDateFilter = state.selectedDateFilter === dateStr ? null : dateStr;
      renderHistoryView();
    },
    (delta) => {
      const next = new Date(state.calYear, state.calMonth + delta, 1);
      state.calYear = next.getFullYear();
      state.calMonth = next.getMonth();
      renderHistoryView();
    }
  );

  document.getElementById('btn-clear-date-filter').classList.toggle('hidden', !state.selectedDateFilter);
  renderDaySummaryCard(allWorkouts);

  // 운동 성장 패널
  const workouts = getFilteredHistoryWorkouts();
  const totalCount = workouts.length;
  const totalVol = workouts.reduce((sum, w) => sum + (Number(w.totalVolume) || 0), 0);
  const avgVol = totalCount > 0 ? Math.round(totalVol / totalCount) : 0;

  document.getElementById('hist-kpi-count').textContent = `${totalCount}회`;
  document.getElementById('hist-kpi-volume').textContent = `${Math.round(totalVol).toLocaleString('ko-KR')} kg`;
  document.getElementById('hist-kpi-avg').textContent = `${avgVol.toLocaleString('ko-KR')} kg`;

  renderVolumeChart(
    document.getElementById('chart-volume'),
    workouts,
    document.getElementById('volume-trend-badge')
  );

  const exCounts = new Map();
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      if (inferTrackingType(ex) === 'bodyweight_time') continue;
      const hasDone = (ex.sets || []).some((s) => s.completed && s.setType !== 'warmup' && calcEst1RM(s.weight, s.reps) > 0);
      if (hasDone) exCounts.set(ex.name, (exCounts.get(ex.name) || 0) + 1);
    }
  }
  const exNames = Array.from(exCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const selectEl = document.getElementById('select-1rm-exercise');
  if (exNames.length === 0) {
    selectEl.innerHTML = '<option value="">중량 운동 기록 없음</option>';
    state.selected1RMExercise = '';
  } else {
    if (!exNames.includes(state.selected1RMExercise)) state.selected1RMExercise = exNames[0];
    selectEl.innerHTML = exNames
      .map((name) => `<option value="${escapeHtml(name)}" ${name === state.selected1RMExercise ? 'selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');
  }
  render1RMChart(
    document.getElementById('chart-1rm'),
    workouts,
    state.selected1RMExercise,
    document.getElementById('pr-badge')
  );

  renderMuscleChart(document.getElementById('chart-muscle'), workouts, state.muscleMode);

  const listItems = state.selectedDateFilter
    ? allWorkouts.filter((w) => w.date === state.selectedDateFilter)
    : workouts;
  const listEl = document.getElementById('history-list');
  if (!listItems.length) {
    listEl.innerHTML = `<div class="chart-empty">${state.selectedDateFilter ? `${formatKoreanDate(state.selectedDateFilter)}에는 저장된 운동 기록이 없습니다.` : '아직 저장된 운동 일지가 없습니다.'}</div>`;
  } else {
    listEl.innerHTML = listItems
      .map((w) => {
        const stats = calcWorkoutStats(w.exercises);
        const mins = Math.max(1, Math.round((Number(w.durationSec) || 0) / 60));
        return `
          <button class="history-item" type="button" data-action="view-workout" data-workout-id="${escapeHtml(w.id)}">
            <div class="history-item-top">
              <div>
                <div class="history-item-title">${escapeHtml(w.title || '운동 기록')} ${w.isDemo ? '<span class="demo-tag">샘플</span>' : ''}</div>
                <div class="history-item-date">${formatKoreanDate(w.date)} · ${mins}분</div>
              </div>
              <strong class="text-blue tabular">${Math.round(w.totalVolume || stats.totalVolume).toLocaleString('ko-KR')} kg</strong>
            </div>
            <div class="history-item-stats">
              <span>종목 ${(w.exercises || []).length}개</span>
              <span>•</span>
              <span>완료 ${stats.completedSets}세트</span>
              <span>•</span>
              <span>최고 1RM ${stats.best1RM}kg</span>
            </div>
          </button>
        `;
      })
      .join('');
  }

  // 인바디 추이 패널
  const inbodyAll = getActiveInBodyRecords();
  const inbodyFiltered =
    state.historyPeriod === 'all'
      ? inbodyAll
      : (() => {
          const cut = new Date();
          cut.setDate(cut.getDate() - 30);
          return inbodyAll.filter((r) => (r.date || '') >= toLocalDateStr(cut));
        })();

  renderInBodyKPIs(inbodyAll);
  renderInBodyChart(document.getElementById('chart-inbody-weight'), inbodyFiltered, 'weightKg', '체중', 'kg', '#3B82F6');
  renderInBodyChart(document.getElementById('chart-inbody-muscle'), inbodyFiltered, 'muscleMassKg', '골격근량', 'kg', '#10B981');
  renderInBodyChart(document.getElementById('chart-inbody-fat'), inbodyFiltered, 'bodyFatPct', '체지방률', '%', '#F59E0B');
}

function renderDaySummaryCard(allWorkouts) {
  const card = document.getElementById('day-summary-card');
  if (!state.selectedDateFilter) {
    card.classList.add('hidden');
    return;
  }

  const d = state.selectedDateFilter;
  const dayWorkouts = allWorkouts.filter((w) => w.date === d);
  const suppLog = getSupplementLogByDate(d);
  const suppItems = getActiveSupplementItems();
  const checkedSupps = suppItems.filter((item) => (suppLog.checkedIds || []).includes(item.id));
  const dayInbody = getActiveInBodyRecords().find((r) => r.date === d);

  card.classList.remove('hidden');
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong>📅 ${formatKoreanDate(d)} 요약</strong>
      <span class="text-secondary" style="font-size:12px">운동 ${dayWorkouts.length}건 · 보충제 ${checkedSupps.length}개</span>
    </div>
    ${
      dayWorkouts.length
        ? dayWorkouts
            .map(
              (w) => `
          <div style="font-size:13px;">
            💪 <strong>${escapeHtml(w.title)}</strong> — ${(w.exercises || []).map((e) => escapeHtml(e.name)).join(', ')}
            (<span class="text-blue tabular">${Math.round(w.totalVolume || 0).toLocaleString('ko-KR')} kg</span>)
          </div>
        `
            )
            .join('')
        : '<div class="text-muted" style="font-size:12px">이 날짜에는 완료한 운동 기록이 없습니다.</div>'
    }
    <div class="day-supp-badges">
      ${
        checkedSupps.length
          ? checkedSupps.map((s) => `<span class="day-supp-badge">💊 ${escapeHtml(s.name)}</span>`).join('')
          : '<span class="text-muted" style="font-size:12px">체크한 보충제 없음</span>'
      }
    </div>
    ${
      dayInbody
        ? `<div class="text-secondary tabular" style="font-size:12px">⚖️ 체중 ${dayInbody.weightKg ?? '-'}kg · 골격근 ${dayInbody.muscleMassKg ?? '-'}kg · 체지방 ${dayInbody.bodyFatPct ?? '-'}%</div>`
        : ''
    }
  `;
}

function renderInBodyKPIs(records) {
  const setKpi = (valId, deltaId, key, unit) => {
    const valid = records.filter((r) => Number.isFinite(Number(r[key])) && Number(r[key]) > 0);
    const valEl = document.getElementById(valId);
    const deltaEl = document.getElementById(deltaId);
    if (!valid.length) {
      valEl.textContent = `- ${unit}`;
      deltaEl.textContent = '기록 없음';
      return;
    }
    valEl.textContent = `${valid[0][key]} ${unit}`;
    if (valid.length >= 2) {
      const diff = Math.round((valid[0][key] - valid[1][key]) * 10) / 10;
      const sign = diff > 0 ? '+' : '';
      deltaEl.textContent = `직전 대비 ${sign}${diff}${unit}`;
    } else {
      deltaEl.textContent = '첫 기록';
    }
  };
  setKpi('inbody-kpi-weight', 'inbody-delta-weight', 'weightKg', 'kg');
  setKpi('inbody-kpi-muscle', 'inbody-delta-muscle', 'muscleMassKg', 'kg');
  setKpi('inbody-kpi-fat', 'inbody-delta-fat', 'bodyFatPct', '%');
}

function renderSettingsView() {
  const s = state.settings;
  document.getElementById('input-script-url').value = s.scriptUrl || DEFAULT_SCRIPT_URL;
  document.getElementById('toggle-auto-sync').checked = Boolean(s.autoSync);
  document.getElementById('toggle-auto-timer').checked = Boolean(s.autoStartRest);
  document.getElementById('toggle-timer-sound').checked = Boolean(s.timerSound);

  document.querySelectorAll('#default-rest-group .preset-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.rest) === Number(s.defaultRestSec));
  });
  const customDefaultInput = document.getElementById('input-custom-default-rest');
  if (customDefaultInput) {
    customDefaultInput.value = s.defaultRestSec || 90;
  }
  applyTheme(s.theme);
}

// ===== 바벨 원판 계산기 =====
function renderPlateCalculator() {
  const target = Number(document.getElementById('plate-target-input').value) || 0;
  const bar = Number(document.getElementById('plate-bar-select').value) || 20;
  const include25 = document.getElementById('plate-include-25').checked;

  const res = calculateBarbellPlates(target, bar, include25);
  const visualEl = document.getElementById('plate-visual');
  const summaryEl = document.getElementById('plate-summary-list');

  if (target <= bar) {
    visualEl.innerHTML = '<div class="text-secondary" style="font-size:13px">빈 바벨 무게보다 큰 목표 무게를 입력해 주세요.</div>';
    summaryEl.innerHTML = `<div class="plate-count-pill">빈 바벨만 사용: ${bar}kg</div>`;
    return;
  }

  const sideDiscs = [];
  for (const p of res.plates) {
    for (let i = 0; i < p.count; i++) {
      sideDiscs.push(
        `<div class="plate-disc" style="background:${p.color};height:${p.height}px;width:${p.width}px">${p.weight}</div>`
      );
    }
  }
  const leftSide = [...sideDiscs].reverse().join('');
  const rightSide = sideDiscs.join('');

  visualEl.innerHTML = `
    <div class="plates-side">${leftSide}</div>
    <div class="barbell-sleeve"></div>
    <div class="barbell-shaft"></div>
    <div class="barbell-sleeve"></div>
    <div class="plates-side">${rightSide}</div>
  `;

  summaryEl.innerHTML = `
    <div class="plate-count-pill">총 ${res.actualTotal}kg (바 ${res.barWeight}kg + 양쪽 각 ${res.perSideWeight}kg)</div>
    ${res.plates
      .map(
        (p) => `
      <div class="plate-count-pill">
        <span class="plate-color-dot" style="background:${p.color}"></span>
        <span>${p.weight}kg × <strong>${p.count}장</strong> (한쪽)</span>
      </div>
    `
      )
      .join('')}
    ${res.remainder > 0 ? `<div class="plate-count-pill text-amber">미달 ${res.remainder}kg (1.25kg 미만)</div>` : ''}
  `;
}

// ===== 종목 선택 모달 =====
function openExercisePicker(mode) {
  state.pickerMode = mode;
  state.pickerMuscle = '전체';
  document.getElementById('picker-search-input').value = '';
  document.getElementById('custom-ex-name').value = '';
  renderExercisePickerList();
  openModal('modal-exercise-picker');
}

function renderExercisePickerList() {
  const chipsContainer = document.getElementById('picker-muscle-chips');
  const muscles = ['전체', ...Object.keys(MUSCLE_GROUPS)];
  chipsContainer.innerHTML = muscles
    .map(
      (m) =>
        `<button class="filter-chip ${state.pickerMuscle === m ? 'active' : ''}" type="button" data-picker-muscle="${m}">${m}</button>`
    )
    .join('');

  const query = document.getElementById('picker-search-input').value.trim().toLowerCase();
  const filtered = getAllExercises().filter((ex) => {
    const matchMuscle = state.pickerMuscle === '전체' || ex.muscle === state.pickerMuscle;
    const matchQuery = !query || ex.name.toLowerCase().includes(query) || ex.muscle.includes(query);
    return matchMuscle && matchQuery;
  });

  const listEl = document.getElementById('picker-list');
  if (!filtered.length) {
    listEl.innerHTML = '<div class="chart-empty">검색 결과가 없습니다. 아래에서 직접 추가해 보세요.</div>';
    return;
  }

  listEl.innerHTML = filtered
    .map((ex) => {
      const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
      const tType = inferTrackingType(ex);
      const tLabel = tType === 'bodyweight_reps' ? '맨몸·횟수' : tType === 'bodyweight_time' ? '맨몸·시간' : '';
      return `
        <button class="picker-item" type="button" data-pick-ex-name="${escapeHtml(ex.name)}" data-pick-ex-muscle="${escapeHtml(ex.muscle)}" data-pick-ex-tracking="${tType}">
          <span>${escapeHtml(ex.name)} ${tLabel ? `<span class="bw-pill">${tLabel}</span>` : ''}</span>
          <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg}">${escapeHtml(ex.muscle)}</span>
        </button>
      `;
    })
    .join('');
}

function addExerciseToTarget(name, muscle, trackingType = 'weighted') {
  if (state.pickerMode === 'routine' && state.editingRoutine) {
    state.editingRoutine.exercises.push({
      name,
      muscle,
      trackingType,
      targetSets: 3,
      defaultReps: 10,
      defaultDurationSec: 60,
      defaultWeight: trackingType === 'weighted' ? 20 : 0,
      restSec: state.settings.defaultRestSec || 90
    });
    renderRoutineEditorList();
    closeModal('modal-exercise-picker');
    return;
  }

  const last = getLastExerciseRecord(name);
  const defaultWeight = last?.bestSet?.weight ?? (trackingType === 'weighted' ? 20 : 0);
  const defaultReps = last?.bestSet?.reps ?? 10;
  const defaultDur = last?.bestSet?.durationSec ?? 60;

  state.draft.exercises.push({
    id: uid('ex'),
    name,
    muscle,
    trackingType,
    restSec: state.settings.defaultRestSec || 90,
    sets: [1, 2, 3].map(() => ({
      id: uid('set'),
      weight: defaultWeight,
      reps: defaultReps,
      durationSec: defaultDur,
      setType: 'normal',
      completed: false
    }))
  });
  saveDraft(state.draft);
  renderWorkoutView();
  closeModal('modal-exercise-picker');
  showToast(`"${name}" 종목이 추가되었습니다.`);
}

// ===== 루틴 편집 모달 =====
function openRoutineEditor(routine = null) {
  if (routine) {
    state.editingRoutine = JSON.parse(JSON.stringify(routine));
    document.getElementById('routine-editor-title').textContent = '루틴 수정';
  } else {
    state.editingRoutine = {
      id: uid('routine'),
      name: '',
      split: '커스텀',
      description: '',
      isDefault: false,
      deleted: false,
      exercises: []
    };
    document.getElementById('routine-editor-title').textContent = '새 루틴 만들기';
  }

  document.getElementById('routine-name-input').value = state.editingRoutine.name || '';
  document.getElementById('routine-split-select').value = state.editingRoutine.split || '커스텀';
  document.getElementById('routine-desc-input').value = state.editingRoutine.description || '';
  renderRoutineEditorList();
  openModal('modal-routine-editor');
}

function renderRoutineEditorList() {
  const container = document.getElementById('routine-editor-exercises');
  const list = state.editingRoutine?.exercises || [];
  if (!list.length) {
    container.innerHTML = '<div class="chart-empty">"+ 종목 추가"를 눌러 루틴에 넣을 운동을 고르세요.</div>';
    return;
  }

  container.innerHTML = list
    .map((ex, idx) => {
      const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
      return `
        <div class="routine-editor-row" data-r-ex-idx="${idx}">
          <div class="routine-editor-row-top">
            <div>
              <strong>${escapeHtml(ex.name)}</strong>
              <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg};margin-left:6px">${escapeHtml(ex.muscle)}</span>
            </div>
            <button class="icon-btn" type="button" data-action="remove-routine-ex" data-r-ex-idx="${idx}">✕</button>
          </div>
          <div class="routine-editor-fields">
            <label class="mini-field">목표 세트
              <input type="number" min="1" max="20" value="${ex.targetSets || 3}" data-r-field="targetSets" data-r-ex-idx="${idx}">
            </label>
            <label class="mini-field">기본 무게(kg)
              <input type="number" min="0" step="0.5" value="${ex.defaultWeight ?? 20}" data-r-field="defaultWeight" data-r-ex-idx="${idx}">
            </label>
            <label class="mini-field">기본 횟수/초
              <input type="number" min="1" value="${ex.defaultReps || ex.defaultDurationSec || 10}" data-r-field="defaultReps" data-r-ex-idx="${idx}">
            </label>
          </div>
        </div>
      `;
    })
    .join('');
}

// ===== 운동 일지 상세 모달 =====
function openWorkoutDetail(workoutId) {
  const w = getActiveWorkouts().find((item) => item.id === workoutId);
  if (!w) return;
  state.viewingWorkoutId = workoutId;

  const stats = calcWorkoutStats(w.exercises);
  const mins = Math.max(1, Math.round((Number(w.durationSec) || 0) / 60));
  document.getElementById('detail-title').textContent = w.title || '운동 일지';
  document.getElementById('detail-subtitle').textContent = `${formatKoreanDate(w.date)} · ${mins}분 · 총 볼륨 ${Math.round(stats.totalVolume).toLocaleString('ko-KR')} kg`;

  document.getElementById('detail-body').innerHTML = (w.exercises || [])
    .map((ex) => {
      const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
      const tracking = inferTrackingType(ex);
      return `
        <div class="detail-ex-block">
          <div class="detail-ex-title">
            <span>${escapeHtml(ex.name)}</span>
            <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg}">${escapeHtml(ex.muscle)}</span>
          </div>
          ${(ex.sets || [])
            .map((s, idx) => {
              const typeBadge = s.setType === 'warmup' ? '[W] ' : s.setType === 'drop' ? '[D] ' : '';
              const desc =
                tracking === 'bodyweight_time'
                  ? `${Number(s.weight) > 0 ? `+${s.weight}kg · ` : ''}${s.durationSec || 0}초`
                  : tracking === 'bodyweight_reps'
                  ? `${Number(s.weight) > 0 ? `+${s.weight}kg × ` : '맨몸 '}${s.reps || 0}회`
                  : `${s.weight}kg × ${s.reps}회 · 추정 1RM ${calcEst1RM(s.weight, s.reps)}kg`;
              return `
                <div class="detail-set-line">
                  <span>${typeBadge}${idx + 1}세트 ${s.completed ? '✓' : '(미완료)'}</span>
                  <span class="tabular">${desc}</span>
                </div>
              `;
            })
            .join('')}
        </div>
      `;
    })
    .join('');

  openModal('modal-workout-detail');
}

// ===== 동기화 =====
async function runSync({ silent = false } = {}) {
  if (state.isSyncing || !state.session || state.session.isDemo) return;
  if (!navigator.onLine) {
    renderSyncIndicators();
    if (!silent) showToast('오프라인 상태입니다. 기기에 안전하게 저장되었으며 연결 시 자동 동기화됩니다.');
    return;
  }

  state.isSyncing = true;
  renderSyncIndicators();
  const feedbackEl = document.getElementById('sync-feedback');

  try {
    const res = await syncWithGoogleSheets(state.settings, state.session);
    if (!document.activeElement?.closest('#workout-exercises-list')) {
      renderWorkoutView();
    }
    renderRoutinesView();
    renderDailyView();
    renderHistoryView();
    if (feedbackEl && !silent) {
      feedbackEl.className = 'sync-feedback ok';
      feedbackEl.textContent = `동기화 완료! (${state.session.nickname}님 기록 ${res.workoutsCount}건, 루틴 ${res.routinesCount}건)`;
      feedbackEl.classList.remove('hidden');
    }
    if (!silent) showToast('구글 시트 동기화가 완료되었습니다.', 'success');
  } catch (err) {
    // 오프라인/지연/일시 오류여도 자동 로그인 세션은 절대 해제하지 않음
    saveSyncMeta({ status: 'error', message: err.message });
    if (feedbackEl && !silent) {
      feedbackEl.className = 'sync-feedback err';
      feedbackEl.textContent = err.message;
      feedbackEl.classList.remove('hidden');
    }
    if (!silent) showToast(err.message, 'error');
  } finally {
    state.isSyncing = false;
    renderSyncIndicators();
  }
}

function triggerAutoSync() {
  if (state.session && !state.session.isDemo && state.settings.autoSync && navigator.onLine) {
    runSync({ silent: true });
  }
}

function startElapsedClock() {
  renderWorkoutTimerUI();
  window.setInterval(() => {
    if (state.draft?.timerRunning) {
      renderWorkoutTimerUI();
    }
  }, 1000);
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${tab}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  if (tab === 'history') renderHistoryView();
  if (tab === 'routines') renderRoutinesView();
  if (tab === 'daily') renderDailyView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  document.addEventListener('pointerdown', () => restTimer.unlockAudio(), { once: true });
  window.addEventListener('online', () => {
    renderSyncIndicators();
    triggerAutoSync();
  });
  window.addEventListener('offline', () => renderSyncIndicators());

  // 인증 화면 탭 전환 & 폼 제출
  document.querySelectorAll('[data-auth-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.authMode = btn.dataset.authMode;
      document.getElementById('auth-tab-register').classList.toggle('active', state.authMode === 'register');
      document.getElementById('auth-tab-login').classList.toggle('active', state.authMode === 'login');
      document.getElementById('btn-auth-submit').textContent =
        state.authMode === 'register' ? '닉네임 등록하고 시작하기' : '내 기록 불러오기';
      document.getElementById('auth-feedback').classList.add('hidden');
    });
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nickname = document.getElementById('auth-nickname').value.trim();
    const pin = document.getElementById('auth-pin').value.trim();
    const feedback = document.getElementById('auth-feedback');
    const submitBtn = document.getElementById('btn-auth-submit');

    if (nickname.length < 2 || nickname.length > 12) {
      feedback.className = 'sync-feedback err';
      feedback.textContent = '닉네임은 2~12자로 입력해 주세요.';
      feedback.classList.remove('hidden');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      feedback.className = 'sync-feedback err';
      feedback.textContent = 'PIN은 숫자 4자리로 입력해 주세요.';
      feedback.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    feedback.className = 'sync-feedback';
    feedback.textContent = '구글 시트와 확인 중입니다...';
    feedback.classList.remove('hidden');

    try {
      if (state.authMode === 'register') {
        await registerUser(state.settings.scriptUrl, nickname, pin);
        const session = { nickname, pin, isDemo: false, loggedInAt: new Date().toISOString() };
        enterApp(session, { autoSyncOnStart: true });
        showToast(`${nickname}님 환영합니다! 구글 시트에 계정이 등록되었습니다.`, 'success');
      } else {
        const res = await loginUser(state.settings.scriptUrl, nickname, pin);
        const session = { nickname: res.nickname || nickname, pin, isDemo: false, loggedInAt: new Date().toISOString() };
        setSession(session);
        initUserStorage(session.nickname, { seedDemo: false });
        if (Array.isArray(res.workouts)) saveAllWorkoutsRaw(mergeById(getAllWorkoutsRaw(), res.workouts));
        if (Array.isArray(res.routines)) saveAllRoutinesRaw(mergeById(getAllRoutinesRaw(), res.routines));
        if (Array.isArray(res.supplementItems)) saveAllSupplementItemsRaw(mergeById(getAllSupplementItemsRaw(), res.supplementItems));
        if (Array.isArray(res.supplementLogs)) saveAllSupplementLogsRaw(mergeById(getAllSupplementLogsRaw(), res.supplementLogs));
        if (Array.isArray(res.inbodyRecords)) saveAllInBodyRaw(mergeById(getAllInBodyRaw(), res.inbodyRecords));
        saveSyncMeta({ lastSyncAt: new Date().toISOString(), status: 'synced', message: '로그인 불러오기 완료' });
        enterApp(session, { autoSyncOnStart: false });
        showToast(`${session.nickname}님의 기록을 불러왔습니다!`, 'success');
      }
    } catch (err) {
      feedback.className = 'sync-feedback err';
      feedback.textContent = err.message;
      feedback.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('btn-auth-demo').addEventListener('click', () => {
    enterApp({ nickname: '체험모드', pin: '0000', isDemo: true, loggedInAt: new Date().toISOString() });
    showToast('체험 모드로 시작합니다. 샘플 데이터가 준비되어 있습니다.');
  });

  // 하단 탭 & 상단 툴 버튼
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('sync-pill').addEventListener('click', () => {
    if (state.session?.isDemo) switchTab('settings');
    else runSync();
  });
  document.getElementById('btn-goto-routines').addEventListener('click', () => switchTab('routines'));
  document.getElementById('btn-open-plate-calc').addEventListener('click', () => {
    renderPlateCalculator();
    openModal('modal-plate-calculator');
  });

  // 바벨 원판 계산기
  document.getElementById('plate-target-input').addEventListener('input', renderPlateCalculator);
  document.getElementById('plate-bar-select').addEventListener('change', renderPlateCalculator);
  document.getElementById('plate-include-25').addEventListener('change', renderPlateCalculator);
  document.getElementById('plate-quick-weights').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plate-w]');
    if (!btn) return;
    document.getElementById('plate-target-input').value = btn.dataset.plateW;
    renderPlateCalculator();
  });

  // 모달 닫기
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  // 운동 헤더 & 저장
  document.getElementById('workout-title-input').addEventListener('input', (e) => {
    state.draft.title = e.target.value;
    saveDraft(state.draft);
  });
  document.getElementById('workout-date-input').addEventListener('change', (e) => {
    state.draft.date = e.target.value || toLocalDateStr();
    saveDraft(state.draft);
  });
  document.getElementById('btn-reset-draft').addEventListener('click', () => {
    state.draft = clearDraft();
    renderWorkoutView();
    showToast('현재 운동 작성을 초기화했습니다.');
  });
  document.getElementById('btn-finish-workout').addEventListener('click', () => {
    const stats = calcWorkoutStats(state.draft.exercises);
    if (stats.completedSets === 0) {
      showToast('최소 1세트 이상 완료(✓) 체크 후 저장해 주세요.', 'error');
      return;
    }
    const durationSec = Math.max(0, getDraftElapsedSec(state.draft));
    const finished = {
      id: state.draft.id || uid('w'),
      date: state.draft.date || toLocalDateStr(),
      title: (state.draft.title || '').trim() || '오늘의 운동',
      routineId: state.draft.routineId || null,
      durationSec,
      totalVolume: stats.totalVolume,
      totalSets: stats.completedSets,
      exercises: state.draft.exercises,
      updatedAt: new Date().toISOString(),
      deleted: false
    };
    upsertWorkout(finished);
    state.draft = clearDraft();
    restTimer.stop();
    renderAll();
    switchTab('history');
    showToast(`운동 완료! 총 볼륨 ${Math.round(stats.totalVolume).toLocaleString('ko-KR')} kg 저장됨`, 'success');
    triggerAutoSync();
  });

  // 운동 경과 스톱워치 제어
  document.getElementById('btn-toggle-workout-timer').addEventListener('click', () => {
    if (state.draft?.timerRunning) pauseWorkoutTimer();
    else startWorkoutTimer();
  });
  document.getElementById('btn-reset-workout-timer').addEventListener('click', () => {
    resetWorkoutTimer();
  });

  // 빠른 휴식 & 알림음
  document.querySelectorAll('[data-quick-rest]').forEach((btn) => {
    btn.addEventListener('click', () => restTimer.start(Number(btn.dataset.quickRest)));
  });
  document.getElementById('btn-quick-custom-rest').addEventListener('click', () => {
    openCustomRestModal('quick', state.settings.defaultRestSec || 30);
  });
  document.getElementById('custom-rest-chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-set-custom-rest]');
    if (!btn) return;
    document.getElementById('custom-rest-sec-input').value = btn.dataset.setCustomRest;
  });
  document.getElementById('btn-confirm-custom-rest').addEventListener('click', () => {
    const raw = Number(document.getElementById('custom-rest-sec-input').value);
    const sec = Math.max(5, Math.min(600, Math.round(raw || 0)));
    if (!Number.isFinite(raw) || raw < 5 || raw > 600) {
      showToast('휴식 시간은 5~600초 사이로 입력해 주세요.', 'error');
      return;
    }
    if (state.customRestTarget === 'quick') {
      closeModal('modal-custom-rest');
      restTimer.start(sec);
      showToast(`${sec}초 휴식 타이머를 시작했습니다.`);
    } else if (typeof state.customRestTarget === 'number') {
      const ex = state.draft.exercises[state.customRestTarget];
      if (ex) {
        ex.restSec = sec;
        saveDraft(state.draft);
        renderWorkoutView();
        showToast(`"${ex.name}" 휴식 시간이 ${sec}초로 설정되었습니다.`, 'success');
      }
      closeModal('modal-custom-rest');
    }
  });
  const toggleSound = () => {
    const next = !state.settings.timerSound;
    state.settings = saveSettings({ timerSound: next });
    restTimer.setSoundEnabled(next);
    renderSoundButtons();
    renderSettingsView();
    showToast(next ? '휴식 종료 알림음이 켜졌습니다.' : '휴식 종료 알림음이 꺼졌습니다.');
  };
  document.getElementById('btn-inline-sound').addEventListener('click', toggleSound);
  document.getElementById('btn-rest-sound-toggle').addEventListener('click', toggleSound);
  document.getElementById('btn-rest-minus').addEventListener('click', () => restTimer.adjust(-15));
  document.getElementById('btn-rest-plus').addEventListener('click', () => restTimer.adjust(15));
  document.getElementById('btn-rest-skip').addEventListener('click', () => restTimer.stop());

  document.getElementById('btn-add-exercise').addEventListener('click', () => openExercisePicker('workout'));

  // 운동 세트 입력 위임 (포커스 유실 방지)
  const exList = document.getElementById('workout-exercises-list');
  exList.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    if (action !== 'edit-weight' && action !== 'edit-reps' && action !== 'edit-duration') return;

    const exIdx = Number(target.dataset.exIdx);
    const setIdx = Number(target.dataset.setIdx);
    const ex = state.draft.exercises[exIdx];
    const set = ex?.sets?.[setIdx];
    if (!set) return;

    const num = Math.max(0, Number(target.value) || 0);
    if (action === 'edit-weight') set.weight = num;
    else if (action === 'edit-reps') set.reps = num;
    else set.durationSec = num;

    saveDraft(state.draft);

    const tracking = inferTrackingType(ex);
    const row = target.closest('.set-row');
    const rmEl = row?.querySelector('[data-role="set-1rm"]');
    if (rmEl) {
      if (tracking === 'weighted') {
        const rm = calcEst1RM(set.weight, set.reps);
        rmEl.textContent = rm > 0 ? `${rm}` : '-';
      } else if (tracking === 'bodyweight_reps') {
        rmEl.textContent = set.reps > 0 ? `${set.reps}회` : '-';
      } else {
        rmEl.textContent = set.durationSec > 0 ? `${set.durationSec}초` : '-';
      }
    }

    const prSlot = row?.querySelector('[data-role="pr-badge-slot"]');
    if (prSlot) {
      const prMap = buildExercisePRMap(getActiveWorkouts(), state.draft.id);
      prSlot.innerHTML = isSetPR(set, ex, prMap) ? '<span class="pr-mini-badge">PR</span>' : '';
    }

    const card = target.closest('.exercise-card');
    const exVolEl = card?.querySelector('[data-role="ex-volume"]');
    if (exVolEl) {
      const exVol = ex.sets.reduce((sum, s) => {
        if (!s.completed || s.setType === 'warmup' || tracking === 'bodyweight_time') return sum;
        return sum + calcSetVolume(s.weight, s.reps);
      }, 0);
      exVolEl.textContent = `${Math.round(exVol).toLocaleString('ko-KR')} kg`;
    }

    updateWorkoutSummaryDOM();
  });

  exList.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset.action === 'change-ex-rest') {
      const exIdx = Number(target.dataset.exIdx);
      const ex = state.draft.exercises[exIdx];
      if (!ex) return;
      if (target.value === 'custom') {
        openCustomRestModal(exIdx, ex.restSec || state.settings.defaultRestSec || 60);
        // 취소 시 셀렉트 표시가 '직접 입력...'에 머물지 않도록 기존 값으로 되돌림
        target.value = String(ex.restSec || state.settings.defaultRestSec || 60);
        return;
      }
      ex.restSec = Number(target.value) || 90;
      saveDraft(state.draft);
      showToast(`"${ex.name}" 휴식 시간: ${ex.restSec}초`);
    }
  });

  exList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const exIdx = Number(btn.dataset.exIdx);
    const setIdx = Number(btn.dataset.setIdx);
    const ex = state.draft.exercises[exIdx];
    if (!ex) return;

    if (action === 'cycle-set-type') {
      const set = ex.sets[setIdx];
      if (!set) return;
      const order = ['normal', 'warmup', 'drop'];
      const cur = order.indexOf(set.setType || 'normal');
      set.setType = order[(cur + 1) % order.length];
      saveDraft(state.draft);
      renderWorkoutView();
      const labelMap = { normal: '일반 세트', warmup: '워밍업(W) — 볼륨·1RM 통계 제외', drop: '드롭 세트(D)' };
      showToast(labelMap[set.setType]);
    } else if (action === 'toggle-set') {
      const set = ex.sets[setIdx];
      if (!set) return;
      set.completed = !set.completed;
      if (set.completed && !state.draft.timerRunning && (state.draft.elapsedSec || 0) === 0) {
        state.draft.startedAt = Date.now();
        state.draft.timerRunning = true;
      }
      saveDraft(state.draft);
      renderWorkoutView();
      if (set.completed) {
        const prMap = buildExercisePRMap(getActiveWorkouts(), state.draft.id);
        if (isSetPR(set, ex, prMap)) {
          showToast(`🔥 ${ex.name} 신기록(PR) 달성!`, 'success');
        }
        if (state.settings.autoStartRest) {
          restTimer.start(ex.restSec || state.settings.defaultRestSec || 90);
        }
      }
    } else if (action === 'add-set') {
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        id: uid('set'),
        weight: prev ? prev.weight : 0,
        reps: prev ? prev.reps : 10,
        durationSec: prev ? prev.durationSec || 60 : 60,
        setType: 'normal',
        completed: false
      });
      saveDraft(state.draft);
      renderWorkoutView();
    } else if (action === 'remove-set') {
      if (ex.sets.length <= 1) {
        showToast('최소 1세트는 남겨두어야 합니다.');
        return;
      }
      ex.sets.splice(setIdx, 1);
      saveDraft(state.draft);
      renderWorkoutView();
    } else if (action === 'remove-ex') {
      state.draft.exercises.splice(exIdx, 1);
      saveDraft(state.draft);
      renderWorkoutView();
    }
  });

  // 루틴 액션
  const handleRoutineClicks = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const routine = getActiveRoutines().find((r) => r.id === btn.dataset.routineId);
    if (!routine) return;

    if (action === 'start-routine') {
      state.draft = buildDraftFromRoutine(routine);
      saveDraft(state.draft);
      renderWorkoutView();
      switchTab('workout');
      showToast(`"${routine.name}" 루틴을 불러왔습니다!`, 'success');
    } else if (action === 'edit-routine') {
      openRoutineEditor(routine);
    } else if (action === 'duplicate-routine') {
      const copy = {
        ...JSON.parse(JSON.stringify(routine)),
        id: uid('routine'),
        name: `${routine.name} (복사본)`,
        isDefault: false,
        split: routine.split || '커스텀'
      };
      upsertRoutine(copy);
      renderRoutinesView();
      renderWorkoutView();
      showToast('루틴을 복제했습니다.');
      triggerAutoSync();
    } else if (action === 'delete-routine') {
      softDeleteRoutine(routine.id);
      renderRoutinesView();
      renderWorkoutView();
      showToast('커스텀 루틴을 삭제했습니다.');
      triggerAutoSync();
    }
  };
  document.getElementById('quick-routines-grid').addEventListener('click', handleRoutineClicks);
  document.getElementById('routines-list').addEventListener('click', handleRoutineClicks);
  document.getElementById('routine-filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-split]');
    if (!chip) return;
    state.routineFilter = chip.dataset.split;
    renderRoutinesView();
  });
  document.getElementById('btn-new-routine').addEventListener('click', () => openRoutineEditor(null));

  // 루틴 에디터
  document.getElementById('btn-routine-add-ex').addEventListener('click', () => openExercisePicker('routine'));
  document.getElementById('routine-editor-exercises').addEventListener('input', (e) => {
    const field = e.target.dataset.rField;
    const idx = Number(e.target.dataset.rExIdx);
    if (!field || !state.editingRoutine?.exercises?.[idx]) return;
    state.editingRoutine.exercises[idx][field] = Number(e.target.value) || 0;
  });
  document.getElementById('routine-editor-exercises').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-routine-ex"]');
    if (!btn) return;
    state.editingRoutine.exercises.splice(Number(btn.dataset.rExIdx), 1);
    renderRoutineEditorList();
  });
  document.getElementById('btn-save-routine').addEventListener('click', () => {
    const name = document.getElementById('routine-name-input').value.trim();
    if (!name) return showToast('루틴 이름을 입력해 주세요.', 'error');
    if (!state.editingRoutine.exercises.length) return showToast('최소 1개 이상의 종목을 추가해 주세요.', 'error');
    state.editingRoutine.name = name;
    state.editingRoutine.split = document.getElementById('routine-split-select').value;
    state.editingRoutine.description = document.getElementById('routine-desc-input').value.trim();
    upsertRoutine(state.editingRoutine);
    closeModal('modal-routine-editor');
    renderRoutinesView();
    renderWorkoutView();
    showToast(`"${name}" 루틴이 저장되었습니다.`, 'success');
    triggerAutoSync();
  });

  // 종목 선택 모달
  document.getElementById('picker-search-input').addEventListener('input', renderExercisePickerList);
  document.getElementById('picker-muscle-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-picker-muscle]');
    if (!chip) return;
    state.pickerMuscle = chip.dataset.pickerMuscle;
    renderExercisePickerList();
  });
  document.getElementById('picker-list').addEventListener('click', (e) => {
    const item = e.target.closest('[data-pick-ex-name]');
    if (!item) return;
    addExerciseToTarget(item.dataset.pickExName, item.dataset.pickExMuscle, item.dataset.pickExTracking || 'weighted');
  });
  document.getElementById('btn-add-custom-ex').addEventListener('click', () => {
    const name = document.getElementById('custom-ex-name').value.trim();
    const muscle = document.getElementById('custom-ex-muscle').value;
    const tracking = document.getElementById('custom-ex-tracking').value;
    if (!name) return showToast('직접 추가할 종목명을 입력해 주세요.', 'error');
    const created = addCustomExercise(name, muscle, tracking);
    if (created) addExerciseToTarget(created.name, created.muscle, created.trackingType);
  });

  // 데일리 탭 (보충제 + 인바디)
  document.getElementById('daily-date-input').addEventListener('change', (e) => {
    state.dailyDate = e.target.value || toLocalDateStr();
    renderDailyView();
  });
  document.getElementById('btn-add-supplement').addEventListener('click', () => {
    document.getElementById('supp-name-input').value = '';
    document.getElementById('supp-time-input').value = '';
    openModal('modal-add-supplement');
  });
  document.getElementById('btn-save-supplement').addEventListener('click', () => {
    const name = document.getElementById('supp-name-input').value.trim();
    const timeHint = document.getElementById('supp-time-input').value.trim();
    if (!name) return showToast('보충제 이름을 입력해 주세요.', 'error');
    upsertSupplementItem({
      id: uid('supp'),
      name,
      timeHint,
      isDefault: false,
      deleted: false
    });
    closeModal('modal-add-supplement');
    renderDailyView();
    showToast(`"${name}" 항목이 추가되었습니다.`, 'success');
    triggerAutoSync();
  });
  document.getElementById('daily-supp-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.suppId;
    if (btn.dataset.action === 'toggle-supp') {
      toggleSupplementCheck(state.dailyDate, id);
      renderDailyView();
      renderHistoryView();
      triggerAutoSync();
    } else if (btn.dataset.action === 'delete-supp') {
      softDeleteSupplementItem(id);
      renderDailyView();
      showToast('보충제 항목을 삭제했습니다.');
      triggerAutoSync();
    }
  });
  document.getElementById('btn-save-inbody').addEventListener('click', () => {
    const weightKg = Number(document.getElementById('inbody-weight').value);
    const muscleMassKg = Number(document.getElementById('inbody-muscle').value);
    const bodyFatPct = Number(document.getElementById('inbody-fat').value);
    const memo = document.getElementById('inbody-memo').value.trim();

    if (!weightKg && !muscleMassKg && !bodyFatPct) {
      return showToast('체중, 골격근량, 체지방률 중 최소 하나를 입력해 주세요.', 'error');
    }
    upsertInBodyRecord({
      id: `inbody_${state.dailyDate}`,
      date: state.dailyDate,
      weightKg: weightKg > 0 ? weightKg : null,
      muscleMassKg: muscleMassKg > 0 ? muscleMassKg : null,
      bodyFatPct: bodyFatPct > 0 ? bodyFatPct : null,
      memo
    });
    renderDailyView();
    renderHistoryView();
    showToast(`${formatKoreanDate(state.dailyDate)} 인바디 기록을 저장했습니다.`, 'success');
    triggerAutoSync();
  });
  document.getElementById('inbody-recent-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete-inbody"]');
    if (!btn) return;
    softDeleteInBodyRecord(btn.dataset.inbodyId);
    renderDailyView();
    renderHistoryView();
    showToast('인바디 기록을 삭제했습니다.');
    triggerAutoSync();
  });

  // 기록·성장 탭
  document.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.historyPeriod = btn.dataset.period;
      renderHistoryView();
    });
  });
  document.querySelectorAll('[data-hist-sub]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.historySubTab = btn.dataset.histSub;
      renderHistoryView();
    });
  });
  document.querySelectorAll('[data-muscle-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.muscleMode = btn.dataset.muscleMode;
      renderHistoryView();
    });
  });
  document.getElementById('select-1rm-exercise').addEventListener('change', (e) => {
    state.selected1RMExercise = e.target.value;
    renderHistoryView();
  });
  document.getElementById('btn-clear-date-filter').addEventListener('click', () => {
    state.selectedDateFilter = null;
    renderHistoryView();
  });
  document.getElementById('history-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="view-workout"]');
    if (btn) openWorkoutDetail(btn.dataset.workoutId);
  });

  // 운동 상세 모달
  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    if (!state.viewingWorkoutId) return;
    softDeleteWorkout(state.viewingWorkoutId);
    closeModal('modal-workout-detail');
    renderHistoryView();
    showToast('운동 기록을 삭제했습니다.');
    triggerAutoSync();
  });
  document.getElementById('btn-detail-repeat').addEventListener('click', () => {
    const w = getActiveWorkouts().find((item) => item.id === state.viewingWorkoutId);
    if (!w) return;
    state.draft = {
      id: uid('w'),
      title: w.title,
      date: toLocalDateStr(),
      routineId: w.routineId || null,
      startedAt: null,
      elapsedSec: 0,
      timerRunning: false,
      exercises: (w.exercises || []).map((ex) => ({
        id: uid('ex'),
        name: ex.name,
        muscle: ex.muscle,
        trackingType: inferTrackingType(ex),
        restSec: ex.restSec || 90,
        sets: (ex.sets || []).map((s) => ({
          id: uid('set'),
          weight: s.weight,
          reps: s.reps,
          durationSec: s.durationSec || 60,
          setType: s.setType || 'normal',
          completed: false
        }))
      }))
    };
    saveDraft(state.draft);
    closeModal('modal-workout-detail');
    renderWorkoutView();
    switchTab('workout');
    showToast('지난 기록 구성으로 오늘 운동을 시작합니다!', 'success');
  });

  // 설정 탭
  document.getElementById('btn-switch-user').addEventListener('click', () => {
    restTimer.stop();
    clearSession();
    showAuthScreen();
  });
  document.getElementById('theme-selector').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme-mode]');
    if (!btn) return;
    const mode = btn.dataset.themeMode;
    state.settings = saveSettings({ theme: mode });
    applyTheme(mode);
    renderHistoryView();
    showToast(`화면 테마가 "${mode === 'light' ? '라이트 모드' : mode === 'dark' ? '다크 모드' : '시스템 설정'}"으로 변경되었습니다.`);
  });
  document.getElementById('input-script-url').addEventListener('change', (e) => {
    state.settings = saveSettings({ scriptUrl: e.target.value.trim() || DEFAULT_SCRIPT_URL });
  });
  document.getElementById('btn-reset-script-url').addEventListener('click', () => {
    state.settings = saveSettings({ scriptUrl: DEFAULT_SCRIPT_URL });
    renderSettingsView();
    showToast('기본 내장 Apps Script URL로 복원했습니다.');
  });
  document.getElementById('toggle-auto-sync').addEventListener('change', (e) => {
    state.settings = saveSettings({ autoSync: e.target.checked });
  });
  document.getElementById('toggle-auto-timer').addEventListener('change', (e) => {
    state.settings = saveSettings({ autoStartRest: e.target.checked });
  });
  document.getElementById('toggle-timer-sound').addEventListener('change', (e) => {
    state.settings = saveSettings({ timerSound: e.target.checked });
    restTimer.setSoundEnabled(e.target.checked);
    renderSoundButtons();
  });
  document.getElementById('default-rest-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rest]');
    if (!btn) return;
    state.settings = saveSettings({ defaultRestSec: Number(btn.dataset.rest) });
    renderSettingsView();
    showToast(`기본 휴식 시간이 ${btn.dataset.rest}초로 설정되었습니다.`);
  });
  document.getElementById('btn-apply-custom-rest').addEventListener('click', () => {
    const raw = Number(document.getElementById('input-custom-default-rest').value);
    if (!Number.isFinite(raw) || raw < 5 || raw > 600) {
      showToast('휴식 시간은 5~600초 사이 숫자로 입력해 주세요.', 'error');
      return;
    }
    const sec = Math.round(raw);
    state.settings = saveSettings({ defaultRestSec: sec });
    renderSettingsView();
    showToast(`기본 휴식 시간이 ${sec}초로 설정되었습니다.`, 'success');
  });
  document.getElementById('btn-test-sound').addEventListener('click', () => {
    const prev = restTimer.soundEnabled;
    restTimer.setSoundEnabled(true);
    restTimer.playChime();
    restTimer.setSoundEnabled(prev);
  });
  document.getElementById('btn-test-sync').addEventListener('click', async () => {
    const feedback = document.getElementById('sync-feedback');
    try {
      const res = await testScriptConnection(state.settings.scriptUrl);
      feedback.className = 'sync-feedback ok';
      feedback.textContent = `연결 성공! (${res.message || '응답 정상'})`;
      feedback.classList.remove('hidden');
      showToast('구글 시트 연결 테스트 성공!', 'success');
    } catch (err) {
      feedback.className = 'sync-feedback err';
      feedback.textContent = err.message;
      feedback.classList.remove('hidden');
      showToast(err.message, 'error');
    }
  });
  document.getElementById('btn-manual-sync').addEventListener('click', () => {
    if (state.session?.isDemo) {
      showToast('체험 모드에서는 시트에 저장되지 않습니다. 사용자 전환 후 로그인해 주세요.', 'error');
      return;
    }
    runSync({ silent: false });
  });

  // 백업 & 초기화
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([exportAllDataJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dayfit-${state.session?.nickname || 'backup'}-${toLocalDateStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('백업 JSON 파일을 다운로드했습니다.', 'success');
  });
  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('input-import-file').click();
  });
  document.getElementById('input-import-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      importAllDataJSON(await file.text());
      renderAll();
      showToast('백업 데이터를 불러왔습니다!', 'success');
    } catch (err) {
      showToast(err.message || '파일을 읽을 수 없습니다.', 'error');
    } finally {
      e.target.value = '';
    }
  });
  document.getElementById('btn-clear-demo').addEventListener('click', () => {
    clearDemoWorkouts();
    renderAll();
    showToast('샘플 데이터를 지웠습니다.');
  });
  document.getElementById('btn-reset-routines').addEventListener('click', () => {
    resetDefaultRoutines();
    renderAll();
    showToast('기본 분할 루틴 4종을 복원했습니다.', 'success');
  });

  // QR코드 공유 & PWA 홈 화면 설치
  document.getElementById('btn-auth-qr').addEventListener('click', openQrShareModal);
  document.getElementById('btn-open-qr-share').addEventListener('click', openQrShareModal);
  document.getElementById('btn-open-install-guide').addEventListener('click', openInstallGuideModal);
  document.getElementById('btn-copy-share-url').addEventListener('click', copyShareUrl);
  document.getElementById('btn-native-share').addEventListener('click', nativeShareUrl);

  document.getElementById('btn-banner-install').addEventListener('click', () => {
    if (state.deferredInstallPrompt) triggerAndroidInstall();
    else openInstallGuideModal();
  });
  document.getElementById('btn-banner-dismiss').addEventListener('click', () => {
    localStorage.setItem('fleekfit_banner_dismissed_at', String(Date.now()));
    document.getElementById('pwa-install-banner').classList.add('hidden');
  });
  document.getElementById('btn-android-install').addEventListener('click', triggerAndroidInstall);
}

function openCustomRestModal(target, initialSec = 30) {
  state.customRestTarget = target;
  const input = document.getElementById('custom-rest-sec-input');
  const subtitle = document.getElementById('custom-rest-subtitle');
  if (input) input.value = String(initialSec || 30);
  if (subtitle) {
    subtitle.textContent =
      target === 'quick'
        ? '입력한 시간(초)으로 휴식 타이머를 바로 시작합니다.'
        : '이 종목의 세트 완료 후 기본 휴식 시간(초)을 설정합니다.';
  }
  openModal('modal-custom-rest');
}

// ===== QR코드 공유 & 홈 화면 설치 도우미 =====
function getShareAppUrl() {
  const { protocol, origin, pathname } = window.location;
  if (protocol === 'https:') {
    return `${origin}${pathname}`;
  }
  return DEFAULT_APP_URL;
}

function openQrShareModal() {
  const url = getShareAppUrl();
  const imgEl = document.getElementById('qr-code-img');
  const fallbackEl = document.getElementById('qr-img-fallback');
  const urlBox = document.getElementById('qr-share-url-text');

  urlBox.textContent = url;
  fallbackEl.classList.add('hidden');
  imgEl.classList.remove('hidden');

  const encoded = encodeURIComponent(url);
  imgEl.dataset.fallbackStep = '0';
  imgEl.onerror = () => {
    if (imgEl.dataset.fallbackStep === '0') {
      imgEl.dataset.fallbackStep = '1';
      imgEl.src = `https://quickchart.io/qr?size=260&margin=2&ecLevel=M&text=${encoded}`;
    } else {
      imgEl.classList.add('hidden');
      fallbackEl.classList.remove('hidden');
    }
  };
  imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&ecc=M&data=${encoded}`;
  openModal('modal-qr-share');
}

async function copyShareUrl() {
  const url = getShareAppUrl();
  try {
    await navigator.clipboard.writeText(url);
    showToast('앱 주소가 복사되었습니다!', 'success');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast('앱 주소가 복사되었습니다!', 'success');
  }
}

async function nativeShareUrl() {
  const url = getShareAppUrl();
  if (navigator.share) {
    try {
      await navigator.share({
        title: '데이핏 (DayFit) — 오늘의 운동일지',
        text: 'QR코드나 링크로 접속해 홈 화면에 추가해 보세요!',
        url
      });
      return;
    } catch {
      // 사용자가 공유 취소 시 무시
      return;
    }
  }
  await copyShareUrl();
}

function getEnvInfo() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isInAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|Line|NAVER/i.test(ua);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true;
  return { isIOS, isAndroid, isInAppBrowser, isStandalone };
}

function initPwaInstallHelper() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    document.getElementById('btn-android-install')?.classList.remove('hidden');
    const bannerBtn = document.getElementById('btn-banner-install');
    if (bannerBtn) bannerBtn.textContent = '바로 설치';
    updateInstallBannerVisibility();
  });

  window.addEventListener('appinstalled', () => {
    state.deferredInstallPrompt = null;
    document.getElementById('pwa-install-banner')?.classList.add('hidden');
    showToast('홈 화면에 데이핏이 설치되었습니다!', 'success');
  });

  updateInstallBannerVisibility();
}

function updateInstallBannerVisibility() {
  const banner = document.getElementById('pwa-install-banner');
  if (!banner) return;

  const { isIOS, isAndroid, isInAppBrowser, isStandalone } = getEnvInfo();
  if (isStandalone) {
    banner.classList.add('hidden');
    return;
  }

  const dismissedAt = Number(localStorage.getItem('fleekfit_banner_dismissed_at') || 0);
  if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
    banner.classList.add('hidden');
    return;
  }

  if (isInAppBrowser) {
    document.getElementById('install-banner-title').textContent = '⚠️ Safari / 외부 브라우저로 열어주세요';
    document.getElementById('install-banner-desc').textContent = '카톡·인스타 브라우저에서는 홈 화면 추가가 안 됩니다.';
    banner.classList.remove('hidden');
    return;
  }

  if (isIOS || isAndroid || state.deferredInstallPrompt) {
    banner.classList.remove('hidden');
  }
}

function openInstallGuideModal() {
  const { isInAppBrowser } = getEnvInfo();
  document.getElementById('inapp-browser-warning')?.classList.toggle('hidden', !isInAppBrowser);
  document.getElementById('btn-android-install')?.classList.toggle('hidden', !state.deferredInstallPrompt);
  openModal('modal-install-guide');
}

async function triggerAndroidInstall() {
  if (!state.deferredInstallPrompt) return openInstallGuideModal();
  state.deferredInstallPrompt.prompt();
  const choice = await state.deferredInstallPrompt.userChoice;
  if (choice?.outcome === 'accepted') {
    state.deferredInstallPrompt = null;
    closeModal('modal-install-guide');
  }
}

bootstrap();
