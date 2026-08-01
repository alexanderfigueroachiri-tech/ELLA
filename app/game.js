(() => {
  const COLORS = {
    rose: '#ff6b8a',
    sky: '#6bb7ff',
    gold: '#ffc857',
    mint: '#6dcdb8',
    lilac: '#c59bff',
    coral: '#ff8f6b',
    brown: '#c48a5a',
  };

  const PASSENGER_LABELS = {
    rose: 'cariño',
    sky: 'abrazos',
    gold: 'risas',
    mint: 'conciertos',
    lilac: 'Ed Sheeran',
    coral: 'carne asada',
    brown: 'Paco Yonque',
  };

  const THEME_ICON = {
    rose: '💗',
    sky: '🤗',
    gold: '😆',
    mint: '🎤',
    lilac: '🎸',
    coral: '🥩',
    brown: '🐶',
  };

  const BUS_SCENE = {
    rose: '💕',
    sky: '🫂',
    gold: '😂',
    mint: '🎶',
    lilac: '🎸',
    coral: '🔥',
    brown: '🐾',
  };

  const STORAGE_KEY = 'ella-camino-v4';
  const sfx = window.EllaSFX || {
    unlock() {},
    toggle() { return false; },
    isMuted() { return false; },
    tap() {},
    bump() {},
    whoosh() {},
    board() {},
    depart() {},
    win() {},
    softlock() {},
  };

  const state = {
    unlocked: 1,
    done: {},
    currentLevel: null,
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      state.unlocked = data.unlocked || 1;
      state.done = data.done || {};
    } catch (_) {}
  }

  function saveProgress() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ unlocked: state.unlocked, done: state.done })
    );
  }

  const screens = {
    splash: document.getElementById('splash'),
    map: document.getElementById('map-screen'),
    intro: document.getElementById('intro-screen'),
    jam: document.getElementById('jam-screen'),
    cozy: document.getElementById('cozy-screen'),
    cartoon: document.getElementById('cartoon-screen'),
    finale: document.getElementById('finale-screen'),
  };

  const memoryEl = document.getElementById('memory');
  const toastEl = document.getElementById('toast');

  function showScreen(name) {
    Object.values(screens).forEach((el) => el?.classList.remove('active'));
    screens[name].classList.add('active');
    if (typeof tequyOnScreen === 'function') tequyOnScreen(name);
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }

  function renderMap() {
    document.querySelectorAll('.level-card').forEach((card) => {
      const n = Number(card.dataset.level);
      card.classList.toggle('locked', n > state.unlocked);
      card.classList.toggle('done', !!state.done[n]);
      const status = card.querySelector('.level-status');
      if (state.done[n]) status.textContent = 'Listo';
      else if (n === state.unlocked) status.textContent = 'Abrir';
      else if (n < state.unlocked) status.textContent = 'Revisar';
      else status.textContent = '🔒';
    });
  }

  function completeLevel(n, memory) {
    state.done[n] = true;
    state.unlocked = Math.max(state.unlocked, n + 1);
    saveProgress();
    renderMap();
    openMemory(memory, () => showScreen('map'));
  }

  function openMemory(memory, onClose) {
    const img = memoryEl.querySelector('img');
    const title = memoryEl.querySelector('h3');
    const text = memoryEl.querySelector('p');
    const btn = memoryEl.querySelector('.btn');

    if (memory.photo) {
      img.style.display = 'block';
      img.src = memory.photo;
      img.alt = memory.title;
    } else {
      img.style.display = 'none';
    }
    title.textContent = memory.title;
    text.textContent = memory.text;
    memoryEl.classList.add('open');

    btn.onclick = () => {
      memoryEl.classList.remove('open');
      onClose?.();
    };
  }

  /* ---------- Level 1 ---------- */
  function startIntro() {
    showScreen('intro');
    const noBtn = document.getElementById('no-btn');
    noBtn.style.left = '55%';
    noBtn.style.top = '70px';
  }

  document.getElementById('intro-back').addEventListener('click', () => showScreen('map'));

  document.getElementById('yes-btn').addEventListener('click', () => {
    sfx.unlock();
    completeLevel(1, {
      photo: 'assets/nosotros.jpg',
      title: 'Para ti',
      text: 'No se me olvidó tu día, amor de mi vida. Aunque estemos lejos, quise dejarte algo hecho a mano: un caminito solo tuyo.',
    });
  });

  document.getElementById('no-btn').addEventListener('pointerenter', dodgeNo);
  document.getElementById('no-btn').addEventListener('pointerdown', dodgeNo);

  function dodgeNo(e) {
    const btn = e.currentTarget;
    const parent = btn.parentElement.getBoundingClientRect();
    const x = 8 + Math.random() * Math.max(20, parent.width - 120);
    const y = 8 + Math.random() * Math.max(20, parent.height - 60);
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
  }

  /* ---------- Atasco: buses 1–4 ---------- */
  const ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
  const DELTA = {
    up: [-1, 0],
    down: [1, 0],
    left: [0, -1],
    right: [0, 1],
  };

  const jam = {
    level: null,
    vehicles: [],
    queue: [],
    bays: [],
    bayLimit: 4,
    cell: 48,
    gap: 6,
    cols: 5,
    rows: 6,
    busy: false,
    won: false,
    blows: 1,
    softWarned: false,
  };

  /**
   * front (r,c) = trompa del bus (hacia donde apunta la flecha).
   * El cuerpo crece en dirección contraria. len = asientos (1–4).
   */
  // 9x9 denso: capas desde el borde (estilo mockup), buses 1–3 con “ventanita”.
  const JAM_LEVELS = {
    2: {
      title: 'Atasco de cariño',
      hint: 'Hay un montón de buses. Empieza por los que miran afuera; luego el centro.',
      cols: 9,
      rows: 9,
      bayLimit: 5,
      blows: 4,
      queue: [
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'gold', 'sky', 'mint', 'lilac', 'coral', 'brown',
        'rose', 'sky', 'lilac', 'brown',
      ],
      vehicles: [
        { id: 'b0', r: 0, c: 0, dir: 'up', len: 1, color: 'rose' },
        { id: 'b1', r: 0, c: 1, dir: 'up', len: 2, color: 'gold' },
        { id: 'b2', r: 0, c: 2, dir: 'up', len: 1, color: 'sky' },
        { id: 'b3', r: 0, c: 3, dir: 'up', len: 3, color: 'mint' },
        { id: 'b4', r: 0, c: 4, dir: 'up', len: 1, color: 'lilac' },
        { id: 'b5', r: 0, c: 5, dir: 'up', len: 2, color: 'coral' },
        { id: 'b6', r: 0, c: 6, dir: 'up', len: 1, color: 'brown' },
        { id: 'b7', r: 0, c: 7, dir: 'up', len: 3, color: 'rose' },
        { id: 'b8', r: 0, c: 8, dir: 'up', len: 1, color: 'gold' },
        { id: 'b9', r: 8, c: 0, dir: 'down', len: 2, color: 'sky' },
        { id: 'b10', r: 8, c: 1, dir: 'down', len: 1, color: 'mint' },
        { id: 'b11', r: 8, c: 2, dir: 'down', len: 3, color: 'lilac' },
        { id: 'b12', r: 8, c: 3, dir: 'down', len: 1, color: 'coral' },
        { id: 'b13', r: 8, c: 4, dir: 'down', len: 2, color: 'brown' },
        { id: 'b14', r: 8, c: 5, dir: 'down', len: 1, color: 'rose' },
        { id: 'b15', r: 8, c: 6, dir: 'down', len: 3, color: 'gold' },
        { id: 'b16', r: 8, c: 7, dir: 'down', len: 1, color: 'sky' },
        { id: 'b17', r: 8, c: 8, dir: 'down', len: 2, color: 'mint' },
        { id: 'b18', r: 1, c: 0, dir: 'left', len: 1, color: 'sky' },
        { id: 'b19', r: 1, c: 8, dir: 'right', len: 1, color: 'lilac' },
        { id: 'b20', r: 2, c: 0, dir: 'left', len: 2, color: 'mint' },
        { id: 'b21', r: 2, c: 8, dir: 'right', len: 1, color: 'coral' },
        { id: 'b22', r: 3, c: 0, dir: 'left', len: 1, color: 'lilac' },
        { id: 'b23', r: 3, c: 8, dir: 'right', len: 3, color: 'brown' },
        { id: 'b24', r: 4, c: 0, dir: 'left', len: 3, color: 'coral' },
        { id: 'b25', r: 4, c: 8, dir: 'right', len: 1, color: 'rose' },
        { id: 'b26', r: 5, c: 0, dir: 'left', len: 1, color: 'brown' },
        { id: 'b27', r: 5, c: 8, dir: 'right', len: 2, color: 'gold' },
        { id: 'b28', r: 6, c: 0, dir: 'left', len: 2, color: 'rose' },
        { id: 'b29', r: 6, c: 8, dir: 'right', len: 1, color: 'sky' },
        { id: 'b30', r: 1, c: 2, dir: 'up', len: 2, color: 'mint' },
        { id: 'b31', r: 1, c: 4, dir: 'up', len: 2, color: 'coral' },
        { id: 'b32', r: 1, c: 6, dir: 'up', len: 2, color: 'rose' },
        { id: 'b33', r: 2, c: 5, dir: 'up', len: 2, color: 'rose' },
        { id: 'b34', r: 3, c: 1, dir: 'left', len: 2, color: 'mint' },
        { id: 'b35', r: 3, c: 3, dir: 'up', len: 2, color: 'brown' },
        { id: 'b36', r: 3, c: 4, dir: 'up', len: 2, color: 'rose' },
        { id: 'b37', r: 4, c: 5, dir: 'up', len: 2, color: 'sky' },
        { id: 'b38', r: 4, c: 6, dir: 'up', len: 2, color: 'mint' },
        { id: 'b39', r: 4, c: 7, dir: 'up', len: 1, color: 'rose' },
        { id: 'b40', r: 5, c: 1, dir: 'left', len: 2, color: 'coral' },
        { id: 'b41', r: 5, c: 3, dir: 'up', len: 2, color: 'gold' },
        { id: 'b42', r: 5, c: 4, dir: 'up', len: 2, color: 'sky' },
        { id: 'b43', r: 6, c: 5, dir: 'up', len: 2, color: 'lilac' },
        { id: 'b44', r: 6, c: 7, dir: 'up', len: 2, color: 'brown' },
        { id: 'b45', r: 7, c: 1, dir: 'up', len: 1, color: 'rose' },
        { id: 'b46', r: 7, c: 3, dir: 'up', len: 1, color: 'rose' },
      ],
      winMemory: {
        photo: 'assets/cita-mesa.jpg',
        title: 'Esa mesa, nosotros',
        text: 'Carne, risas, corazones en la pared… y tú haciendo carita. Me gusta recordarnos así.',
      },
    },
  };

  function cellsOf(v) {
    const [dr, dc] = DELTA[v.dir];
    const cells = [];
    for (let i = 0; i < v.len; i++) {
      cells.push({ r: v.r - dr * i, c: v.c - dc * i });
    }
    return cells;
  }

  function inBoundsCell(r, c, cols = jam.cols, rows = jam.rows) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function validateVehicles(list, cols, rows) {
    const seen = new Set();
    for (const v of list) {
      const [dr, dc] = DELTA[v.dir];
      for (let i = 0; i < v.len; i++) {
        const cell = { r: v.r - dr * i, c: v.c - dc * i };
        if (!inBoundsCell(cell.r, cell.c, cols, rows)) {
          console.warn('Bus fuera del mapa', v, cell);
          return false;
        }
        const key = `${cell.r},${cell.c}`;
        if (seen.has(key)) {
          console.warn('Solape', v, key);
          return false;
        }
        seen.add(key);
      }
    }
    return true;
  }

  function startJam(levelId) {
    const def = JAM_LEVELS[levelId];
    if (!def) return;
    state.currentLevel = levelId;
    jam.level = def;
    jam.cols = def.cols;
    jam.rows = def.rows;
    if (!validateVehicles(def.vehicles, def.cols, def.rows)) {
      console.error('Nivel inválido', levelId);
      toast('Nivel con error de diseño');
      return;
    }
    jam.bayLimit = def.bayLimit;
    jam.blows = def.blows ?? 1;
    jam.queue = [...def.queue];
    jam.bays = [];
    jam.vehicles = def.vehicles.map((v) => ({ ...v }));
    jam.busy = false;
    jam.won = false;
    jam.softWarned = false;

    document.getElementById('jam-title').textContent = def.title;
    document.getElementById('jam-hint').textContent = def.hint;
    document.getElementById('softlock').classList.remove('show');
    updateBlowBtn();
    showScreen('jam');
    sfx.unlock();
    requestAnimationFrame(() => {
      layoutLot();
      renderJam();
    });
  }

  function updateBlowBtn() {
    const btn = document.getElementById('jam-blow');
    if (!btn) return;
    btn.disabled = jam.blows <= 0;
    btn.textContent = jam.blows > 0 ? `Soplo de Ale (${jam.blows})` : 'Sin soplos';
  }

  function layoutLot() {
    const lot = document.getElementById('lot');
    const w = lot.clientWidth;
    const h = lot.clientHeight;
    jam.gap = Math.max(3, Math.min(5, Math.floor(Math.min(w, h) / 90)));
    const cellW = (w - jam.gap * (jam.cols + 1)) / jam.cols;
    const cellH = (h - jam.gap * (jam.rows + 1)) / jam.rows;
    jam.cell = Math.max(16, Math.floor(Math.min(cellW, cellH)));
    jam.stride = jam.cell + jam.gap;
    const gridW = jam.cell * jam.cols + jam.gap * (jam.cols + 1);
    const gridH = jam.cell * jam.rows + jam.gap * (jam.rows + 1);
    jam.offsetX = Math.floor((w - gridW) / 2);
    jam.offsetY = Math.floor((h - gridH) / 2);
  }

  function cellPos(r, c) {
    return {
      left: jam.offsetX + jam.gap + c * jam.stride,
      top: jam.offsetY + jam.gap + r * jam.stride,
    };
  }

  function occupiedMap(ignoreId) {
    const map = new Set();
    jam.vehicles.forEach((v) => {
      if (v.id === ignoreId) return;
      cellsOf(v).forEach((cell) => map.add(`${cell.r},${cell.c}`));
    });
    return map;
  }

  function probePath(v) {
    const [dr, dc] = DELTA[v.dir];
    const occ = occupiedMap(v.id);
    let freeSteps = 0;
    let r = v.r;
    let c = v.c;

    while (true) {
      const nr = r + dr;
      const nc = c + dc;
      if (!inBoundsCell(nr, nc)) {
        return { canExit: true, freeSteps };
      }
      if (occ.has(`${nr},${nc}`)) {
        return { canExit: false, freeSteps };
      }
      freeSteps += 1;
      r = nr;
      c = nc;
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function findBoardableBayIndex() {
    if (!jam.queue.length) return -1;
    const need = jam.queue[0];
    return jam.bays.findIndex((b) => b.color === need && b.boarded < b.cap);
  }

  async function animatePassengerToBay(color, bayIndex) {
    const queueEl = document.querySelector('#queue-track .passenger.next');
    const bayEl = document.querySelectorAll('#bays .bay')[bayIndex];
    if (!queueEl || !bayEl) {
      sfx.board();
      return;
    }

    const from = queueEl.getBoundingClientRect();
    const to = bayEl.getBoundingClientRect();
    const flyer = document.createElement('div');
    flyer.className = 'board-flyer';
    flyer.style.setProperty('--pcolor', COLORS[color]);
    flyer.style.left = `${from.left + from.width / 2 - 22}px`;
    flyer.style.top = `${from.top + from.height / 2 - 22}px`;
    flyer.innerHTML = `
      <div class="person">
        <span class="head"></span>
        <span class="body"></span>
      </div>
    `;
    document.body.appendChild(flyer);
    bayEl.classList.add('boarding');
    queueEl.style.opacity = '0.25';

    await sleep(20);
    flyer.style.left = `${to.left + to.width / 2 - 22}px`;
    flyer.style.top = `${to.top + to.height / 2 - 22}px`;
    flyer.style.transform = 'scale(0.45)';
    flyer.style.opacity = '0.15';
    sfx.board();
    await sleep(430);
    flyer.remove();
    bayEl.classList.remove('boarding');
  }

  async function animateBayDepart(bayIndex) {
    const bayEl = document.querySelectorAll('#bays .bay')[bayIndex];
    if (bayEl) {
      bayEl.classList.add('departing');
      sfx.depart();
      await sleep(420);
    } else {
      sfx.depart();
    }
  }

  /** Aborda de a uno con animación visible (ya no es instantáneo). */
  async function processBaysAnimated() {
    while (true) {
      const idx = findBoardableBayIndex();
      if (idx < 0) break;

      const color = jam.queue[0];
      await animatePassengerToBay(color, idx);
      jam.queue.shift();
      jam.bays[idx].boarded += 1;
      renderJam();

      if (jam.bays[idx] && jam.bays[idx].boarded >= jam.bays[idx].cap) {
        await animateBayDepart(idx);
        jam.bays.splice(idx, 1);
        renderJam();
      }
    }
  }

  function isSoftlocked() {
    // Solo pierdes si las 4 plazas están ocupadas Y ninguna puede subir
    // a la persona del frente. Plazas libres = sigues jugando.
    if (!jam.queue.length || jam.busy || jam.won) return false;
    if (jam.bays.length < jam.bayLimit) return false;
    const need = jam.queue[0];
    return !jam.bays.some((b) => b.color === need && b.boarded < b.cap);
  }

  function drawLotDecor(lot) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const grid = document.createElementNS(svgNS, 'svg');
    grid.classList.add('lot-grid');
    grid.setAttribute('width', '100%');
    grid.setAttribute('height', '100%');

    for (let r = 0; r < jam.rows; r++) {
      for (let c = 0; c < jam.cols; c++) {
        const p = cellPos(r, c);
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', p.left);
        rect.setAttribute('y', p.top);
        rect.setAttribute('width', jam.cell);
        rect.setAttribute('height', jam.cell);
        rect.setAttribute('rx', Math.max(8, jam.cell * 0.22));
        rect.setAttribute('fill', 'rgba(255,255,255,0.03)');
        rect.setAttribute('stroke', 'rgba(255,255,255,0.05)');
        rect.setAttribute('stroke-dasharray', '3 5');
        grid.appendChild(rect);
      }
    }
    lot.appendChild(grid);

    ['top', 'right', 'bottom', 'left'].forEach((side) => {
      const mark = document.createElement('div');
      mark.className = `lot-exit ${side}`;
      mark.textContent = { top: '↑', right: '→', bottom: '↓', left: '←' }[side];
      lot.appendChild(mark);
    });
  }

  function busBox(v) {
    const cells = cellsOf(v);
    let minR = Infinity;
    let minC = Infinity;
    let maxR = -Infinity;
    let maxC = -Infinity;
    cells.forEach((cell) => {
      minR = Math.min(minR, cell.r);
      minC = Math.min(minC, cell.c);
      maxR = Math.max(maxR, cell.r);
      maxC = Math.max(maxC, cell.c);
    });
    const topLeft = cellPos(minR, minC);
    const width = (maxC - minC) * jam.stride + jam.cell;
    const height = (maxR - minR) * jam.stride + jam.cell;
    return { left: topLeft.left, top: topLeft.top, width, height, minR, minC };
  }

  function renderJam() {
    const remaining = document.getElementById('queue-count');
    if (remaining) remaining.textContent = `${jam.queue.length} en fila`;

    const queueTrack = document.getElementById('queue-track');
    const visible = jam.queue.slice(0, 14);
    const hidden = Math.max(0, jam.queue.length - visible.length);
    queueTrack.innerHTML =
      visible
        .map(
          (color, i) => `
        <div class="passenger ${i === 0 ? 'next' : ''}" style="--pcolor:${COLORS[color]}; --pring:${COLORS[color]}">
          <div class="picon" aria-hidden="true">${THEME_ICON[color] || '✦'}</div>
          <span class="pname">${PASSENGER_LABELS[color] || color}</span>
        </div>`
        )
        .join('') +
      (hidden
        ? `<div class="passenger more">+${hidden}<span>más →</span></div>`
        : '');

    const baysEl = document.getElementById('bays');
    baysEl.style.gridTemplateColumns = `repeat(${jam.bayLimit}, 1fr)`;
    baysEl.innerHTML = '';
    for (let i = 0; i < jam.bayLimit; i++) {
      const bay = document.createElement('div');
      bay.className = 'bay';
      if (jam.bays[i]) {
        const b = jam.bays[i];
        bay.classList.add('filled');
        bay.style.setProperty('--bayc', COLORS[b.color]);
        bay.innerHTML = `
          <div class="bay-bus">${BUS_SCENE[b.color] || '🚌'}</div>
          <div class="bay-meta">${PASSENGER_LABELS[b.color]}</div>
          <div class="bay-seats">${'●'.repeat(b.boarded)}${'○'.repeat(b.cap - b.boarded)}</div>
        `;
      } else {
        bay.innerHTML = '<span class="bay-empty">plaza</span><span class="bay-mini" aria-hidden="true">🏘️</span>';
      }
      baysEl.appendChild(bay);
    }

    const lot = document.getElementById('lot');
    lot.innerHTML = '';
    drawLotDecor(lot);

    jam.vehicles.forEach((v) => {
      const box = busBox(v);
      const btn = document.createElement('button');
      btn.className = `bus bus-${v.dir} bus-len-${v.len} bus-theme-${v.color}`;
      btn.type = 'button';
      btn.dataset.id = v.id;
      btn.style.left = `${box.left}px`;
      btn.style.top = `${box.top}px`;
      btn.style.width = `${box.width}px`;
      btn.style.height = `${box.height}px`;
      btn.style.setProperty('--busc', COLORS[v.color]);
      btn.title = `${PASSENGER_LABELS[v.color]} · ${v.len} asiento${v.len > 1 ? 's' : ''}`;
      const panes = Array.from({ length: Math.min(v.len, 4) }, (_, i) => {
        const icon = i === 0 ? (BUS_SCENE[v.color] || '🚌') : '·';
        return `<span class="bus-window"><span class="bus-scene">${icon}</span></span>`;
      }).join('');
      btn.innerHTML = `
        <span class="bus-bevel"></span>
        <span class="bus-shine"></span>
        <span class="bus-windows">${panes}</span>
        <span class="bus-nose"></span>
        <span class="bus-arrow">${ARROWS[v.dir]}</span>
        <span class="bus-cap">${v.len}</span>
        <span class="bus-wheel w1"></span>
        <span class="bus-wheel w2"></span>
      `;
      btn.addEventListener('click', () => onBusTap(v.id));
      lot.appendChild(btn);
    });

    const soft = document.getElementById('softlock');
    const locked = isSoftlocked();
    soft.classList.toggle('show', locked);
    if (locked && !jam.softWarned) {
      jam.softWarned = true;
      sfx.softlock();
      if (typeof tequySay === 'function') tequySay('jamSoft', 'kick');
    }
    if (!locked) jam.softWarned = false;

    if (!jam.queue.length && !jam.won) {
      jam.won = true;
      sfx.win();
      if (typeof tequySay === 'function') tequySay('jamWin', 'happy');
      setTimeout(() => completeLevel(2, jam.level.winMemory), 700);
    }

    updateBlowBtn();
  }

  function animateTo(el, left, top, ms) {
    return new Promise((resolve) => {
      el.style.transition = `left ${ms}ms cubic-bezier(0.22, 1, 0.36, 1), top ${ms}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${ms}ms ease`;
      void el.offsetWidth;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      setTimeout(resolve, ms + 20);
    });
  }

  async function onBusTap(id) {
    if (jam.busy || jam.won) return;
    const v = jam.vehicles.find((x) => x.id === id);
    if (!v) return;
    const el = document.querySelector(`.bus[data-id="${id}"]`);
    if (!el) return;

    sfx.tap();
    const path = probePath(v);
    const [dr, dc] = DELTA[v.dir];
    const start = busBox(v);

    if (path.canExit && jam.bays.length >= jam.bayLimit) {
      toast('Plazas llenas — usa un soplo o reinicia');
      sfx.bump();
      return;
    }

    jam.busy = true;
    el.classList.add('moving');

    if (!path.canExit) {
      const travel = path.freeSteps;
      const bump = 0.38;
      const hitLeft = start.left + (travel + bump) * dc * jam.stride;
      const hitTop = start.top + (travel + bump) * dr * jam.stride;
      const dur = 120 + travel * 80;
      await animateTo(el, hitLeft, hitTop, dur);
      sfx.bump();
      el.classList.add('bounce-hit');
      toast(travel === 0 ? '¡Paf! Pegadito' : '¡Paf! Se asustó');
      await animateTo(el, start.left, start.top, 160 + travel * 35);
      el.classList.remove('bounce-hit', 'moving');
      jam.busy = false;
      return;
    }

    const escape = path.freeSteps + 1.5;
    sfx.whoosh();
    await animateTo(
      el,
      start.left + escape * dc * jam.stride,
      start.top + escape * dr * jam.stride,
      160 + path.freeSteps * 70
    );
    el.style.opacity = '0';

    jam.vehicles = jam.vehicles.filter((x) => x.id !== id);
    jam.bays.push({
      color: v.color,
      dir: v.dir,
      cap: v.len,
      boarded: 0,
    });
    renderJam();
    await processBaysAnimated();
    jam.busy = false;
    renderJam();
  }

  document.getElementById('jam-reset').addEventListener('click', () => {
    if (state.currentLevel) startJam(state.currentLevel);
  });

  document.getElementById('jam-blow')?.addEventListener('click', async () => {
    if (jam.blows <= 0 || jam.busy) return;
    if (!jam.bays.length) {
      toast('No hay buses en las plazas');
      return;
    }
    jam.busy = true;
    const need = jam.queue[0];
    let idx = jam.bays.findIndex((b) => b.color !== need);
    if (idx < 0) idx = 0;
    jam.bays.splice(idx, 1);
    jam.blows -= 1;
    sfx.whoosh();
    toast('Soplo de Ale 💨');
    renderJam();
    await processBaysAnimated();
    jam.busy = false;
    renderJam();
  });

  document.getElementById('jam-mute')?.addEventListener('click', () => {
    const muted = sfx.toggle();
    document.getElementById('jam-mute').textContent = muted ? '🔇' : '🔊';
  });

  document.getElementById('jam-back').addEventListener('click', () => showScreen('map'));

  window.addEventListener('resize', () => {
    if (screens.jam.classList.contains('active') && jam.level) {
      layoutLot();
      renderJam();
    }
  });

  /* ---------- Level 3 ---------- */
  function startCozy() {
    showScreen('cozy');
  }

  document.getElementById('cozy-next').addEventListener('click', () => {
    completeLevel(3, {
      photo: 'assets/oso-manoso.jpg',
      title: 'El oso mañoso',
      text: 'Él se queda cuidando el cuarto. Yo, aunque esté lejos, sigo queriendo abrazarte y olerte como siempre.',
    });
  });

  document.getElementById('cozy-back').addEventListener('click', () => showScreen('map'));

  /* ---------- Level 4: caricaturas ---------- */
  function startCartoon() {
    showScreen('cartoon');
  }

  document.getElementById('cartoon-back').addEventListener('click', () => showScreen('map'));

  document.getElementById('cartoon-next').addEventListener('click', () => {
    completeLevel(4, {
      photo: 'assets/historia/emociones.png',
      title: 'Como te cuido',
      text: 'No puedo arreglarte la vida… pero sí buscar que estés bien, de la manera que sea. Porque me importas demasiado.',
    });
  });

  /* ---------- Level 5 ---------- */
  function startFinale() {
    showScreen('finale');
    state.done[5] = true;
    state.unlocked = Math.max(state.unlocked, 5);
    saveProgress();
    renderMap();
  }

  document.getElementById('finale-back').addEventListener('click', () => showScreen('map'));

  document.getElementById('reset-progress').addEventListener('click', () => {
    if (!confirm('¿Borrar progreso y empezar de cero?')) return;
    localStorage.removeItem(STORAGE_KEY);
    state.unlocked = 1;
    state.done = {};
    saveProgress();
    renderMap();
    toast('Progreso reiniciado');
  });

  /* ---------- Splash: términos y condiciones ---------- */
  const termsSheet = document.getElementById('terms-sheet');
  const termsScroll = document.getElementById('terms-scroll');
  const termsEnd = document.getElementById('terms-end');
  const termsAccept = document.getElementById('terms-accept');
  const termsOpen = document.getElementById('terms-open');
  const termsHint = document.getElementById('terms-hint');
  const termsScrollHint = document.getElementById('terms-scroll-hint');
  const enterBtn = document.getElementById('enter-btn');
  let termsRead = false;
  let termsAccepted = false;

  function openTerms() {
    if (!termsSheet) return;
    termsSheet.hidden = false;
    termsOpen?.setAttribute('aria-expanded', 'true');
    if (!termsRead) {
      termsAccept.disabled = true;
      if (termsScrollHint) termsScrollHint.hidden = false;
    } else {
      termsAccept.disabled = false;
      if (termsScrollHint) {
        termsScrollHint.textContent = 'Ya llegaste al final. Puedes aceptar.';
        termsScrollHint.hidden = false;
      }
    }
    // Pequeño delay para que el layout mida el scroll
    requestAnimationFrame(() => {
      termsScroll?.focus({ preventScroll: true });
      watchTermsEnd();
    });
  }

  function closeTerms() {
    if (!termsSheet) return;
    termsSheet.hidden = true;
    termsOpen?.setAttribute('aria-expanded', 'false');
  }

  function markTermsRead() {
    if (termsRead) return;
    termsRead = true;
    termsAccept.disabled = false;
    if (termsScrollHint) {
      termsScrollHint.textContent = 'Ya llegaste al “Te amo”. Puedes aceptar.';
    }
    sfx.tap();
  }

  let termsObserver = null;
  function watchTermsEnd() {
    if (!termsEnd || !termsScroll) return;
    termsObserver?.disconnect();
    // Si el contenido cabe sin scroll, cuenta como leído
    if (termsScroll.scrollHeight <= termsScroll.clientHeight + 8) {
      markTermsRead();
      return;
    }
    termsObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) markTermsRead();
      },
      { root: termsScroll, threshold: 0.7 }
    );
    termsObserver.observe(termsEnd);

    termsScroll.onscroll = () => {
      const nearBottom =
        termsScroll.scrollTop + termsScroll.clientHeight >= termsScroll.scrollHeight - 24;
      if (nearBottom) markTermsRead();
    };
  }

  termsOpen?.addEventListener('click', openTerms);
  document.getElementById('terms-close')?.addEventListener('click', closeTerms);
  document.getElementById('terms-backdrop')?.addEventListener('click', closeTerms);

  termsAccept?.addEventListener('click', () => {
    if (!termsRead) return;
    termsAccepted = true;
    enterBtn.disabled = false;
    termsOpen?.classList.add('is-done');
    const chipCopy = termsOpen?.querySelector('small');
    if (chipCopy) chipCopy.textContent = 'Aceptados · gracias por leer';
    if (termsHint) termsHint.textContent = 'Términos aceptados. Ya puedes empezar.';
    sfx.unlock();
    closeTerms();
  });

  /* ---------- Nav ---------- */
  enterBtn?.addEventListener('click', () => {
    if (enterBtn.disabled || !termsAccepted) {
      openTerms();
      return;
    }
    sfx.unlock();
    showScreen('map');
    renderMap();
  });

  document.getElementById('map-back').addEventListener('click', () => showScreen('splash'));

  // TODO(QUITAR ANTES DEL REGALO): Trampa — desbloquea todos los niveles en pruebas.
  // Recuérdale a Ale: borrar #trampa-btn + este handler antes de mandárselo al amor de su vida.
  document.getElementById('trampa-btn')?.addEventListener('click', () => {
    state.unlocked = 5;
    [1, 2, 3, 4, 5].forEach((n) => {
      state.done[n] = state.done[n] || false;
    });
    saveProgress();
    renderMap();
    toast('Trampa ON · todos los niveles abiertos');
  });

  document.querySelectorAll('.level-card').forEach((card) => {
    card.addEventListener('click', () => {
      const n = Number(card.dataset.level);
      if (n > state.unlocked) {
        toast('Todavía no… termina el anterior');
        return;
      }
      if (n === 1) startIntro();
      else if (n === 2) startJam(2);
      else if (n === 3) startCozy();
      else if (n === 4) startCartoon();
      else if (n === 5) startFinale();
    });
  });

  /* ---------- Photo lightbox + comic bits ---------- */
  const lite = document.getElementById('photo-lite');
  const liteImg = document.getElementById('photo-lite-img');
  const liteCap = document.getElementById('photo-lite-cap');
  const comicStage = document.getElementById('comic-stage');
  const COMICS = [
    () => `
      <span class="comic-bit mouse">🐭</span>
      <span class="comic-bit cat">🐱</span>
    `,
    () => `
      <span class="comic-bit giant">😋</span>
      <span class="comic-bit pizza">🍕</span>
    `,
    () => `<span class="comic-bit doll">🧸</span>`,
  ];

  function playComic() {
    if (!comicStage) return Promise.resolve();
    comicStage.innerHTML = COMICS[Math.floor(Math.random() * COMICS.length)]();
    return sleep(1100).then(() => {
      comicStage.innerHTML = '';
    });
  }

  async function openPhotoLite(src, caption) {
    if (!lite) return;
    lite.hidden = false;
    liteImg.src = src;
    liteImg.alt = caption || '';
    liteCap.textContent = caption || '';
    sfx.unlock();
    // Tequy se esconde: la foto es la protagonista
    tequyRoot?.classList.add('is-hidden');
    tequyHideBubble();
    await playComic();
    lite.classList.add('open');
  }

  function closePhotoLite() {
    if (!lite) return;
    lite.classList.remove('open');
    setTimeout(() => {
      lite.hidden = true;
      liteImg.src = '';
      // Restaurar Tequy solo si no estamos en portada/carta
      const onSplash = screens.splash.classList.contains('active');
      const onFinale = screens.finale.classList.contains('active');
      tequyRoot?.classList.toggle('is-hidden', onSplash || onFinale);
    }, 200);
  }

  document.getElementById('photo-lite-close')?.addEventListener('click', closePhotoLite);
  lite?.addEventListener('click', (e) => {
    if (e.target === lite) closePhotoLite();
  });

  document.querySelectorAll('.photo-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      openPhotoLite(btn.dataset.photo, btn.dataset.caption);
    });
  });

  // Also allow tapping memory photo
  memoryEl.querySelector('img')?.addEventListener('click', () => {
    const src = memoryEl.querySelector('img').src;
    if (src) openPhotoLite(src, memoryEl.querySelector('h3')?.textContent || '');
  });

  /* ---------- Tequy assistant ---------- */
  const tequyRoot = document.getElementById('tequy');
  const tequyImg = document.getElementById('tequy-img');
  const tequyBubble = document.getElementById('tequy-bubble');
  const tequyText = document.getElementById('tequy-text');
  const TEQUY_POSES = {
    idle: 'assets/tequy/idle.png',   // wink / manos en la cintura
    talk: 'assets/tequy/talk.png',   // speaking / gesticulando
    jump: 'assets/tequy/happy.png',  // ¡Bien! brazos arriba
    happy: 'assets/tequy/happy.png',
    kick: 'assets/tequy/kick.png',   // del sheet anterior
    side: 'assets/tequy/side.png',
  };

  const TEQUY_LINES = {
    splash: '¡Hola! Soy Tequy. Toca Empezar y te guío en el caminito 🧀',
    map: 'Elige una parada. Si te trabas, dame un toque y te tiro una pista.',
    intro: 'Ese “No” es un cobarde… ¡persíguelo! O mejor: di que sí.',
    jam: 'Mira el color de la fila. Los buses largos (3–4) se llevan más gente. ¡Yo confío en ti!',
    jamSoft: 'Uy, plazas llenas. Saca el color que pide la fila… o usa un Soplo de Ale.',
    jamWin: '¡Siiii! Lo lograste. Te mereces un abrazo… y un tequeño extra.',
    cozy: 'Modo soft activado. El oso mañoso y yo cuidamos el ambiente.',
    finale: 'Lee con calma. Y si tocas una foto… pasa algo gracioso. Yo aviso.',
    photo: '¡Click! Me encantan esas fotos. Zoom con estilo, ¿viste?',
  };

  function setTequyPose(pose) {
    if (!tequyImg || !TEQUY_POSES[pose]) return;
    tequyImg.src = TEQUY_POSES[pose];
    tequyRoot?.classList.remove('pose-talk', 'pose-jump', 'pose-kick');
    if (pose === 'talk' || pose === 'jump' || pose === 'happy' || pose === 'kick') {
      const anim = pose === 'happy' ? 'jump' : pose;
      tequyRoot?.classList.add(`pose-${anim}`);
    }
  }

  function tequySay(keyOrText, pose = 'talk') {
    // Nunca tapa portada ni lightbox de fotos
    if (screens.splash.classList.contains('active')) return;
    if (lite && !lite.hidden) return;
    if (!tequyBubble || !tequyText) return;
    const text = TEQUY_LINES[keyOrText] || keyOrText;
    tequyText.textContent = text;
    tequyBubble.hidden = false;
    setTequyPose(pose);
    sfx.tap();
  }

  function tequyHideBubble() {
    if (tequyBubble) tequyBubble.hidden = true;
    setTequyPose('idle');
  }

  /** Visibilidad: portada = ella sola. Tequy solo como ayuda bajo demanda. */
  function tequyOnScreen(name) {
    if (!tequyRoot) return;
    const hide = name === 'splash' || name === 'finale';
    tequyRoot.classList.toggle('is-hidden', hide);
    tequyHideBubble();
    if (!hide) setTequyPose(name === 'jam' ? 'talk' : 'idle');
  }

  document.getElementById('tequy-btn')?.addEventListener('click', () => {
    if (tequyBubble && !tequyBubble.hidden) {
      tequyHideBubble();
      return;
    }
    if (screens.jam.classList.contains('active')) {
      if (isSoftlocked()) tequySay('jamSoft', 'kick');
      else tequySay('jam', 'talk');
      return;
    }
    if (screens.cartoon?.classList.contains('active')) {
      tequySay('Esa historieta… eso es él cuidándote en todas las versiones. Yo solo aplaudo 🧀', 'happy');
      return;
    }
    if (screens.cozy.classList.contains('active')) {
      tequySay('cozy', 'talk');
      return;
    }
    if (screens.intro.classList.contains('active')) {
      tequySay('intro', 'talk');
      return;
    }
    if (screens.map.classList.contains('active')) {
      tequySay('map', 'idle');
      return;
    }
  });

  document.getElementById('tequy-dismiss')?.addEventListener('click', tequyHideBubble);

  // Portada limpia: sin Tequy al inicio
  tequyOnScreen('splash');

  loadProgress();
  renderMap();
})();
