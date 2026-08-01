/** SFX sintéticos + BGM (piano del camino + piano del arco final). */
window.EllaSFX = (() => {
  let ctx = null;
  let muted = false;
  let bgmStarted = false;
  let ducked = false; // voz / carta
  let jamQuiet = false; // atasco: BGM más baja para oír SFX
  let theme = 'path'; // 'path' | 'finale'
  let sfxDuckTimer = null;

  const TRACKS = {
    path: 'assets/bgm.mp3?v=2',
    finale: 'assets/bgm-finale.mp3?v=2',
  };
  const BGM_VOL = 0.13;
  const BGM_JAM = 0.045;
  const BGM_DUCK = 0.03;
  const BGM_SFX_DIP = 0.02; // bajón breve al sonar un efecto
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
    a.volume = BGM_VOL;
    a.setAttribute('playsinline', '');
    players[name] = a;
    return a;
  }

  function current() {
    return players[theme];
  }

  function targetVolume() {
    if (ducked) return BGM_DUCK;
    if (jamQuiet) return BGM_JAM;
    return BGM_VOL;
  }

  function applyVolume(a) {
    if (!a) return;
    a.volume = targetVolume();
  }

  function stopTrack(name) {
    const a = players[name];
    if (!a) return;
    a.pause();
    try { a.currentTime = 0; } catch (_) {}
  }

  function playTrack(name) {
    const a = ensureTrack(name);
    applyVolume(a);
    if (muted) return;
    const play = a.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
  }

  function startBgm() {
    ac();
    ensureTrack('path');
    ensureTrack('finale');
    bgmStarted = true;
    if (muted) return;
    playTrack(theme);
  }

  function setTheme(next) {
    const want = next === 'finale' ? 'finale' : 'path';
    if (want === theme && bgmStarted && current() && !current().paused) {
      applyVolume(current());
      return;
    }
    const prev = theme;
    theme = want;
    if (prev !== theme) stopTrack(prev);
    if (!bgmStarted) return;
    playTrack(theme);
  }

  function setJamQuiet(on) {
    jamQuiet = !!on;
    applyVolume(current());
  }

  function pauseBgm() {
    Object.keys(players).forEach((k) => {
      const a = players[k];
      if (a && !a.paused) a.pause();
    });
  }

  function resumeBgm() {
    if (!bgmStarted || muted) return;
    playTrack(theme);
  }

  function duckBgm(on) {
    ducked = !!on;
    applyVolume(current());
  }

  /** Baja la BGM un instante para que el SFX se oiga limpio. */
  function dipForSfx(ms = 220) {
    const a = current();
    if (!a || muted || !bgmStarted) return;
    a.volume = Math.min(a.volume, BGM_SFX_DIP);
    clearTimeout(sfxDuckTimer);
    sfxDuckTimer = setTimeout(() => applyVolume(a), ms);
  }

  function tone({ freq = 440, dur = 0.12, type = 'sine', gain = 0.06, slide = 0 }) {
    if (muted) return;
    dipForSfx(Math.max(180, dur * 1000 + 80));
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
    dipForSfx(200);
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
    /** Salto del botón “No” que huye. */
    jump() {
      tone({ freq: 520, dur: 0.07, type: 'triangle', gain: 0.07, slide: 280 });
      setTimeout(() => tone({ freq: 780, dur: 0.09, type: 'sine', gain: 0.055, slide: 160 }), 45);
      setTimeout(() => tone({ freq: 240, dur: 0.06, type: 'square', gain: 0.025, slide: -80 }), 100);
    },
    tap() { tone({ freq: 520, dur: 0.05, type: 'triangle', gain: 0.07 }); },
    bump() {
      noiseBurst(0.07, 0.07);
      tone({ freq: 160, dur: 0.1, type: 'square', gain: 0.055, slide: -80 });
    },
    whoosh() { tone({ freq: 380, dur: 0.18, type: 'sawtooth', gain: 0.06, slide: 220 }); },
    board() { tone({ freq: 660, dur: 0.08, type: 'sine', gain: 0.08 }); },
    depart() {
      tone({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.075 });
      setTimeout(() => tone({ freq: 780, dur: 0.14, type: 'triangle', gain: 0.07 }), 70);
    },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => {
        setTimeout(() => tone({ freq: f, dur: 0.16, type: 'sine', gain: 0.08 }), i * 90);
      });
    },
    softlock() { tone({ freq: 140, dur: 0.25, type: 'sawtooth', gain: 0.06, slide: -60 }); },
  };
})();
