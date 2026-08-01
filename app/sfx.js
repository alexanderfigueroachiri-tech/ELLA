/** SFX sintéticos + BGM con fades suaves (sin “rayones” al cambiar de escena). */
window.EllaSFX = (() => {
  let ctx = null;
  let muted = false;
  let bgmStarted = false;
  let ducked = false; // voz / carta
  let jamQuiet = false; // atasco: BGM más baja
  let theme = 'path'; // 'path' | 'finale'
  let fadeTimer = null;

  const TRACKS = {
    path: 'assets/bgm.mp3?v=3',
    finale: 'assets/bgm-finale.mp3?v=3',
  };
  const BGM_VOL = 0.12;
  const BGM_JAM = 0.05;
  const BGM_DUCK = 0.035;
  const players = { path: null, finale: null };

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function ensureTrack(name) {
    if (players[name]) return players[name];
    const a = new Audio(TRACKS[name]);
    a.loop = true;
    a.preload = 'auto';
    a.volume = 0;
    a.setAttribute('playsinline', '');
    players[name] = a;
    return a;
  }

  function current() {
    return players[theme];
  }

  function targetVolume() {
    if (muted) return 0;
    if (ducked) return BGM_DUCK;
    if (jamQuiet) return BGM_JAM;
    return BGM_VOL;
  }

  /** Rampa suave de volumen (evita el “rayón” de saltos bruscos). */
  function fadeAudio(a, to, ms = 420) {
    if (!a) return;
    clearInterval(fadeTimer);
    const from = a.volume;
    const start = performance.now();
    if (ms <= 0) {
      a.volume = Math.max(0, Math.min(1, to));
      return;
    }
    fadeTimer = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      // ease-out
      const e = 1 - (1 - t) * (1 - t);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * e));
      if (t >= 1) {
        clearInterval(fadeTimer);
        fadeTimer = null;
        a.volume = Math.max(0, Math.min(1, to));
      }
    }, 32);
  }

  function fadeToTarget(ms = 420) {
    const a = current();
    if (!a) return;
    fadeAudio(a, targetVolume(), ms);
  }

  function playTrack(name, { fadeMs = 480, fromZero = false } = {}) {
    const a = ensureTrack(name);
    if (muted) {
      a.pause();
      return;
    }
    if (fromZero) a.volume = 0;
    const play = a.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
    fadeAudio(a, targetVolume(), fadeMs);
  }

  function softStop(name, ms = 380) {
    const a = players[name];
    if (!a) return;
    fadeAudio(a, 0, ms);
    setTimeout(() => {
      if (theme !== name) {
        a.pause();
        // No reiniciamos currentTime: al volver sigue fluido, sin corte seco.
      }
    }, ms + 40);
  }

  function startBgm() {
    ac();
    ensureTrack('path');
    ensureTrack('finale');
    bgmStarted = true;
    if (muted) return;
    playTrack(theme, { fadeMs: 600, fromZero: true });
  }

  function setTheme(next) {
    const want = next === 'finale' ? 'finale' : 'path';
    if (want === theme) {
      if (bgmStarted) fadeToTarget(360);
      return;
    }
    const prev = theme;
    theme = want;
    if (bgmStarted) {
      softStop(prev, 400);
      playTrack(theme, { fadeMs: 520, fromZero: true });
    }
  }

  function setJamQuiet(on) {
    jamQuiet = !!on;
    if (bgmStarted) fadeToTarget(380);
  }

  function pauseBgm() {
    clearInterval(fadeTimer);
    fadeTimer = null;
    Object.keys(players).forEach((k) => {
      const a = players[k];
      if (!a) return;
      fadeAudio(a, 0, 220);
      setTimeout(() => a.pause(), 240);
    });
  }

  function resumeBgm() {
    if (!bgmStarted || muted) return;
    playTrack(theme, { fadeMs: 400 });
  }

  function duckBgm(on) {
    ducked = !!on;
    if (bgmStarted) fadeToTarget(320);
  }

  function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.06, slide = 0 }) {
    if (muted) return;
    // Sin dip de BGM: eso era lo que “rayaba” la música en cada tap.
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
    setTheme,
    setJamQuiet,
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
    jump() {
      tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.07, slide: 280 });
      setTimeout(() => tone({ freq: 780, dur: 0.09, type: 'sine', gain: 0.055, slide: 160 }), 45);
      setTimeout(() => tone({ freq: 240, dur: 0.06, type: 'square', gain: 0.025, slide: -80 }), 100);
    },
    tap() { tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.065 }); },
    bump() {
      noiseBurst(0.07, 0.065);
      tone({ freq: 160, dur: 0.1, type: 'square', gain: 0.05, slide: -80 });
    },
    whoosh() { tone({ freq: 380, dur: 0.18, type: 'sawtooth', gain: 0.055, slide: 220 }); },
    board() { tone({ freq: 660, dur: 0.08, type: 'sine', gain: 0.075 }); },
    depart() {
      tone({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.07 });
      setTimeout(() => tone({ freq: 780, dur: 0.14, type: 'triangle', gain: 0.065 }), 70);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.075 }), i * 90);
      });
    },
    softlock() { tone({ freq: 140, dur: 0.25, type: 'sawtooth', gain: 0.055, slide: -60 }); },
  };
})();
