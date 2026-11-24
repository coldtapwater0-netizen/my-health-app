import { MUSCLE_GROUPS, calcEst1RM, calcWorkoutStats, formatKoreanDate } from './data.js';

function shortDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function formatNum(n) {
  return Math.round(n).toLocaleString('ko-KR');
}

export function renderVolumeChart(container, workouts, trendBadgeEl) {
  if (!workouts.length) {
    container.innerHTML = '<div class="chart-empty">완료된 운동 기록이 쌓이면 총 볼륨 그래프가 표시됩니다.</div>';
    if (trendBadgeEl) {
      trendBadgeEl.className = 'trend-badge neutral';
      trendBadgeEl.textContent = '기록 없음';
    }
    return;
  }

  // 날짜별 합산 (오름차순)
  const byDate = new Map();
  for (const w of workouts) {
    const vol = Number(w.totalVolume ?? calcWorkoutStats(w.exercises).totalVolume) || 0;
    byDate.set(w.date, (byDate.get(w.date) || 0) + vol);
  }
  const points = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, volume]) => ({ date, volume: Math.round(volume) }));

  // 추세 배지 계산
  if (trendBadgeEl) {
    if (points.length >= 2) {
      const first = points[0].volume;
      const last = points[points.length - 1].volume;
      const pct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
      if (pct >= 0) {
        trendBadgeEl.className = 'trend-badge up';
        trendBadgeEl.textContent = `▲ ${pct}% 성장`;
      } else {
        trendBadgeEl.className = 'trend-badge down';
        trendBadgeEl.textContent = `▼ ${Math.abs(pct)}%`;
      }
    } else {
      trendBadgeEl.className = 'trend-badge neutral';
      trendBadgeEl.textContent = `${formatNum(points[0].volume)} kg`;
    }
  }

  const width = 500;
  const height = 190;
  const pad = { top: 18, right: 16, bottom: 28, left: 46 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxVal = Math.max(...points.map((p) => p.volume), 100);
  const yMax = Math.ceil((maxVal * 1.12) / 100) * 100;

  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? pad.left + innerW / 2 : pad.left + (idx / (points.length - 1)) * innerW;
    const y = pad.top + innerH - (p.volume / yMax) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath =
    coords.length > 1
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.5, 1].map((ratio) => ({
    y: pad.top + innerH - ratio * innerH,
    label: formatNum(yMax * ratio)
  }));

  const xLabelIndices =
    coords.length <= 4
      ? coords.map((_, i) => i)
      : [0, Math.floor((coords.length - 1) / 2), coords.length - 1];

  const latest = coords[coords.length - 1];

  container.innerHTML = `
    <div class="chart-tooltip-bar" data-role="vol-tooltip">
      <span class="text-secondary">${formatKoreanDate(latest.date)}</span>
      <strong class="tabular text-blue">${formatNum(latest.volume)} kg</strong>
    </div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="총 볼륨 성장 그래프">
      <defs>
        <linearGradient id="volAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${yTicks
        .map(
          (t) => `
          <line x1="${pad.left}" y1="${t.y}" x2="${width - pad.right}" y2="${t.y}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="3 3"/>
          <text x="${pad.left - 8}" y="${t.y + 4}" text-anchor="end" fill="#64748b" font-size="11">${t.label}</text>
        `
        )
        .join('')}
      ${areaPath ? `<path d="${areaPath}" fill="url(#volAreaGrad)"/>` : ''}
      ${coords.length > 1 ? `<path d="${linePath}" fill="none" stroke="#3B82F6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${coords
        .map(
          (c, i) => `
          <circle class="vol-point" data-idx="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${i === coords.length - 1 ? 5.5 : 4}" fill="#60A5FA" stroke="#0A0B0E" stroke-width="2" style="cursor:pointer"/>
        `
        )
        .join('')}
      ${xLabelIndices
        .map(
          (idx) => `
          <text x="${coords[idx].x.toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="#64748b" font-size="11">${shortDate(coords[idx].date)}</text>
        `
        )
        .join('')}
    </svg>
  `;

  const tooltip = container.querySelector('[data-role="vol-tooltip"]');
  container.querySelectorAll('.vol-point').forEach((dot) => {
    const show = () => {
      const p = coords[Number(dot.dataset.idx)];
      if (!p || !tooltip) return;
      tooltip.innerHTML = `
        <span class="text-secondary">${formatKoreanDate(p.date)}</span>
        <strong class="tabular text-blue">${formatNum(p.volume)} kg</strong>
      `;
    };
    dot.addEventListener('click', show);
    dot.addEventListener('mouseenter', show);
  });
}

export function render1RMChart(container, workouts, exerciseName, prBadgeEl) {
  if (!exerciseName) {
    container.innerHTML = '<div class="chart-empty">조회할 종목이 아직 없습니다.</div>';
    if (prBadgeEl) prBadgeEl.textContent = 'PR 0 kg';
    return;
  }

  const byDate = new Map();
  for (const w of workouts) {
    for (const ex of w.exercises || []) {
      if (ex.name !== exerciseName) continue;
      for (const s of ex.sets || []) {
        if (!s.completed) continue;
        const rm = calcEst1RM(s.weight, s.reps);
        if (rm <= 0) continue;
        const prev = byDate.get(w.date);
        if (!prev || rm > prev.rm) {
          byDate.set(w.date, { date: w.date, rm, weight: s.weight, reps: s.reps });
        }
      }
    }
  }

  const points = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (!points.length) {
    container.innerHTML = `<div class="chart-empty">"${exerciseName}"의 완료 세트 기록이 없습니다.</div>`;
    if (prBadgeEl) prBadgeEl.textContent = 'PR 0 kg';
    return;
  }

  let best = points[0];
  let minRm = points[0].rm;
  for (const p of points) {
    if (p.rm > best.rm) best = p;
    if (p.rm < minRm) minRm = p.rm;
  }
  if (prBadgeEl) prBadgeEl.textContent = `PR ${best.rm} kg`;

  const width = 500;
  const height = 185;
  const pad = { top: 18, right: 16, bottom: 28, left: 42 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const yMin = Math.max(0, Math.floor((minRm * 0.88) / 5) * 5);
  const yMax = Math.max(yMin + 10, Math.ceil((best.rm * 1.08) / 5) * 5);

  const coords = points.map((p, idx) => {
    const x = points.length === 1 ? pad.left + innerW / 2 : pad.left + (idx / (points.length - 1)) * innerW;
    const y = pad.top + innerH - ((p.rm - yMin) / (yMax - yMin)) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const yTicks = [0, 0.5, 1].map((r) => ({
    y: pad.top + innerH - r * innerH,
    label: Math.round(yMin + r * (yMax - yMin))
  }));

  const xLabelIndices =
    coords.length <= 4
      ? coords.map((_, i) => i)
      : [0, Math.floor((coords.length - 1) / 2), coords.length - 1];

  const latest = coords[coords.length - 1];

  container.innerHTML = `
    <div class="chart-tooltip-bar" data-role="rm-tooltip">
      <span class="text-secondary">${formatKoreanDate(latest.date)} · ${latest.weight}kg × ${latest.reps}회</span>
      <strong class="tabular text-mint">추정 1RM ${latest.rm} kg</strong>
    </div>
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="종목별 추정 1RM 그래프">
      ${yTicks
        .map(
          (t) => `
          <line x1="${pad.left}" y1="${t.y}" x2="${width - pad.right}" y2="${t.y}" stroke="rgba(255,255,255,0.07)" stroke-dasharray="3 3"/>
          <text x="${pad.left - 8}" y="${t.y + 4}" text-anchor="end" fill="#64748b" font-size="11">${t.label}</text>
        `
        )
        .join('')}
      ${coords.length > 1 ? `<path d="${linePath}" fill="none" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${coords
        .map((c, i) => {
          const isPr = c.date === best.date && c.rm === best.rm;
          return `
            <circle class="rm-point" data-idx="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${isPr ? 6 : 4}" fill="${isPr ? '#F59E0B' : '#10B981'}" stroke="#0A0B0E" stroke-width="2" style="cursor:pointer"/>
          `;
        })
        .join('')}
      ${xLabelIndices
        .map(
          (idx) => `
          <text x="${coords[idx].x.toFixed(1)}" y="${height - 6}" text-anchor="middle" fill="#64748b" font-size="11">${shortDate(coords[idx].date)}</text>
        `
        )
        .join('')}
    </svg>
  `;

  const tooltip = container.querySelector('[data-role="rm-tooltip"]');
  container.querySelectorAll('.rm-point').forEach((dot) => {
    const show = () => {
      const p = coords[Number(dot.dataset.idx)];
      if (!p || !tooltip) return;
      tooltip.innerHTML = `
        <span class="text-secondary">${formatKoreanDate(p.date)} · ${p.weight}kg × ${p.reps}회</span>
        <strong class="tabular text-mint">추정 1RM ${p.rm} kg</strong>
      `;
    };
    dot.addEventListener('click', show);
    dot.addEventListener('mouseenter', show);
  });
}

