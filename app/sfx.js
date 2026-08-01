/** SFX + BGM: la música sigue el camino; no se reinicia al saltar escenas. */
window.EllaSFX = (() => {
  let ctx = null;
  let muted = false;
  let bgmStarted = false;
  let ducked = false;
  let jamQuiet = false;
  let theme = 'path'; // 'path' | 'finale'
  const fadeTimers = { path: null, finale: null };

  const TRACKS = {
    path: 'assets/bgm.mp3?v=4',
    finale: 'assets/bgm-finale.mp3?v=4',
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

  function fadeAudio(name, a, to, ms = 420) {
    if (!a) return;
    if (fadeTimers[name]) {
      clearInterval(fadeTimers[name]);
      fadeTimers[name] = null;
    }
    const from = a.volume;
    const start = performance.now();
    if (ms <= 0) {
      a.volume = Math.max(0, Math.min(1, to));
      return;
    }
    fadeTimers[name] = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / ms);
      const e = 1 - (1 - t) * (1 - t);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * e));
      if (t >= 1) {
        clearInterval(fadeTimers[name]);
        fadeTimers[name] = null;
        a.volume = Math.max(0, Math.min(1, to));
      }
    }, 32);
  }

  function fadeToTarget(ms = 500) {
    const a = current();
    if (!a) return;
    fadeAudio(theme, a, targetVolume(), ms);
  }

  /** Reproduce sin reiniciar posición (salvo firstStart). */
  function playTrack(name, { fadeMs = 500, firstStart = false } = {}) {
    const a = ensureTrack(name);
    if (muted) {
      a.pause();
      return;
    }
    if (firstStart) {
      try { a.currentTime = 0; } catch (_) {}
      a.volume = 0;
    }
    if (a.paused) {
      const play = a.play();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    }
    fadeAudio(name, a, targetVolume(), fadeMs);
  }

  function softStop(name, ms = 450) {
    const a = players[name];
    if (!a) return;
    fadeAudio(name, a, 0, ms);
    setTimeout(() => {
      if (theme !== name && a) a.pause();
      // currentTime intacto → al volver no “empieza de nuevo”
    }, ms + 40);
  }

  function startBgm() {
    if (bgmStarted) {
      // Ya suena: solo despierta el AudioContext / asegura play
      ac();
      if (!muted) playTrack(theme, { fadeMs: 280, firstStart: false });
      return;
    }
    ac();
    ensureTrack('path');
    ensureTrack('finale');
    bgmStarted = true;
    if (muted) return;
    playTrack(theme, { fadeMs: 700, firstStart: true });
  }

  function setTheme(next) {
    const want = next === 'finale' ? 'finale' : 'path';
    if (want === theme) {
      // Misma pista (mapa ↔ jam ↔ casa…): solo volumen, sin reinicio
      if (bgmStarted) {
        if (current()?.paused && !muted) playTrack(theme, { fadeMs: 400, firstStart: false });
        else fadeToTarget(480);
      }
      return;
    }
    const prev = theme;
    theme = want;
    if (!bgmStarted) return;
    softStop(prev, 500);
    playTrack(theme, { fadeMs: 650, firstStart: false });
  }

  function setJamQuiet(on) {
    const next = !!on;
    if (next === jamQuiet) return;
    jamQuiet = next;
    if (bgmStarted) fadeToTarget(520);
  }

  function pauseBgm() {
    Object.keys(players).forEach((k) => {
      const a = players[k];
      if (!a) return;
      fadeAudio(k, a, 0, 220);
      setTimeout(() => { if (muted) a.pause(); }, 240);
    });
  }

  function resumeBgm() {
    if (!bgmStarted || muted) return;
    playTrack(theme, { fadeMs: 400, firstStart: false });
  }

  function duckBgm(on) {
    const next = !!on;
    if (next === ducked) return;
    ducked = next;
    if (bgmStarted) fadeToTarget(360);
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
      // Solo arranca una vez; luego no reinicia al cambiar de escena
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
