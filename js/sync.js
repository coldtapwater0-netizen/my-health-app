import {
  getAllInBodyRaw,
  getAllRoutinesRaw,
  getAllSupplementItemsRaw,
  getAllSupplementLogsRaw,
  getAllWorkoutsRaw,
  mergeById,
  saveAllInBodyRaw,
  saveAllRoutinesRaw,
  saveAllSupplementItemsRaw,
  saveAllSupplementLogsRaw,
  saveAllWorkoutsRaw,
  saveSyncMeta
} from './storage.js';

function validateScriptUrl(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) {
    throw new Error('Apps Script 웹 앱 URL이 비어 있습니다.');
  }
  if (!/^https:\/\/script\.google(usercontent)?\.com\//i.test(trimmed)) {
    throw new Error('올바른 Apps Script 웹 앱 URL(https://script.google.com/...)을 입력해 주세요.');
  }
  return trimmed;
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('구글 시트 응답을 읽지 못했습니다. Apps Script 배포 시 "모든 사용자" 권한인지 확인해 주세요.');
  }
  if (!data.ok) {
    if (String(data.error || '').includes('지원하지 않는 POST action')) {
      throw new Error('구글 시트 Apps Script가 구버전입니다. 안내해 드린 최신 Code.gs로 "새 버전 배포"를 진행해 주세요.');
    }
    throw new Error(data.error || '구글 시트 서버에서 오류가 발생했습니다.');
  }
  return data;
}

async function postAction(url, payload) {
  const cleanUrl = validateScriptUrl(url);
  const res = await fetch(cleanUrl, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
  return parseJsonResponse(res);
}

export async function testScriptConnection(url) {
  const cleanUrl = validateScriptUrl(url);
  const target = `${cleanUrl}${cleanUrl.includes('?') ? '&' : '?'}action=ping`;
  const res = await fetch(target, { method: 'GET', redirect: 'follow' });
  return parseJsonResponse(res);
}

export async function registerUser(url, nickname, pin) {
  return postAction(url, { action: 'register', nickname, pin });
}

export async function loginUser(url, nickname, pin) {
  return postAction(url, { action: 'login', nickname, pin });
}

export async function syncWithGoogleSheets(settings, session) {
  if (!session || session.isDemo) {
    return { skipped: true };
  }
  if (!navigator.onLine) {
    throw new Error('오프라인 상태입니다. 인터넷 연결 후 다시 동기화됩니다.');
  }

  const res = await postAction(settings.scriptUrl, {
    action: 'sync',
    nickname: session.nickname,
    pin: session.pin,
    workouts: getAllWorkoutsRaw(),
    routines: getAllRoutinesRaw(),
    supplementItems: getAllSupplementItemsRaw(),
    supplementLogs: getAllSupplementLogsRaw(),
    inbodyRecords: getAllInBodyRaw()
  });

  if (Array.isArray(res.workouts)) saveAllWorkoutsRaw(mergeById(getAllWorkoutsRaw(), res.workouts));
  if (Array.isArray(res.routines)) saveAllRoutinesRaw(mergeById(getAllRoutinesRaw(), res.routines));
  if (Array.isArray(res.supplementItems)) saveAllSupplementItemsRaw(mergeById(getAllSupplementItemsRaw(), res.supplementItems));
  if (Array.isArray(res.supplementLogs)) saveAllSupplementLogsRaw(mergeById(getAllSupplementLogsRaw(), res.supplementLogs));
  if (Array.isArray(res.inbodyRecords)) saveAllInBodyRaw(mergeById(getAllInBodyRaw(), res.inbodyRecords));

  const now = new Date().toISOString();
  saveSyncMeta({ lastSyncAt: now, status: 'synced', message: '구글 시트 동기화 완료' });

  return {
    syncedAt: now,
    workoutsCount: getAllWorkoutsRaw().filter((w) => !w.deleted).length,
    routinesCount: getAllRoutinesRaw().filter((r) => !r.deleted).length
  };
}
