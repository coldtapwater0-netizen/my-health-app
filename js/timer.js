export class RestTimer {
  constructor({ soundEnabled = true, onTick = () => {}, onComplete = () => {} } = {}) {
    this.soundEnabled = soundEnabled;
    this.onTick = onTick;
    this.onComplete = onComplete;
    this.totalSec = 90;
    this.remainingSec = 0;
    this.endTime = null;
    this.intervalId = null;
    this.audioCtx = null;
  }

  unlockAudio() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) {
        this.audioCtx = new Ctx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    } catch {
      // 브라우저 정책으로 오디오 컨텍스트가 제한될 수 있음
    }
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
  }

  playChime() {
    if (!this.soundEnabled) return;
    try {
      this.unlockAudio();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const notes = [
        { freq: 880, start: 0, dur: 0.16 },
        { freq: 1174.66, start: 0.18, dur: 0.28 }
      ];

      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.start);

        gain.gain.setValueAtTime(0.001, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.24, now + n.start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur + 0.02);
      }
    } catch {
      // 무음 실패 처리
    }
  }

  start(seconds) {
    const sec = Math.max(5, Math.round(Number(seconds) || 90));
    this.unlockAudio();
    this.stop(false);
    this.totalSec = sec;
    this.remainingSec = sec;
    this.endTime = Date.now() + sec * 1000;
    this._emitTick();

    this.intervalId = window.setInterval(() => {
      if (!this.endTime) return;
      const left = Math.max(0, Math.ceil((this.endTime - Date.now()) / 1000));
      if (left !== this.remainingSec) {
        this.remainingSec = left;
        this._emitTick();
      }
      if (left <= 0) {
        this.stop(false);
        this.playChime();
        if (navigator.vibrate) {
          try {
            navigator.vibrate([160, 80, 160]);
          } catch {
            // 미지원 기기 무시
          }
        }
        this.onComplete();
      }
    }, 200);
  }

  adjust(deltaSec) {
    if (!this.endTime) return;
    const nextLeft = Math.max(5, this.remainingSec + deltaSec);
    this.remainingSec = nextLeft;
    if (nextLeft > this.totalSec) this.totalSec = nextLeft;
    this.endTime = Date.now() + nextLeft * 1000;
    this._emitTick();
  }

  stop(notify = true) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.endTime = null;
    this.remainingSec = 0;
    if (notify) this._emitTick();
  }

  isRunning() {
    return this.endTime !== null;
  }

  _emitTick() {
    const progress = this.totalSec > 0 ? Math.max(0, Math.min(100, (this.remainingSec / this.totalSec) * 100)) : 0;
    this.onTick({
      running: this.isRunning(),
      remainingSec: this.remainingSec,
      totalSec: this.totalSec,
      progress
    });
  }
}

export function formatMMSS(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function formatDuration(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
