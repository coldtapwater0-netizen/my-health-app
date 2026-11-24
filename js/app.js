import {
  DEFAULT_ROUTINES,
  MUSCLE_GROUPS,
  calcEst1RM,
  calcSetVolume,
  calcWorkoutStats,
  formatKoreanDate,
  toLocalDateStr
} from './data.js';
import {
  addCustomExercise,
  clearDemoWorkouts,
  clearDraft,
  exportAllDataJSON,
  getActiveRoutines,
  getActiveWorkouts,
  getAllExercises,
  getDraft,
  getLastExerciseRecord,
  getSettings,
  getSyncMeta,
  importAllDataJSON,
  initStorage,
  resetDefaultRoutines,
  saveDraft,
  saveSettings,
  saveSyncMeta,
  softDeleteRoutine,
  softDeleteWorkout,
  upsertRoutine,
  upsertWorkout
} from './storage.js';
import { RestTimer, formatMMSS } from './timer.js';
import { syncWithGoogleSheets, testScriptConnection } from './sync.js';
import {
  render1RMChart,
  renderCalendar,
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

// 앱 상태
const state = {
  activeTab: 'workout',
  draft: null,
  settings: null,
  routineFilter: '전체',
  historyPeriod: '30', // '30' | 'all'
  muscleMode: 'sets', // 'sets' | 'volume'
  selected1RMExercise: '',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  selectedDateFilter: null,
  pickerMode: 'workout', // 'workout' | 'routine'
  pickerMuscle: '전체',
  editingRoutine: null,
  viewingWorkoutId: null,
  isSyncing: false
};

// 휴식 타이머
const restTimer = new RestTimer({
  onTick: (info) => renderRestTimerBar(info),
  onComplete: () => {
    showToast('휴식 시간이 끝났습니다! 다음 세트를 시작하세요.', 'success');
    renderRestTimerBar({ running: false, remainingSec: 0, totalSec: 90, progress: 0 });
  }
});

// ===== 초기화 =====
function bootstrap() {
  initStorage();
  state.settings = getSettings();
  restTimer.setSoundEnabled(state.settings.timerSound);

  // 최초 방문 시 상체 푸시 기본 세션을 미리 세팅해 바로 체험 가능하도록 구성
  if (localStorage.getItem('fleekfit_draft_v1') === null) {
    state.draft = buildDraftFromRoutine(DEFAULT_ROUTINES[0]);
    saveDraft(state.draft);
  } else {
    state.draft = getDraft();
  }

  bindEvents();
  renderAll();
  startElapsedClock();
  registerServiceWorker();

  // 구글 시트 URL + 자동 동기화 켜져 있으면 시작 시 동기화
  if (state.settings.scriptUrl && state.settings.autoSync && navigator.onLine) {
    runSync({ silent: true });
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ===== 토스트 & 모달 =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, 2800);
}

function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

// ===== 루틴 → 운동 초안 변환 =====
function buildDraftFromRoutine(routine) {
  const defaultRest = state.settings?.defaultRestSec || 90;
  const exercises = (routine.exercises || []).map((ex) => {
    const last = getLastExerciseRecord(ex.name);
    const count = Math.max(1, Number(ex.targetSets) || 3);
    const sets = [];
    for (let i = 0; i < count; i++) {
      const refSet = last?.sets?.[i] || last?.sets?.[last.sets.length - 1];
      sets.push({
        id: uid('set'),
        weight: refSet ? refSet.weight : Number(ex.defaultWeight) || 0,
        reps: refSet ? refSet.reps : Number(ex.defaultReps) || 10,
        completed: false
      });
    }
    return {
      id: uid('ex'),
      name: ex.name,
      muscle: ex.muscle || '코어',
      restSec: Number(ex.restSec) || defaultRest,
      sets
    };
  });

  return {
    id: uid('w'),
    title: routine.name,
    date: toLocalDateStr(),
    routineId: routine.id,
    startedAt: Date.now(),
    exercises
  };
}

// ===== 렌더링 =====
function renderAll() {
  renderSyncIndicators();
  renderWorkoutView();
  renderRoutinesView();
  renderHistoryView();
  renderSettingsView();
  renderSoundButtons();
}

function renderSyncIndicators() {
  const meta = getSyncMeta();
  const pill = document.getElementById('sync-pill');
  const pillText = document.getElementById('sync-pill-text');
  const statusBadge = document.getElementById('settings-sync-status');
  const lastSyncEl = document.getElementById('settings-last-sync');

  pill.classList.remove('synced', 'syncing', 'error');

  if (state.isSyncing) {
    pill.classList.add('syncing');
    pillText.textContent = '동기화 중...';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '동기화 중';
    }
  } else if (!state.settings.scriptUrl) {
    pillText.textContent = '로컬 저장';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '미연결';
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
    pillText.textContent = '시트 동기화됨';
    if (statusBadge) {
      statusBadge.className = 'status-badge ok';
      statusBadge.textContent = '연결됨';
    }
  } else {
    pillText.textContent = 'URL 설정됨';
    if (statusBadge) {
      statusBadge.className = 'status-badge';
      statusBadge.textContent = '대기 중';
    }
  }

  if (lastSyncEl) {
    if (meta.lastSyncAt) {
      const d = new Date(meta.lastSyncAt);
      lastSyncEl.textContent = d.toLocaleString('ko-KR', {
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
    barBtn.title = on ? '알림음 켜짐 (누르면 끄기)' : '알림음 꺼짐 (누르면 켜기)';
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

  const listEl = document.getElementById('workout-exercises-list');
  if (!draft.exercises.length) {
    listEl.innerHTML = `
      <div class="empty-box">
        <strong>아직 추가된 운동 종목이 없습니다</strong>
        <span>아래 "+ 운동 종목 추가하기"를 누르거나 루틴을 선택해 바로 시작하세요.</span>
      </div>
    `;
  } else {
    listEl.innerHTML = draft.exercises
      .map((ex, exIdx) => {
        const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
        const last = getLastExerciseRecord(ex.name);
        const lastHint = last
          ? `지난 기록 (${formatKoreanDate(last.date)}): 최고 ${last.bestSet.weight}kg × ${last.bestSet.reps}회`
          : '첫 기록입니다';
        const exVol = (ex.sets || []).reduce(
          (sum, s) => sum + (s.completed ? calcSetVolume(s.weight, s.reps) : 0),
          0
        );

        return `
          <article class="exercise-card" data-ex-idx="${exIdx}">
            <div class="exercise-card-head">
              <div class="exercise-title-group">
                <div class="exercise-name-row">
                  <h3 class="exercise-name">${escapeHtml(ex.name)}</h3>
                  <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg}">${escapeHtml(ex.muscle)}</span>
                </div>
                <div class="last-record-hint">${escapeHtml(lastHint)}</div>
              </div>
              <div class="exercise-head-actions">
                <select class="rest-mini-select" data-action="change-ex-rest" data-ex-idx="${exIdx}" aria-label="종목 휴식 시간">
                  ${[60, 90, 120, 150, 180]
                    .map((sec) => `<option value="${sec}" ${Number(ex.restSec) === sec ? 'selected' : ''}>휴식 ${sec}초</option>`)
                    .join('')}
                </select>
                <button class="icon-btn" type="button" data-action="remove-ex" data-ex-idx="${exIdx}" title="종목 삭제">✕</button>
              </div>
            </div>

            <div class="sets-header">
              <span>세트</span>
              <span>무게(kg)</span>
              <span>횟수</span>
              <span>추정1RM</span>
              <span>완료</span>
              <span></span>
            </div>

            <div class="sets-list">
              ${(ex.sets || [])
                .map((s, setIdx) => {
                  const rm = calcEst1RM(s.weight, s.reps);
                  return `
                    <div class="set-row ${s.completed ? 'completed' : ''}" data-ex-idx="${exIdx}" data-set-idx="${setIdx}">
                      <span class="set-num">${setIdx + 1}</span>
                      <input class="set-input" type="number" inputmode="decimal" step="0.5" min="0"
                        value="${s.weight}" data-action="edit-weight" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" aria-label="무게(kg)">
                      <input class="set-input" type="number" inputmode="numeric" step="1" min="0"
                        value="${s.reps}" data-action="edit-reps" data-ex-idx="${exIdx}" data-set-idx="${setIdx}" aria-label="횟수">
                      <span class="set-1rm tabular" data-role="set-1rm">${rm > 0 ? `${rm}` : '-'}</span>
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

  // 빠른 루틴 타일
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
  const chips = document.querySelectorAll('#routine-filter-chips .filter-chip');
  chips.forEach((chip) => {
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
  document.getElementById('muscle-mode-sets').classList.toggle('active', state.muscleMode === 'sets');
  document.getElementById('muscle-mode-volume').classList.toggle('active', state.muscleMode === 'volume');

  const workouts = getFilteredHistoryWorkouts();
  const totalCount = workouts.length;
  const totalVol = workouts.reduce((sum, w) => sum + (Number(w.totalVolume) || 0), 0);
  const avgVol = totalCount > 0 ? Math.round(totalVol / totalCount) : 0;

  document.getElementById('hist-kpi-count').textContent = `${totalCount}회`;
  document.getElementById('hist-kpi-volume').textContent = `${Math.round(totalVol).toLocaleString('ko-KR')} kg`;
  document.getElementById('hist-kpi-avg').textContent = `${avgVol.toLocaleString('ko-KR')} kg`;

  // 1. 총 볼륨 차트
  renderVolumeChart(
    document.getElementById('chart-volume'),
    workouts,
    document.getElementById('volume-trend-badge')
  );

  // 2. 종목별 1RM 선택 드롭다운 & 차트
  const exCounts = new Map();
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      const hasDone = (ex.sets || []).some((s) => s.completed && calcEst1RM(s.weight, s.reps) > 0);
      if (hasDone) exCounts.set(ex.name, (exCounts.get(ex.name) || 0) + 1);
    }
  }
  const exNames = Array.from(exCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name);

  const selectEl = document.getElementById('select-1rm-exercise');
  if (exNames.length === 0) {
    selectEl.innerHTML = '<option value="">기록된 종목 없음</option>';
    state.selected1RMExercise = '';
  } else {
    if (!exNames.includes(state.selected1RMExercise)) {
      state.selected1RMExercise = exNames[0];
    }
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

  // 3. 부위별 자극 비중 차트
  renderMuscleChart(document.getElementById('chart-muscle'), workouts, state.muscleMode);

  // 4. 캘린더 + 일지 리스트
  const allWorkouts = getActiveWorkouts();
  const workoutDates = new Set(allWorkouts.map((w) => w.date));
  renderCalendar(
    document.getElementById('history-calendar'),
    state.calYear,
    state.calMonth,
    workoutDates,
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

  const clearBtn = document.getElementById('btn-clear-date-filter');
  clearBtn.classList.toggle('hidden', !state.selectedDateFilter);

  const listItems = state.selectedDateFilter
    ? allWorkouts.filter((w) => w.date === state.selectedDateFilter)
    : workouts;

  const listEl = document.getElementById('history-list');
  if (!listItems.length) {
    listEl.innerHTML = `<div class="chart-empty">${state.selectedDateFilter ? `${formatKoreanDate(state.selectedDateFilter)}에는 저장된 운동 기록이 없습니다.` : '아직 저장된 운동 일지가 없습니다.'}</div>`;
    return;
  }

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

function renderSettingsView() {
  const s = state.settings;
  document.getElementById('input-script-url').value = s.scriptUrl || '';
  document.getElementById('input-script-secret').value = s.scriptSecret || '';
  document.getElementById('toggle-auto-sync').checked = Boolean(s.autoSync);
  document.getElementById('toggle-auto-timer').checked = Boolean(s.autoStartRest);
  document.getElementById('toggle-timer-sound').checked = Boolean(s.timerSound);

  document.querySelectorAll('#default-rest-group .preset-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.rest) === Number(s.defaultRestSec));
  });
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
    listEl.innerHTML = '<div class="chart-empty">검색 결과가 없습니다. 아래에서 직접 종목을 추가해 보세요.</div>';
    return;
  }

  listEl.innerHTML = filtered
    .map((ex) => {
      const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
      return `
        <button class="picker-item" type="button" data-pick-ex-name="${escapeHtml(ex.name)}" data-pick-ex-muscle="${escapeHtml(ex.muscle)}">
          <span>${escapeHtml(ex.name)}</span>
          <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg}">${escapeHtml(ex.muscle)}</span>
        </button>
      `;
    })
    .join('');
}

function addExerciseToTarget(name, muscle) {
  if (state.pickerMode === 'routine' && state.editingRoutine) {
    state.editingRoutine.exercises.push({
      name,
      muscle,
      targetSets: 3,
      defaultReps: 10,
      defaultWeight: 20,
      restSec: state.settings.defaultRestSec || 90
    });
    renderRoutineEditorList();
    closeModal('modal-exercise-picker');
    return;
  }

  const last = getLastExerciseRecord(name);
  const defaultWeight = last?.bestSet?.weight ?? 20;
  const defaultReps = last?.bestSet?.reps ?? 10;

  state.draft.exercises.push({
    id: uid('ex'),
    name,
    muscle,
    restSec: state.settings.defaultRestSec || 90,
    sets: [
      { id: uid('set'), weight: defaultWeight, reps: defaultReps, completed: false },
      { id: uid('set'), weight: defaultWeight, reps: defaultReps, completed: false },
      { id: uid('set'), weight: defaultWeight, reps: defaultReps, completed: false }
    ]
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
            <label class="mini-field">기본 횟수
              <input type="number" min="1" value="${ex.defaultReps || 10}" data-r-field="defaultReps" data-r-ex-idx="${idx}">
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

  const body = document.getElementById('detail-body');
  body.innerHTML = (w.exercises || [])
    .map((ex) => {
      const mInfo = MUSCLE_GROUPS[ex.muscle] || MUSCLE_GROUPS['코어'];
      return `
        <div class="detail-ex-block">
          <div class="detail-ex-title">
            <span>${escapeHtml(ex.name)}</span>
            <span class="muscle-pill" style="color:${mInfo.color};background:${mInfo.bg}">${escapeHtml(ex.muscle)}</span>
          </div>
          ${(ex.sets || [])
            .map((s, idx) => {
              const rm = calcEst1RM(s.weight, s.reps);
              return `
                <div class="detail-set-line">
                  <span>${idx + 1}세트 ${s.completed ? '✓' : '(미완료)'}</span>
                  <span class="tabular">${s.weight}kg × ${s.reps}회 · 추정 1RM ${rm}kg</span>
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

// ===== 동기화 실행 =====
async function runSync({ silent = false } = {}) {
  if (state.isSyncing) return;
  if (!state.settings.scriptUrl) {
    if (!silent) showToast('먼저 설정 탭에서 Apps Script 웹 앱 URL을 입력해 주세요.', 'error');
    return;
  }

  state.isSyncing = true;
  renderSyncIndicators();
  const feedbackEl = document.getElementById('sync-feedback');

  try {
    const res = await syncWithGoogleSheets(state.settings);
    renderHistoryView();
    renderRoutinesView();
    if (feedbackEl && !silent) {
      feedbackEl.className = 'sync-feedback ok';
      feedbackEl.textContent = `동기화 완료! 운동 기록 ${res.workoutsCount}건, 루틴 ${res.routinesCount}건이 구글 시트와 일치합니다.`;
      feedbackEl.classList.remove('hidden');
    }
    if (!silent) showToast('구글 시트 동기화가 완료되었습니다.', 'success');
  } catch (err) {
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

// ===== 경과 타이머 =====
function startElapsedClock() {
  const update = () => {
    const el = document.getElementById('workout-elapsed');
    if (!el || !state.draft) return;
    const sec = Math.max(0, Math.floor((Date.now() - (state.draft.startedAt || Date.now())) / 1000));
    el.textContent = formatMMSS(sec);
  };
  update();
  window.setInterval(update, 1000);
}

// ===== 탭 전환 =====
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${tab}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  if (tab === 'history') renderHistoryView();
  if (tab === 'routines') renderRoutinesView();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ===== 이벤트 바인딩 =====
function bindEvents() {
  // 첫 인터랙션 시 iOS 오디오 잠금 해제
  document.addEventListener('pointerdown', () => restTimer.unlockAudio(), { once: true });

  // 하단 탭 & 상단 동기화 뱃지
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('sync-pill').addEventListener('click', () => {
    if (state.settings.scriptUrl) runSync();
    else switchTab('settings');
  });
  document.getElementById('btn-goto-routines').addEventListener('click', () => switchTab('routines'));

  // 모달 닫기
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.classList.add('hidden');
    });
  });

  // 운동 헤더 입력
  document.getElementById('workout-title-input').addEventListener('input', (e) => {
    state.draft.title = e.target.value;
    saveDraft(state.draft);
  });
  document.getElementById('workout-date-input').addEventListener('change', (e) => {
    state.draft.date = e.target.value || toLocalDateStr();
    saveDraft(state.draft);
  });

  // 운동 초기화 & 완료 저장
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

    const durationSec = Math.max(60, Math.floor((Date.now() - (state.draft.startedAt || Date.now())) / 1000));
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

    if (state.settings.scriptUrl && state.settings.autoSync && navigator.onLine) {
      runSync({ silent: true });
    }
  });

  // 빠른 휴식 타이머 & 알림음 토글
  document.querySelectorAll('[data-quick-rest]').forEach((btn) => {
    btn.addEventListener('click', () => {
      restTimer.start(Number(btn.dataset.quickRest));
    });
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

  // 종목 추가 버튼
  document.getElementById('btn-add-exercise').addEventListener('click', () => openExercisePicker('workout'));

  // 운동 리스트 이벤트 위임 (포커스 유실 방지를 위해 input 이벤트에서는 부분 DOM 갱신만 수행)
  const exList = document.getElementById('workout-exercises-list');
  exList.addEventListener('input', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    if (action !== 'edit-weight' && action !== 'edit-reps') return;

    const exIdx = Number(target.dataset.exIdx);
    const setIdx = Number(target.dataset.setIdx);
    const ex = state.draft.exercises[exIdx];
    const set = ex?.sets?.[setIdx];
    if (!set) return;

    const num = Math.max(0, Number(target.value) || 0);
    if (action === 'edit-weight') set.weight = num;
    else set.reps = num;

    saveDraft(state.draft);

    const row = target.closest('.set-row');
    const rmEl = row?.querySelector('[data-role="set-1rm"]');
    if (rmEl) {
      const rm = calcEst1RM(set.weight, set.reps);
      rmEl.textContent = rm > 0 ? `${rm}` : '-';
    }

    const card = target.closest('.exercise-card');
    const exVolEl = card?.querySelector('[data-role="ex-volume"]');
    if (exVolEl) {
      const exVol = ex.sets.reduce((sum, s) => sum + (s.completed ? calcSetVolume(s.weight, s.reps) : 0), 0);
      exVolEl.textContent = `${Math.round(exVol).toLocaleString('ko-KR')} kg`;
    }

    updateWorkoutSummaryDOM();
  });

  exList.addEventListener('change', (e) => {
    const target = e.target;
    if (target.dataset.action === 'change-ex-rest') {
      const exIdx = Number(target.dataset.exIdx);
      if (state.draft.exercises[exIdx]) {
        state.draft.exercises[exIdx].restSec = Number(target.value) || 90;
        saveDraft(state.draft);
      }
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

    if (action === 'toggle-set') {
      const set = ex.sets[setIdx];
      if (!set) return;
      set.completed = !set.completed;
      saveDraft(state.draft);
      renderWorkoutView();
      if (set.completed && state.settings.autoStartRest) {
        restTimer.start(ex.restSec || state.settings.defaultRestSec || 90);
      }
    } else if (action === 'add-set') {
      const prev = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        id: uid('set'),
        weight: prev ? prev.weight : 20,
        reps: prev ? prev.reps : 10,
        completed: false
      });
      saveDraft(state.draft);
      renderWorkoutView();
    } else if (action === 'remove-set') {
      if (ex.sets.length <= 1) {
        showToast('최소 1세트는 남겨두어야 합니다. 종목을 지우려면 우측 상단 ✕를 누르세요.');
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

  // 빠른 루틴 시작 & 루틴 탭 액션
  const handleRoutineClicks = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const routineId = btn.dataset.routineId;
    const routine = getActiveRoutines().find((r) => r.id === routineId);
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
    } else if (action === 'delete-routine') {
      softDeleteRoutine(routine.id);
      renderRoutinesView();
      renderWorkoutView();
      showToast('커스텀 루틴을 삭제했습니다.');
      if (state.settings.scriptUrl && state.settings.autoSync && navigator.onLine) runSync({ silent: true });
    }
  };
  document.getElementById('quick-routines-grid').addEventListener('click', handleRoutineClicks);
  document.getElementById('routines-list').addEventListener('click', handleRoutineClicks);

  // 루틴 필터 & 새 루틴
  document.getElementById('routine-filter-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-split]');
    if (!chip) return;
    state.routineFilter = chip.dataset.split;
    renderRoutinesView();
  });
  document.getElementById('btn-new-routine').addEventListener('click', () => openRoutineEditor(null));

  // 루틴 에디터 내부 이벤트
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
    if (!name) {
      showToast('루틴 이름을 입력해 주세요.', 'error');
      return;
    }
    if (!state.editingRoutine.exercises.length) {
      showToast('최소 1개 이상의 운동 종목을 추가해 주세요.', 'error');
      return;
    }
    state.editingRoutine.name = name;
    state.editingRoutine.split = document.getElementById('routine-split-select').value;
    state.editingRoutine.description = document.getElementById('routine-desc-input').value.trim();
    upsertRoutine(state.editingRoutine);
    closeModal('modal-routine-editor');
    renderRoutinesView();
    renderWorkoutView();
    showToast(`"${name}" 루틴이 저장되었습니다.`, 'success');
    if (state.settings.scriptUrl && state.settings.autoSync && navigator.onLine) runSync({ silent: true });
  });

  // 종목 선택 모달 이벤트
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
    addExerciseToTarget(item.dataset.pickExName, item.dataset.pickExMuscle);
  });
  document.getElementById('btn-add-custom-ex').addEventListener('click', () => {
    const name = document.getElementById('custom-ex-name').value.trim();
    const muscle = document.getElementById('custom-ex-muscle').value;
    if (!name) {
      showToast('직접 추가할 종목명을 입력해 주세요.', 'error');
      return;
    }
    const created = addCustomExercise(name, muscle);
    if (created) addExerciseToTarget(created.name, created.muscle);
  });

  // 기록·성장 탭 컨트롤
  document.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.historyPeriod = btn.dataset.period;
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

  // 운동 상세 모달 액션
  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    if (!state.viewingWorkoutId) return;
    softDeleteWorkout(state.viewingWorkoutId);
    closeModal('modal-workout-detail');
    renderHistoryView();
    showToast('운동 기록을 삭제했습니다.');
    if (state.settings.scriptUrl && state.settings.autoSync && navigator.onLine) runSync({ silent: true });
  });
  document.getElementById('btn-detail-repeat').addEventListener('click', () => {
    const w = getActiveWorkouts().find((item) => item.id === state.viewingWorkoutId);
    if (!w) return;
    state.draft = {
      id: uid('w'),
      title: w.title,
      date: toLocalDateStr(),
      routineId: w.routineId || null,
      startedAt: Date.now(),
      exercises: (w.exercises || []).map((ex) => ({
        id: uid('ex'),
        name: ex.name,
        muscle: ex.muscle,
        restSec: ex.restSec || 90,
        sets: (ex.sets || []).map((s) => ({
          id: uid('set'),
          weight: s.weight,
          reps: s.reps,
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

  // 설정 탭 이벤트
  document.getElementById('input-script-url').addEventListener('change', (e) => {
    state.settings = saveSettings({ scriptUrl: e.target.value.trim() });
    renderSyncIndicators();
  });
  document.getElementById('input-script-secret').addEventListener('change', (e) => {
    state.settings = saveSettings({ scriptSecret: e.target.value.trim() });
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
  document.getElementById('btn-test-sound').addEventListener('click', () => {
    const prev = restTimer.soundEnabled;
    restTimer.setSoundEnabled(true);
    restTimer.playChime();
    restTimer.setSoundEnabled(prev);
  });

  document.getElementById('btn-test-sync').addEventListener('click', async () => {
    const url = document.getElementById('input-script-url').value.trim();
    const secret = document.getElementById('input-script-secret').value.trim();
    state.settings = saveSettings({ scriptUrl: url, scriptSecret: secret });
    const feedback = document.getElementById('sync-feedback');
    try {
      const res = await testScriptConnection(url, secret);
      feedback.className = 'sync-feedback ok';
      feedback.textContent = `연결 성공! (${res.message || '구글 시트 응답 정상'})`;
      feedback.classList.remove('hidden');
      showToast('Apps Script 연결 테스트 성공!', 'success');
    } catch (err) {
      feedback.className = 'sync-feedback err';
      feedback.textContent = err.message;
      feedback.classList.remove('hidden');
      showToast(err.message, 'error');
    }
  });

  document.getElementById('btn-manual-sync').addEventListener('click', () => {
    const url = document.getElementById('input-script-url').value.trim();
    const secret = document.getElementById('input-script-secret').value.trim();
    state.settings = saveSettings({ scriptUrl: url, scriptSecret: secret });
    runSync({ silent: false });
  });

  // 백업 내보내기 / 가져오기 / 샘플 삭제 / 기본 루틴 복원
  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([exportAllDataJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleekfit-backup-${toLocalDateStr()}.json`;
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
      const text = await file.text();
      importAllDataJSON(text);
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
    showToast('샘플 운동 기록을 삭제했습니다.');
  });

  document.getElementById('btn-reset-routines').addEventListener('click', () => {
    resetDefaultRoutines();
    renderAll();
    showToast('기본 분할 루틴 4종을 복원했습니다.', 'success');
  });
}

bootstrap();