export function renderMuscleChart(container, workouts, mode = 'sets') {
  const totals = {};
  Object.keys(MUSCLE_GROUPS).forEach((m) => {
    totals[m] = 0;
  });

  for (const w of workouts) {
    const stats = calcWorkoutStats(w.exercises);
    for (const [m, val] of Object.entries(stats.muscleStats)) {
      totals[m] = (totals[m] || 0) + (mode === 'volume' ? val.volume : val.sets);
    }
  }

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  if (grandTotal <= 0) {
    container.innerHTML = '<div class="chart-empty">완료된 운동 세트가 쌓이면 부위별 자극 비중이 표시됩니다.</div>';
    return;
  }

  const rows = Object.entries(totals)
    .map(([muscle, value]) => ({
      muscle,
      value: Math.round(value),
      pct: Math.round((value / grandTotal) * 100),
      color: MUSCLE_GROUPS[muscle].color
    }))
    .sort((a, b) => b.value - a.value);

  const size = 128;
  const cx = size / 2;
  const cy = size / 2;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  const segments = rows
    .filter((item) => item.value > 0)
    .map((item) => {
      const len = (item.value / grandTotal) * circumference;
      const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${item.color}" stroke-width="15" stroke-dasharray="${len.toFixed(2)} ${(circumference - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
      return seg;
    })
    .join('');

  const unit = mode === 'volume' ? 'kg' : '세트';

  container.innerHTML = `
    <div class="muscle-viz-wrap">
      <div class="muscle-donut-wrap">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="부위별 자극 비중 도넛 차트">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="15"/>
          ${segments}
          <text x="${cx}" y="${cy - 3}" text-anchor="middle" fill="#F8FAFC" font-size="14" font-weight="800">${formatNum(grandTotal)}</text>
          <text x="${cx}" y="${cy + 14}" text-anchor="middle" fill="#94A3B8" font-size="10">총 ${unit}</text>
        </svg>
      </div>
      <div class="muscle-bars">
        ${rows
          .map(
            (item) => `
            <div class="muscle-bar-item">
              <div class="muscle-bar-label">
                <span><strong style="color:${item.color}">●</strong> ${item.muscle}</span>
                <span class="tabular text-secondary">${formatNum(item.value)}${unit} (${item.pct}%)</span>
              </div>
              <div class="muscle-bar-track">
                <div class="muscle-bar-fill" style="width:${item.pct}%;background:${item.color}"></div>
              </div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>
  `;
}

export function renderCalendar(container, year, month, workoutDatesSet, selectedDate, todayStr, onSelectDate, onChangeMonth) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  const cells = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push('<span class="cal-day empty"></span>');
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const classes = ['cal-day'];
    if (workoutDatesSet.has(dateStr)) classes.push('has-workout');
    if (dateStr === todayStr) classes.push('today');
    if (dateStr === selectedDate) classes.push('selected');
    cells.push(`<button type="button" class="${classes.join(' ')}" data-cal-date="${dateStr}">${d}</button>`);
  }

  container.innerHTML = `
    <div class="cal-header">
      <button type="button" class="btn btn-ghost btn-xs" data-cal-nav="-1">◀ 이전</button>
      <span class="cal-month-title">${year}년 ${month + 1}월</span>
      <button type="button" class="btn btn-ghost btn-xs" data-cal-nav="1">다음 ▶</button>
    </div>
    <div class="cal-weekdays">${weekdays.map((w) => `<span>${w}</span>`).join('')}</div>
    <div class="cal-days">${cells.join('')}</div>
  `;

  container.querySelectorAll('[data-cal-nav]').forEach((btn) => {
    btn.addEventListener('click', () => onChangeMonth(Number(btn.dataset.calNav)));
  });
  container.querySelectorAll('[data-cal-date]').forEach((btn) => {
    btn.addEventListener('click', () => onSelectDate(btn.dataset.calDate));
  });
}
