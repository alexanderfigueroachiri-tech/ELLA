/** SFX sintéticos + BGM (piano suave). Arranca tras gesto del usuario (iPhone). */
window.EllaSFX = (() => {
  let ctx = null;
  let muted = false;
  let bgm = null;
  let bgmStarted = false;
  let ducked = false;
  const BGM_SRC = 'assets/bgm.mp3?v=1';
  const BGM_VOL = 0.22;
  const BGM_DUCK = 0.06;

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function ensureBgm() {
    if (bgm) return bgm;
    bgm = new Audio(BGM_SRC);
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = BGM_VOL;
    bgm.setAttribute('playsinline', '');
    return bgm;
  }

  function applyBgmVolume() {
    if (!bgm) return;
    bgm.volume = ducked ? BGM_DUCK : BGM_VOL;
  }

  function startBgm() {
    ac();
    const a = ensureBgm();
    if (muted) return;
    applyBgmVolume();
    const play = a.play();
    if (play && typeof play.catch === 'function') {
      play.catch(() => {});
    }
    bgmStarted = true;
  }

  function pauseBgm() {
    if (bgm && !bgm.paused) bgm.pause();
  }

  function resumeBgm() {
    if (!bgmStarted || muted || !bgm) return;
    applyBgmVolume();
    const play = bgm.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
  }

  function duckBgm(on) {
    ducked = !!on;
    applyBgmVolume();
  }

  function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.06, slide = 0 }) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur = 0.08, gain = 0.04) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource();
    const g = c.createGain();
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(g);
    g.connect(c.destination);
    src.start();
  }

  return {
    unlock() {
      ac();
      startBgm();
    },
    startBgm,
    pauseBgm,
    resumeBgm,
    duckBgm,
    toggle() {
      muted = !muted;
      if (muted) pauseBgm();
      else if (bgmStarted) resumeBgm();
      return muted;
    },
    isMuted() { return muted; },
    tap() { tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.04 }); },
    bump() {
      noiseBurst(0.07, 0.05);
      tone({ freq: 160, dur: 0.1, type: 'square', gain: 0.03, slide: -80 });
    },
    whoosh() { tone({ freq: 380, dur: 0.18, type: 'sawtooth', gain: 0.035, slide: 220 }); },
    board() { tone({ freq: 660, dur: 0.08, type: 'sine', gain: 0.05 }); },
    depart() {
      tone({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.05 });
      setTimeout(() => tone({ freq: 780, dur: 0.14, type: 'triangle', gain: 0.045 }), 70);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.05 }), i * 90);
      });
    },
    softlock() { tone({ freq: 140, dur: 0.25, type: 'sawtooth', gain: 0.04, slide: -60 }); },
  };
})();
