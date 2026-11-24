export const DEFAULT_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzfh4DFNxuYE2pDVVVO8aknRZqkHBEyBlTcRzCH3C51_ysZghtcKWaEqajVsrhZxtIW/exec';

export const MUSCLE_GROUPS = {
  가슴: { color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.16)' },
  등: { color: '#10B981', bg: 'rgba(16, 185, 129, 0.16)' },
  하체: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.16)' },
  어깨: { color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.16)' },
  팔: { color: '#EC4899', bg: 'rgba(236, 72, 153, 0.16)' },
  코어: { color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.16)' }
};

// trackingType: 'weighted' | 'bodyweight_reps' | 'bodyweight_time'
export const EXERCISE_CATALOG = [
  // 가슴
  { id: 'ex_bench', name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted' },
  { id: 'ex_incline_db', name: '인클라인 덤벨 프레스', muscle: '가슴', trackingType: 'weighted' },
  { id: 'ex_incline_bb', name: '인클라인 벤치 프레스', muscle: '가슴', trackingType: 'weighted' },
  { id: 'ex_chest_press', name: '체스트 프레스 머신', muscle: '가슴', trackingType: 'weighted' },
  { id: 'ex_cable_fly', name: '케이블 크로스오버', muscle: '가슴', trackingType: 'weighted' },
  { id: 'ex_pec_deck', name: '펙 덱 플라이', muscle: '가슴', trackingType: 'weighted' },
  { id: 'ex_dips', name: '딥스', muscle: '가슴', trackingType: 'bodyweight_reps' },
  { id: 'ex_pushup', name: '푸시업', muscle: '가슴', trackingType: 'bodyweight_reps' },

  // 등
  { id: 'ex_deadlift', name: '컨벤셔널 데드리프트', muscle: '등', trackingType: 'weighted' },
  { id: 'ex_lat_pulldown', name: '랫 풀다운', muscle: '등', trackingType: 'weighted' },
  { id: 'ex_barbell_row', name: '바벨 로우', muscle: '등', trackingType: 'weighted' },
  { id: 'ex_seated_row', name: '시티드 케이블 로우', muscle: '등', trackingType: 'weighted' },
  { id: 'ex_pullup', name: '풀업 (턱걸이)', muscle: '등', trackingType: 'bodyweight_reps' },
  { id: 'ex_chinup', name: '친업', muscle: '등', trackingType: 'bodyweight_reps' },
  { id: 'ex_tbar_row', name: '티바 로우', muscle: '등', trackingType: 'weighted' },
  { id: 'ex_db_row', name: '원암 덤벨 로우', muscle: '등', trackingType: 'weighted' },
  { id: 'ex_dead_hang', name: '매달리기 (데드 행)', muscle: '등', trackingType: 'bodyweight_time' },

  // 하체
  { id: 'ex_squat', name: '바벨 백 스쿼트', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_leg_press', name: '레그 프레스', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_rdl', name: '루마니안 데드리프트', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_leg_ext', name: '레그 익스텐션', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_leg_curl', name: '레그 컬', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_lunge', name: '덤벨 런지', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_air_squat', name: '에어 스쿼트', muscle: '하체', trackingType: 'bodyweight_reps' },
  { id: 'ex_burpee', name: '버피', muscle: '하체', trackingType: 'bodyweight_reps' },
  { id: 'ex_hip_thrust', name: '힙 쓰러스트', muscle: '하체', trackingType: 'weighted' },
  { id: 'ex_calf_raise', name: '카프 레이즈', muscle: '하체', trackingType: 'weighted' },

  // 어깨
  { id: 'ex_ohp', name: '오버헤드 프레스', muscle: '어깨', trackingType: 'weighted' },
  { id: 'ex_db_shoulder', name: '덤벨 숄더 프레스', muscle: '어깨', trackingType: 'weighted' },
  { id: 'ex_lat_raise', name: '사이드 레터럴 레이즈', muscle: '어깨', trackingType: 'weighted' },
  { id: 'ex_face_pull', name: '페이스 풀', muscle: '어깨', trackingType: 'weighted' },
  { id: 'ex_rear_delt', name: '리어 델트 플라이', muscle: '어깨', trackingType: 'weighted' },

  // 팔
  { id: 'ex_barbell_curl', name: '바벨 컬', muscle: '팔', trackingType: 'weighted' },
  { id: 'ex_db_curl', name: '덤벨 컬', muscle: '팔', trackingType: 'weighted' },
  { id: 'ex_hammer_curl', name: '해머 컬', muscle: '팔', trackingType: 'weighted' },
  { id: 'ex_tricep_pushdown', name: '케이블 트라이셉스 푸쉬다운', muscle: '팔', trackingType: 'weighted' },
  { id: 'ex_lying_tricep', name: '라잉 트라이셉스 익스텐션', muscle: '팔', trackingType: 'weighted' },

  // 코어
  { id: 'ex_hanging_leg', name: '행잉 레그 레이즈', muscle: '코어', trackingType: 'bodyweight_reps' },
  { id: 'ex_crunch', name: '크런치', muscle: '코어', trackingType: 'bodyweight_reps' },
  { id: 'ex_cable_crunch', name: '케이블 크런치', muscle: '코어', trackingType: 'weighted' },
  { id: 'ex_plank', name: '플랭크', muscle: '코어', trackingType: 'bodyweight_time' },
  { id: 'ex_side_plank', name: '사이드 플랭크', muscle: '코어', trackingType: 'bodyweight_time' },
  { id: 'ex_hollow_hold', name: '할로우 바디 홀드', muscle: '코어', trackingType: 'bodyweight_time' },
  { id: 'ex_ab_wheel', name: 'AB 휠 롤아웃', muscle: '코어', trackingType: 'bodyweight_reps' }
];

export const DEFAULT_ROUTINES = [
  {
    id: 'routine_push',
    name: '상체 푸시 (밀기)',
    split: '상체 푸시',
    description: '가슴 · 전면/측면 어깨 · 삼두 집중 분할',
    isDefault: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    exercises: [
      { name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted', targetSets: 4, defaultReps: 8, defaultWeight: 60, restSec: 120 },
      { name: '인클라인 덤벨 프레스', muscle: '가슴', trackingType: 'weighted', targetSets: 3, defaultReps: 10, defaultWeight: 22, restSec: 90 },
      { name: '오버헤드 프레스', muscle: '어깨', trackingType: 'weighted', targetSets: 3, defaultReps: 8, defaultWeight: 40, restSec: 90 },
      { name: '사이드 레터럴 레이즈', muscle: '어깨', trackingType: 'weighted', targetSets: 4, defaultReps: 15, defaultWeight: 8, restSec: 60 },
      { name: '케이블 트라이셉스 푸쉬다운', muscle: '팔', trackingType: 'weighted', targetSets: 3, defaultReps: 12, defaultWeight: 25, restSec: 60 }
    ]
  },
  {
    id: 'routine_pull',
    name: '상체 풀 (당기기)',
    split: '상체 풀',
    description: '등 두께/너비 · 후면 어깨 · 이두 분할',
    isDefault: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    exercises: [
      { name: '풀업 (턱걸이)', muscle: '등', trackingType: 'bodyweight_reps', targetSets: 3, defaultReps: 8, defaultWeight: 0, restSec: 120 },
      { name: '랫 풀다운', muscle: '등', trackingType: 'weighted', targetSets: 4, defaultReps: 10, defaultWeight: 55, restSec: 90 },
      { name: '바벨 로우', muscle: '등', trackingType: 'weighted', targetSets: 4, defaultReps: 8, defaultWeight: 60, restSec: 120 },
      { name: '페이스 풀', muscle: '어깨', trackingType: 'weighted', targetSets: 3, defaultReps: 15, defaultWeight: 20, restSec: 60 },
      { name: '바벨 컬', muscle: '팔', trackingType: 'weighted', targetSets: 3, defaultReps: 12, defaultWeight: 25, restSec: 60 }
    ]
  },
  {
    id: 'routine_legs',
    name: '하체 집중',
    split: '하체',
    description: '대퇴사두 · 햄스트링 · 둔근 · 코어',
    isDefault: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    exercises: [
      { name: '바벨 백 스쿼트', muscle: '하체', trackingType: 'weighted', targetSets: 4, defaultReps: 8, defaultWeight: 80, restSec: 150 },
      { name: '루마니안 데드리프트', muscle: '하체', trackingType: 'weighted', targetSets: 3, defaultReps: 10, defaultWeight: 70, restSec: 120 },
      { name: '레그 프레스', muscle: '하체', trackingType: 'weighted', targetSets: 3, defaultReps: 12, defaultWeight: 140, restSec: 90 },
      { name: '행잉 레그 레이즈', muscle: '코어', trackingType: 'bodyweight_reps', targetSets: 3, defaultReps: 15, defaultWeight: 0, restSec: 60 },
      { name: '플랭크', muscle: '코어', trackingType: 'bodyweight_time', targetSets: 3, defaultDurationSec: 60, defaultWeight: 0, restSec: 60 }
    ]
  },
  {
    id: 'routine_full',
    name: '전신 밸런스',
    split: '전신',
    description: '주 3회 전신 복합 다관절 루틴',
    isDefault: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    deleted: false,
    exercises: [
      { name: '바벨 백 스쿼트', muscle: '하체', trackingType: 'weighted', targetSets: 3, defaultReps: 8, defaultWeight: 80, restSec: 120 },
      { name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted', targetSets: 3, defaultReps: 8, defaultWeight: 60, restSec: 120 },
      { name: '컨벤셔널 데드리프트', muscle: '등', trackingType: 'weighted', targetSets: 3, defaultReps: 5, defaultWeight: 100, restSec: 150 },
      { name: '푸시업', muscle: '가슴', trackingType: 'bodyweight_reps', targetSets: 3, defaultReps: 15, defaultWeight: 0, restSec: 60 },
      { name: '플랭크', muscle: '코어', trackingType: 'bodyweight_time', targetSets: 3, defaultDurationSec: 60, defaultWeight: 0, restSec: 60 }
    ]
  }
];

export const DEFAULT_SUPPLEMENTS = [
  { id: 'supp_protein', name: '프로틴 (단백질 쉐이크)', timeHint: '운동 직후 · 간식', isDefault: true, updatedAt: '2026-01-01T00:00:00.000Z', deleted: false },
  { id: 'supp_creatine', name: '크레아틴 5g', timeHint: '매일 식후 · 운동 후', isDefault: true, updatedAt: '2026-01-01T00:00:00.000Z', deleted: false },
  { id: 'supp_multi', name: '멀티비타민', timeHint: '아침 식후', isDefault: true, updatedAt: '2026-01-01T00:00:00.000Z', deleted: false },
  { id: 'supp_omega3', name: '오메가3', timeHint: '저녁 식후', isDefault: true, updatedAt: '2026-01-01T00:00:00.000Z', deleted: false }
];

export function toLocalDateStr(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatKoreanDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${parts[1]}월 ${parts[2]}일 (${weekdays[d.getDay()]})`;
}

export function inferTrackingType(ex) {
  if (ex?.trackingType) return ex.trackingType;
  const found = EXERCISE_CATALOG.find((item) => item.name === ex?.name);
  return found?.trackingType || 'weighted';
}

export function calcEst1RM(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
  if (r === 1) return Math.round(w * 10) / 10;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

export function calcSetVolume(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return 0;
  return Math.round(w * r * 10) / 10;
}

export function calcWorkoutStats(exercises = []) {
  let completedSets = 0;
  let workingCompletedSets = 0;
  let totalSets = 0;
  let totalVolume = 0;
  let best1RM = 0;
  const muscleStats = {};

  Object.keys(MUSCLE_GROUPS).forEach((m) => {
    muscleStats[m] = { sets: 0, volume: 0 };
  });

  for (const ex of exercises) {
    const muscle = MUSCLE_GROUPS[ex.muscle] ? ex.muscle : '코어';
    const tracking = inferTrackingType(ex);
    for (const s of ex.sets || []) {
      totalSets += 1;
      if (!s.completed) continue;
      completedSets += 1;

      // 워밍업(W) 세트는 총 볼륨, 추정 1RM, 통계에서 제외
      if (s.setType === 'warmup') continue;

      workingCompletedSets += 1;
      if (tracking !== 'bodyweight_time') {
        const vol = calcSetVolume(s.weight, s.reps);
        const oneRm = calcEst1RM(s.weight, s.reps);
        totalVolume += vol;
        if (oneRm > best1RM) best1RM = oneRm;
        muscleStats[muscle].volume += vol;
      }
      muscleStats[muscle].sets += 1;
    }
  }

  return {
    completedSets,
    workingCompletedSets,
    totalSets,
    totalVolume: Math.round(totalVolume * 10) / 10,
    best1RM: Math.round(best1RM * 10) / 10,
    muscleStats
  };
}

export function buildExercisePRMap(workouts = [], excludeWorkoutId = null) {
  const map = new Map();
  for (const w of workouts) {
    if (w.deleted || (excludeWorkoutId && w.id === excludeWorkoutId)) continue;
    for (const ex of w.exercises || []) {
      const tracking = inferTrackingType(ex);
      for (const s of ex.sets || []) {
        if (!s.completed || s.setType === 'warmup') continue;
        const prev = map.get(ex.name) || {
          hasRecord: false,
          maxWeight: 0,
          max1RM: 0,
          maxReps: 0,
          maxDuration: 0
        };
        const weight = Number(s.weight) || 0;
        const reps = Number(s.reps) || 0;
        const dur = Number(s.durationSec) || 0;
        const rm = tracking === 'bodyweight_time' ? 0 : calcEst1RM(weight, reps);

        map.set(ex.name, {
          hasRecord: true,
          maxWeight: Math.max(prev.maxWeight, weight),
          max1RM: Math.max(prev.max1RM, rm),
          maxReps: Math.max(prev.maxReps, reps),
          maxDuration: Math.max(prev.maxDuration, dur)
        });
      }
    }
  }
  return map;
}

export function isSetPR(set, exercise, prMap) {
  if (!set?.completed || set.setType === 'warmup') return false;
  const prev = prMap?.get(exercise.name);
  if (!prev || !prev.hasRecord) return false;

  const tracking = inferTrackingType(exercise);
  const weight = Number(set.weight) || 0;
  const reps = Number(set.reps) || 0;
  const dur = Number(set.durationSec) || 0;

  if (tracking === 'bodyweight_time') {
    return dur > prev.maxDuration;
  }
  if (tracking === 'bodyweight_reps') {
    return weight > prev.maxWeight || (weight >= prev.maxWeight && reps > prev.maxReps);
  }
  if (weight <= 0 || reps <= 0) return false;
  const rm = calcEst1RM(weight, reps);
  return weight > prev.maxWeight || rm > prev.max1RM;
}

const PLATE_SPECS = {
  25: { color: '#EF4444', height: 68, width: 16 },
  20: { color: '#3B82F6', height: 64, width: 15 },
  15: { color: '#F59E0B', height: 56, width: 14 },
  10: { color: '#10B981', height: 48, width: 13 },
  5: { color: '#64748B', height: 38, width: 12 },
  2.5: { color: '#8B5CF6', height: 32, width: 11 },
  1.25: { color: '#EC4899', height: 26, width: 10 }
};

export function calculateBarbellPlates(targetWeight, barWeight = 20, include25 = false) {
  const target = Math.max(0, Number(targetWeight) || 0);
  const bar = Math.max(0, Number(barWeight) || 20);
  const denoms = include25 ? [25, 20, 15, 10, 5, 2.5, 1.25] : [20, 15, 10, 5, 2.5, 1.25];

  if (target <= bar) {
    return {
      barWeight: bar,
      perSideWeight: 0,
      plates: [],
      actualTotal: bar,
      remainder: 0
    };
  }

  let remaining = (target - bar) / 2;
  const plates = [];

  for (const w of denoms) {
    const count = Math.floor((remaining + 1e-6) / w);
    if (count > 0) {
      plates.push({ weight: w, count, ...PLATE_SPECS[w] });
      remaining = Math.round((remaining - count * w) * 100) / 100;
    }
  }

  const sideSum = plates.reduce((sum, p) => sum + p.weight * p.count, 0);
  const actualTotal = Math.round((bar + sideSum * 2) * 100) / 100;

  return {
    barWeight: bar,
    perSideWeight: Math.round(sideSum * 100) / 100,
    plates,
    actualTotal,
    remainder: Math.round((target - actualTotal) * 100) / 100
  };
}

export function createDemoWorkouts() {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
  };

  const makeSets = (pairs, includeWarmup = false) =>
    pairs.map(([weight, reps], idx) => ({
      id: `demo_set_${idx}_${Math.random().toString(36).slice(2, 7)}`,
      weight,
      reps,
      durationSec: 0,
      setType: includeWarmup && idx === 0 ? 'warmup' : 'normal',
      completed: true
    }));

  const raw = [
    {
      id: 'demo_w1',
      date: daysAgo(18),
      title: '상체 푸시 (밀기)',
      routineId: 'routine_push',
      durationSec: 3120,
      isDemo: true,
      exercises: [
        { name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 120, sets: makeSets([[40, 10], [60, 8], [62.5, 8], [65, 6]], true) },
        { name: '인클라인 덤벨 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 90, sets: makeSets([[20, 10], [20, 10], [22, 8]]) },
        { name: '오버헤드 프레스', muscle: '어깨', trackingType: 'weighted', restSec: 90, sets: makeSets([[35, 8], [37.5, 8], [37.5, 7]]) },
        { name: '사이드 레터럴 레이즈', muscle: '어깨', trackingType: 'weighted', restSec: 60, sets: makeSets([[8, 15], [8, 15], [8, 14]]) }
      ]
    },
    {
      id: 'demo_w2',
      date: daysAgo(15),
      title: '상체 풀 (당기기)',
      routineId: 'routine_pull',
      durationSec: 2980,
      isDemo: true,
      exercises: [
        { name: '풀업 (턱걸이)', muscle: '등', trackingType: 'bodyweight_reps', restSec: 120, sets: makeSets([[0, 8], [0, 8], [0, 7]]) },
        { name: '랫 풀다운', muscle: '등', trackingType: 'weighted', restSec: 90, sets: makeSets([[50, 10], [55, 10], [55, 9]]) },
        { name: '바벨 로우', muscle: '등', trackingType: 'weighted', restSec: 120, sets: makeSets([[55, 8], [60, 8], [60, 8]]) },
        { name: '바벨 컬', muscle: '팔', trackingType: 'weighted', restSec: 60, sets: makeSets([[25, 12], [25, 11], [25, 10]]) }
      ]
    },
    {
      id: 'demo_w3',
      date: daysAgo(12),
      title: '하체 집중',
      routineId: 'routine_legs',
      durationSec: 3450,
      isDemo: true,
      exercises: [
        { name: '바벨 백 스쿼트', muscle: '하체', trackingType: 'weighted', restSec: 150, sets: makeSets([[75, 8], [80, 8], [85, 6], [85, 6]]) },
        { name: '루마니안 데드리프트', muscle: '하체', trackingType: 'weighted', restSec: 120, sets: makeSets([[65, 10], [70, 10], [70, 9]]) },
        { name: '레그 프레스', muscle: '하체', trackingType: 'weighted', restSec: 90, sets: makeSets([[130, 12], [140, 12], [140, 10]]) }
      ]
    },
    {
      id: 'demo_w4',
      date: daysAgo(9),
      title: '상체 푸시 (밀기)',
      routineId: 'routine_push',
      durationSec: 3200,
      isDemo: true,
      exercises: [
        { name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 120, sets: makeSets([[62.5, 8], [65, 8], [67.5, 6], [67.5, 6]]) },
        { name: '인클라인 덤벨 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 90, sets: makeSets([[22, 10], [22, 9], [22, 9]]) },
        { name: '오버헤드 프레스', muscle: '어깨', trackingType: 'weighted', restSec: 90, sets: makeSets([[37.5, 8], [40, 8], [40, 7]]) },
        { name: '케이블 트라이셉스 푸쉬다운', muscle: '팔', trackingType: 'weighted', restSec: 60, sets: makeSets([[27.5, 12], [27.5, 12], [27.5, 10]]) }
      ]
    },
    {
      id: 'demo_w5',
      date: daysAgo(6),
      title: '전신 밸런스',
      routineId: 'routine_full',
      durationSec: 3340,
      isDemo: true,
      exercises: [
        { name: '바벨 백 스쿼트', muscle: '하체', trackingType: 'weighted', restSec: 120, sets: makeSets([[80, 8], [85, 8], [90, 6]]) },
        { name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 120, sets: makeSets([[65, 8], [67.5, 7], [70, 5]]) },
        { name: '컨벤셔널 데드리프트', muscle: '등', trackingType: 'weighted', restSec: 150, sets: makeSets([[95, 5], [100, 5], [105, 5]]) },
        {
          name: '플랭크',
          muscle: '코어',
          trackingType: 'bodyweight_time',
          restSec: 60,
          sets: [
            { id: 'demo_plk_1', weight: 0, reps: 0, durationSec: 60, setType: 'normal', completed: true },
            { id: 'demo_plk_2', weight: 0, reps: 0, durationSec: 70, setType: 'normal', completed: true }
          ]
        }
      ]
    },
    {
      id: 'demo_w6',
      date: daysAgo(3),
      title: '상체 푸시 (밀기)',
      routineId: 'routine_push',
      durationSec: 3390,
      isDemo: true,
      exercises: [
        { name: '벤치 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 120, sets: makeSets([[65, 8], [67.5, 8], [70, 7], [72.5, 5]]) },
        { name: '인클라인 덤벨 프레스', muscle: '가슴', trackingType: 'weighted', restSec: 90, sets: makeSets([[22, 10], [24, 9], [24, 8]]) },
        { name: '오버헤드 프레스', muscle: '어깨', trackingType: 'weighted', restSec: 90, sets: makeSets([[40, 8], [42.5, 7], [42.5, 6]]) }
      ]
    },
    {
      id: 'demo_w7',
      date: daysAgo(1),
      title: '하체 집중',
      routineId: 'routine_legs',
      durationSec: 3610,
      isDemo: true,
      exercises: [
        { name: '바벨 백 스쿼트', muscle: '하체', trackingType: 'weighted', restSec: 150, sets: makeSets([[85, 8], [90, 7], [95, 6], [95, 5]]) },
        { name: '루마니안 데드리프트', muscle: '하체', trackingType: 'weighted', restSec: 120, sets: makeSets([[70, 10], [75, 10], [80, 8]]) },
        { name: '레그 프레스', muscle: '하체', trackingType: 'weighted', restSec: 90, sets: makeSets([[140, 12], [150, 12], [150, 11]]) }
      ]
    }
  ];

  return raw.map((w) => {
    const stats = calcWorkoutStats(w.exercises);
    return {
      ...w,
      totalVolume: stats.totalVolume,
      totalSets: stats.completedSets,
      updatedAt: new Date(`${w.date}T20:00:00`).toISOString(),
      deleted: false
    };
  });
}

export function createDemoSupplementLogs() {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
  };
  return [0, 1, 2, 3, 5, 6, 8, 9, 12].map((d) => {
    const date = daysAgo(d);
    return {
      id: `supp_log_${date}`,
      date,
      checkedIds: d % 2 === 0 ? ['supp_protein', 'supp_creatine', 'supp_multi', 'supp_omega3'] : ['supp_protein', 'supp_creatine'],
      isDemo: true,
      updatedAt: new Date(`${date}T21:00:00`).toISOString(),
      deleted: false
    };
  });
}

export function createDemoInBody() {
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toLocalDateStr(d);
  };
  const samples = [
    { d: 24, w: 74.2, m: 33.4, f: 18.2, memo: '첫 측정' },
    { d: 18, w: 73.7, m: 33.7, f: 17.6, memo: '아침 공복' },
    { d: 12, w: 73.3, m: 34.0, f: 17.1, memo: '식단 시작' },
    { d: 6, w: 72.9, m: 34.2, f: 16.5, memo: '하체 다음날' },
    { d: 1, w: 72.5, m: 34.5, f: 16.0, memo: '컨디션 최상' }
  ];
  return samples.map((s) => {
    const date = daysAgo(s.d);
    return {
      id: `inbody_${date}`,
      date,
      weightKg: s.w,
      muscleMassKg: s.m,
      bodyFatPct: s.f,
      memo: s.memo,
      isDemo: true,
      updatedAt: new Date(`${date}T09:00:00`).toISOString(),
      deleted: false
    };
  });
}
