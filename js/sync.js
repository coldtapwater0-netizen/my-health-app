import {
  getAllRoutinesRaw,
  getAllWorkoutsRaw,
  mergeById,
  saveAllRoutinesRaw,
  saveAllWorkoutsRaw,
  saveSyncMeta
} from './storage.js';

function validateScriptUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error('Apps Script 웹 앱 URL을 먼저 입력해 주세요.');
  }
  if (!/^https:\/\/script\.google(usercontent)?\.com\//i.test(trimmed)) {
    throw new Error('https://script.google.com/... 형태의 Apps Script 웹 앱 URL을 입력해 주세요.');
  }
  return trimmed;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('구글 시트 응답을 읽지 못했습니다. 배포 시 액세스 권한을 "모든 사용자"로 설정했는지 확인해 주세요.');
  }
  if (!data.ok) {
    throw new Error(data.error || '구글 시트 서버에서 오류가 발생했습니다.');
  }
  return data;
}

export async function testScriptConnection(url, secret = '') {
  const cleanUrl = validateScriptUrl(url);
  const target = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=ping&secret=${encodeURIComponent(secret || '')}`;
  const res = await fetch(target, { method: 'GET', redirect: 'follow' });
  return parseJsonResponse(res);
}

export async function syncWithGoogleSheets(settings) {
  const cleanUrl = validateScriptUrl(settings.scriptUrl);
  const secret = settings.scriptSecret || '';

  if (!navigator.onLine) {
    throw new Error('오프라인 상태입니다. 인터넷에 연결되면 자동으로 다시 동기화할 수 있습니다.');
  }

  // 1. 원격 데이터 조회
  const getUrl = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=getAll&secret=${encodeURIComponent(secret)}`;
  const pullRes = await fetch(getUrl, { method: 'GET', redirect: 'follow' });
  const remoteData = await parseJsonResponse(pullRes);

  // 2. 로컬과 병합 (updatedAt 기준)
  const mergedWorkouts = mergeById(getAllWorkoutsRaw(), remoteData.workouts || []);
  const mergedRoutines = mergeById(getAllRoutinesRaw(), remoteData.routines || []);

  saveAllWorkoutsRaw(mergedWorkouts);
  saveAllRoutinesRaw(mergedRoutines);

  // 3. 병합 결과를 구글 시트로 업로드 (CORS 프리플라이트 회피를 위해 text/plain 사용)
  const pushRes = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify({
      action: 'sync',
      secret,
      workouts: mergedWorkouts,
      routines: mergedRoutines
    })
  });
  const pushData = await parseJsonResponse(pushRes);

  if (Array.isArray(pushData.workouts)) {
    saveAllWorkoutsRaw(mergeById(mergedWorkouts, pushData.workouts));
  }
  if (Array.isArray(pushData.routines)) {
    saveAllRoutinesRaw(mergeById(mergedRoutines, pushData.routines));
  }

  const now = new Date().toISOString();
  saveSyncMeta({
    lastSyncAt: now,
    status: 'synced',
    message: '구글 시트와 동기화 완료'
  });

  return {
    syncedAt: now,
    workoutsCount: getAllWorkoutsRaw().filter((w) => !w.deleted).length,
    routinesCount: getAllRoutinesRaw().filter((r) => !r.deleted).length
  };
}
