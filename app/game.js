(() => {
  // Colores bien separados (rosa / azul / amarillo / verde / violeta / naranja / marrón)
  const COLORS = {
    rose: '#ff2d6f',
    sky: '#1e8fff',
    gold: '#ffd400',
    mint: '#12c96b',
    lilac: '#9b44ff',
    coral: '#ff6a00',
    brown: '#8a4a22',
  };

  const PASSENGER_LABELS = {
    rose: 'cariño',
    sky: 'abrazos',
    gold: 'risas',
    mint: 'conciertos',
    lilac: 'Noelia',
    coral: 'carne asada',
    brown: 'Alexander',
  };

  const THEME_ICON = {
    rose: '💗',
    sky: '🤗',
    gold: '😆',
    mint: '🎤',
    lilac: '💜',
    coral: '🥩',
    brown: '💙',
  };

  const BUS_SCENE = {
    rose: '💕',
    sky: '🫂',
    gold: '😂',
    mint: '🎶',
    lilac: '💜',
    coral: '🔥',
    brown: '💙',
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
    // Arco final = carta; cierre/postcréditos también usan sakartvelo
    if (typeof sfx.setTheme === 'function') {
      sfx.setTheme(name === 'finale' ? 'finale' : 'path');
    }
    // En el atasco la BGM baja para no tapar whoosh/bump/board
    if (typeof sfx.setJamQuiet === 'function') {
      sfx.setJamQuiet(name === 'jam');
    }
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
    if (typeof sfx.jump === 'function') sfx.jump();
    else sfx.whoosh();
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
    animating: new Set(), // buses en movimiento (permite varios a la vez)
    boardChain: Promise.resolve(),
    won: false,
    blows: 1,
    softWarned: false,
  };

  /**
   * front (r,c) = trompa del bus (hacia donde apunta la flecha).
   * El cuerpo crece en dirección contraria. len = asientos (1–4).
   */
  /**
   * Capacidad por color (= len de cada bus) DEBE igualar personas en fila.
   * rose3 gold2 sky2 mint3 lilac4 coral4 brown2 → 20 asientos / 20 en fila.
   */
  const JAM_LEVELS = {
    2: {
      title: 'Atasco de cariño',
      hint: 'Modo fácil: los 4 primeros de la fila pueden subir. Empieza por los bordes. Cada color tiene exactamente sus asientos.',
      cols: 5,
      rows: 5,
      bayLimit: 4,
      blows: 5,
      // Misma cantidad que la suma de len por color (ver vehicles abajo).
      queue: [
        'rose', 'gold', 'sky', 'mint',
        'lilac', 'coral', 'brown', 'rose',
        'lilac', 'coral', 'mint', 'sky',
        'lilac', 'coral', 'brown', 'rose',
        'lilac', 'coral', 'mint', 'gold',
      ],
      vehicles: [
        { id: 'b0', r: 4, c: 1, dir: 'down', len: 2, color: 'rose' },
        { id: 'b1', r: 3, c: 4, dir: 'right', len: 1, color: 'gold' },
        { id: 'b2', r: 1, c: 3, dir: 'up', len: 1, color: 'sky' },
        { id: 'b3', r: 0, c: 2, dir: 'up', len: 1, color: 'mint' },
        { id: 'b4', r: 4, c: 2, dir: 'down', len: 3, color: 'lilac' },
        { id: 'b5', r: 4, c: 3, dir: 'down', len: 2, color: 'coral' },
        { id: 'b6', r: 1, c: 4, dir: 'right', len: 1, color: 'brown' },
        { id: 'b7', r: 3, c: 0, dir: 'left', len: 1, color: 'rose' },
        { id: 'b8', r: 4, c: 4, dir: 'down', len: 1, color: 'gold' },
        { id: 'b9', r: 2, c: 1, dir: 'up', len: 1, color: 'sky' },
        { id: 'b10', r: 0, c: 4, dir: 'right', len: 2, color: 'mint' },
        { id: 'b11', r: 4, c: 0, dir: 'down', len: 1, color: 'lilac' },
        { id: 'b12', r: 0, c: 0, dir: 'up', len: 2, color: 'coral' },
        { id: 'b13', r: 2, c: 0, dir: 'left', len: 1, color: 'brown' },
      ],
      winMemory: {
        photo: 'assets/cita-mesa.jpg',
        title: 'Esa mesa, nosotros',
        text: 'Pizza, risas, un guapetón caballero, corazones en la pared… y tú, la más hermosa sonriendo. Momentos así le dan sentido a mi vida, contigo ahí. Espero aportarte la misma felicidad o más de la que tú me aportas a mí.',
      },
    },
  };

  /** Personas en fila === asientos totales por color. */
  function queueMatchesSeats(vehicles, queue) {
    const seats = {};
    const people = {};
    vehicles.forEach((v) => {
      seats[v.color] = (seats[v.color] || 0) + v.len;
    });
    queue.forEach((c) => {
      people[c] = (people[c] || 0) + 1;
    });
    const colors = new Set([...Object.keys(seats), ...Object.keys(people)]);
    for (const c of colors) {
      if ((seats[c] || 0) !== (people[c] || 0)) {
        console.error('Descuadre fila/buses', c, 'asientos', seats[c] || 0, 'fila', people[c] || 0);
        return false;
      }
    }
    return true;
  }

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
    if (!queueMatchesSeats(def.vehicles, def.queue)) {
      console.error('Fila no cuadra con asientos', levelId);
      toast('Nivel con error de diseño');
      return;
    }
    jam.bayLimit = def.bayLimit;
    jam.blows = def.blows ?? 1;
    jam.queue = [...def.queue];
    jam.bays = [];
    jam.vehicles = def.vehicles.map((v) => ({ ...v }));
    jam.animating = new Set();
    jam.boardChain = Promise.resolve();
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
    // Padding interno para que el bus del borde no se recorte con el radio
    const pad = Math.max(6, Math.round(Math.min(w, h) * 0.028));
    jam.gap = Math.max(3, Math.min(5, Math.floor(Math.min(w, h) / 95)));
    const innerW = Math.max(0, w - pad * 2);
    const innerH = Math.max(0, h - pad * 2);
    const cellW = (innerW - jam.gap * (jam.cols + 1)) / jam.cols;
    const cellH = (innerH - jam.gap * (jam.rows + 1)) / jam.rows;
    jam.cell = Math.max(34, Math.floor(Math.min(cellW, cellH)));
    jam.stride = jam.cell + jam.gap;
    const gridW = jam.cell * jam.cols + jam.gap * (jam.cols + 1);
    const gridH = jam.cell * jam.rows + jam.gap * (jam.rows + 1);
    jam.offsetX = pad + Math.floor((innerW - gridW) / 2);
    jam.offsetY = pad + Math.floor((innerH - gridH) / 2);
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

  /** Los N primeros de la fila pueden subir (no solo el del frente). */
  const QUEUE_WINDOW = 4;

  /** @returns {{ queueIndex: number, bayIndex: number } | null} */
  function findBoardablePair() {
    if (!jam.queue.length || !jam.bays.length) return null;
    const limit = Math.min(QUEUE_WINDOW, jam.queue.length);
    // Prioriza coincidencias cercanas al frente, pero acepta cualquiera de los 4.
    for (let qi = 0; qi < limit; qi++) {
      const color = jam.queue[qi];
      const bi = jam.bays.findIndex((b) => b.color === color && b.boarded < b.cap);
      if (bi >= 0) return { queueIndex: qi, bayIndex: bi };
    }
    return null;
  }

  async function animatePassengerToBay(color, bayIndex, queueIndex = 0) {
    const riders = document.querySelectorAll('#queue-track .passenger:not(.more)');
    const queueEl = riders[queueIndex] || riders[0];
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
    flyer.style.transform = 'scale(0.42) rotate(-8deg)';
    flyer.style.opacity = '0.12';
    sfx.board();
    await sleep(520);
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

  /** Aborda con animación: cualquiera de los 4 primeros que coincida con una plaza. */
  async function processBaysAnimated() {
    while (true) {
      const pair = findBoardablePair();
      if (!pair) break;

      const color = jam.queue[pair.queueIndex];
      await animatePassengerToBay(color, pair.bayIndex, pair.queueIndex);
      jam.queue.splice(pair.queueIndex, 1);
      jam.bays[pair.bayIndex].boarded += 1;
      renderJam();

      if (jam.bays[pair.bayIndex] && jam.bays[pair.bayIndex].boarded >= jam.bays[pair.bayIndex].cap) {
        await animateBayDepart(pair.bayIndex);
        jam.bays.splice(pair.bayIndex, 1);
        renderJam();
      }
    }
  }

  /** Encola abordaje para no pisar animaciones si salen varios buses seguidos. */
  function enqueueBoardPass() {
    jam.boardChain = jam.boardChain
      .then(() => processBaysAnimated())
      .then(() => renderJam())
      .catch(() => {});
    return jam.boardChain;
  }

  function isSoftlocked() {
    // Softlock solo si las plazas están llenas y ninguno de los 4 primeros puede subir.
    if (!jam.queue.length || jam.animating.size || jam.won) return false;
    if (jam.bays.length < jam.bayLimit) return false;
    return !findBoardablePair();
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
        <div class="passenger ${i < QUEUE_WINDOW ? 'ready' : ''} ${i === 0 ? 'next' : ''}" style="--pcolor:${COLORS[color]}; --pring:${COLORS[color]}">
          <div class="person" aria-hidden="true" title="${PASSENGER_LABELS[color]}">
            <span class="head"></span>
            <span class="body"></span>
            <span class="leg l"></span>
            <span class="leg r"></span>
          </div>
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
    // Conserva buses que aún se están animando (salida simultánea).
    const movingKeep = [];
    lot.querySelectorAll('.bus.moving').forEach((el) => movingKeep.push(el));
    lot.innerHTML = '';
    drawLotDecor(lot);
    movingKeep.forEach((el) => lot.appendChild(el));

    jam.vehicles.forEach((v) => {
      if (jam.animating.has(v.id)) return; // ya está el nodo .moving
      if (lot.querySelector(`.bus[data-id="${v.id}"]`)) return;
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
      const icon = BUS_SCENE[v.color] || '🚌';
      btn.innerHTML = `
        <span class="bus-shine"></span>
        <span class="bus-glyph" aria-hidden="true">${icon}</span>
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
      if (typeof tequySay === 'function') tequySay('jamSoft', 'talk');
    }
    if (!locked) jam.softWarned = false;

    // Victoria solo si vaciaste fila, lot y plazas (todo el color cuadró).
    if (
      !jam.won &&
      !jam.queue.length &&
      !jam.vehicles.length &&
      !jam.bays.length
    ) {
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
    if (jam.won || jam.animating.has(id)) return;
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

    jam.animating.add(id);
    el.classList.add('moving');

    if (!path.canExit) {
      const travel = path.freeSteps;
      const bump = 0.38;
      const hitLeft = start.left + (travel + bump) * dc * jam.stride;
      const hitTop = start.top + (travel + bump) * dr * jam.stride;
      const dur = 120 + travel * 80;
      try {
        await animateTo(el, hitLeft, hitTop, dur);
        sfx.bump();
        el.classList.add('bounce-hit');
        toast(travel === 0 ? '¡Paf! Pegadito' : '¡Paf! Se asustó');
        await animateTo(el, start.left, start.top, 160 + travel * 35);
      } finally {
        el.classList.remove('bounce-hit', 'moving');
        jam.animating.delete(id);
      }
      return;
    }

    // Reserva plaza y libera celda YA, para poder sacar otro bus en paralelo.
    jam.vehicles = jam.vehicles.filter((x) => x.id !== id);
    jam.bays.push({
      color: v.color,
      dir: v.dir,
      cap: v.len,
      boarded: 0,
    });
    renderJam();

    const escape = path.freeSteps + 1.5;
    sfx.whoosh();
    try {
      await animateTo(
        el,
        start.left + escape * dc * jam.stride,
        start.top + escape * dr * jam.stride,
        160 + path.freeSteps * 70
      );
      el.style.opacity = '0';
      el.remove();
    } finally {
      jam.animating.delete(id);
    }

    await enqueueBoardPass();
  }

  document.getElementById('jam-reset').addEventListener('click', () => {
    if (state.currentLevel) startJam(state.currentLevel);
  });

  document.getElementById('jam-blow')?.addEventListener('click', async () => {
    if (jam.blows <= 0 || jam.animating.size) return;
    if (!jam.bays.length) {
      toast('No hay buses en las plazas');
      return;
    }
    jam.animating.add('__blow__');
    const active = new Set(jam.queue.slice(0, QUEUE_WINDOW));
    let idx = jam.bays.findIndex((b) => !active.has(b.color));
    if (idx < 0) idx = 0;
    const blown = jam.bays[idx];
    // El soplo se lleva el bus y a quien faltaba subir (mantiene el equilibrio color↔asientos).
    const leftover = Math.max(0, blown.cap - blown.boarded);
    for (let n = 0; n < leftover; n++) {
      const qi = jam.queue.indexOf(blown.color);
      if (qi >= 0) jam.queue.splice(qi, 1);
    }
    try {
      await animateBayDepart(idx);
      jam.bays.splice(idx, 1);
      jam.blows -= 1;
      sfx.whoosh();
      toast('Soplo de Ale 💨');
      renderJam();
      await enqueueBoardPass();
    } finally {
      jam.animating.delete('__blow__');
    }
  });

  function syncMuteButtons() {
    const muted = sfx.isMuted();
    document.querySelectorAll('[data-mute-btn]').forEach((btn) => {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar');
    });
  }

  document.querySelectorAll('[data-mute-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sfx.toggle();
      syncMuteButtons();
    });
  });

  document.getElementById('jam-back').addEventListener('click', () => showScreen('map'));

  window.addEventListener('resize', () => {
    if (screens.jam.classList.contains('active') && jam.level) {
      layoutLot();
      renderJam();
    }
  });

  /* ---------- Level 3: casa (+ spin-off del oso) ---------- */
  function showCozyMain() {
    const main = document.getElementById('cozy-main');
    const spin = document.getElementById('cozy-spinoff');
    if (main) {
      main.hidden = false;
      main.removeAttribute('hidden');
    }
    if (spin) {
      spin.hidden = true;
      spin.setAttribute('hidden', '');
    }
  }

  function showCozySpinoff() {
    const main = document.getElementById('cozy-main');
    const spin = document.getElementById('cozy-spinoff');
    if (main) {
      main.hidden = true;
      main.setAttribute('hidden', '');
    }
    if (spin) {
      spin.hidden = false;
      spin.removeAttribute('hidden');
      requestAnimationFrame(() => {
        spin.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    sfx.unlock();
    toast('Spin-off: el oso mañoso');
    if (typeof tequySay === 'function') {
      tequySay('¡Spin-off! El oso mañoso… al final sí me cayó bien 🐻', 'happy');
    }
  }

  function finishCozyLevel() {
    sfx.unlock();
    completeLevel(3, {
      photo: 'assets/historia/sofa.png?v=7',
      title: 'El sofá y la tele',
      text: 'Sofá, tele, palomitas… y tú pegadita a mí por siempre. Así me gusta imaginarnos.',
    });
  }

  function startCozy() {
    showCozyMain();
    showScreen('cozy');
  }

  document.getElementById('cozy-next')?.addEventListener('click', finishCozyLevel);
  document.getElementById('cozy-next-from-spin')?.addEventListener('click', finishCozyLevel);
  document.getElementById('cozy-spinoff-btn')?.addEventListener('click', showCozySpinoff);
  document.getElementById('cozy-spinoff-close')?.addEventListener('click', () => {
    showCozyMain();
    toast('De vuelta al sofá');
  });

  document.getElementById('cozy-back').addEventListener('click', () => {
    showCozyMain();
    showScreen('map');
  });

  /* ---------- Level 4: caricaturas ---------- */
  const THOUGHT_SCENES = {
    ale: {
      src: 'assets/historia/chicha.png?v=7',
      caption: 'Mi cabeza mientras almorzamos: chicha vs gaseosa',
      panel: 'thought-ale',
    },
    noe: {
      src: 'assets/historia/cine.png?v=7',
      caption: 'Lo que (según yo) pasa por la tuya: modo cine 3D',
      panel: 'thought-noe',
    },
  };

  function closeThoughtClouds() {
    document.querySelectorAll('.thought-cloud').forEach((el) => {
      el.hidden = true;
      el.setAttribute('hidden', '');
      el.classList.remove('is-open');
    });
    document.querySelectorAll('.thought-chip').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
      btn.classList.remove('is-on');
    });
  }

  function openThought(key) {
    const scene = THOUGHT_SCENES[key];
    if (!scene) return;
    const panel = document.getElementById(scene.panel);
    const chip = document.querySelector(`.thought-chip[data-thought="${key}"]`);
    const already = panel && panel.classList.contains('is-open');

    closeThoughtClouds();
    if (already) return;

    if (panel) {
      panel.hidden = false;
      panel.removeAttribute('hidden');
      panel.classList.add('is-open');
    }
    if (chip) {
      chip.setAttribute('aria-expanded', 'true');
      chip.classList.add('is-on');
    }
    sfx.tap();
    // Lightbox: se nota sí o sí que “abrió”
    if (typeof openPhotoLite === 'function') {
      openPhotoLite(scene.src, scene.caption);
    }
    if (panel) {
      requestAnimationFrame(() => {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  }

  function startCartoon() {
    closeThoughtClouds();
    showScreen('cartoon');
  }

  // Delegación: no falla aunque el DOM se recargue o haya caché rara
  document.getElementById('cartoon-screen')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.thought-chip');
    if (!chip || !document.getElementById('cartoon-screen').contains(chip)) return;
    e.preventDefault();
    openThought(chip.dataset.thought);
  });

  document.getElementById('cartoon-back').addEventListener('click', () => showScreen('map'));

  document.getElementById('cartoon-next').addEventListener('click', () => {
    completeLevel(4, {
      photo: 'assets/historia/abrazo-tequeno.png',
      title: '¿Cómo llegó esto aquí?',
      text: 'No puedo arreglarte la vida… pero sí buscar que estés bien, de la manera que sea. Porque me importas demasiado.',
    });
  });

  /* ---------- Level 5 + cierre ---------- */
  const closingEl = document.getElementById('closing');
  let closingTimer = null;
  let closingPlayed = false;

  const postcreditsEl = document.getElementById('postcredits');

  function showPostcredits() {
    tequyRoot?.classList.add('is-hidden');
    tequyHideBubble();
    if (typeof sfx.setTheme === 'function') sfx.setTheme('finale');
    if (postcreditsEl) {
      postcreditsEl.hidden = false;
      return;
    }
    showScreen('splash');
  }

  function playClosing() {
    if (!closingEl || closingEl.classList.contains('is-on')) return;
    closingPlayed = true;
    tequyRoot?.classList.add('is-hidden');
    tequyHideBubble();
    if (typeof sfx.setTheme === 'function') sfx.setTheme('finale');
    closingEl.hidden = false;
    closingEl.classList.remove('is-out');
    // restart CSS animations
    void closingEl.offsetWidth;
    closingEl.classList.add('is-on');
    sfx.unlock();
    clearTimeout(closingTimer);
    closingTimer = setTimeout(() => {
      closingEl.classList.add('is-out');
      setTimeout(() => {
        closingEl.hidden = true;
        closingEl.classList.remove('is-on', 'is-out');
        showPostcredits();
      }, 1000);
    }, 6200);
  }

  document.getElementById('postcredits-done')?.addEventListener('click', () => {
    if (postcreditsEl) postcreditsEl.hidden = true;
    if (typeof sfx.setTheme === 'function') sfx.setTheme('path');
    showScreen('splash');
    toast('Gracias por ver Noelia Pictures ✦');
  });

  function startFinale() {
    showScreen('finale');
    state.done[5] = true;
    state.unlocked = Math.max(state.unlocked, 5);
    saveProgress();
    renderMap();
  }

  document.getElementById('finale-back').addEventListener('click', () => showScreen('map'));
  // Solo al tocar “Cerrar el caminito” (no automático)
  document.getElementById('finale-end')?.addEventListener('click', playClosing);

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
    if (typeof sfx.startBgm === 'function') sfx.startBgm();
    showScreen('map');
    renderMap();
  });

  // Baja la BGM cuando ella escucha tu audio (y vuelve al terminar).
  const letterAudio = document.getElementById('letter-audio');
  if (letterAudio) {
    const duckOn = () => { if (typeof sfx.duckBgm === 'function') sfx.duckBgm(true); };
    const duckOff = () => { if (typeof sfx.duckBgm === 'function') sfx.duckBgm(false); };
    letterAudio.addEventListener('play', duckOn);
    letterAudio.addEventListener('pause', duckOff);
    letterAudio.addEventListener('ended', duckOff);
  }

  document.getElementById('map-back').addEventListener('click', () => showScreen('splash'));

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
    idle: 'assets/tequy/idle.png?v=7',
    talk: 'assets/tequy/talk.png?v=7',
    jump: 'assets/tequy/happy.png?v=7',
    happy: 'assets/tequy/happy.png?v=7',
    kick: 'assets/tequy/idle.png?v=7', // kick.png estaba roto (solo pies)
    side: 'assets/tequy/side.png?v=7',
  };

  const TEQUY_LINES = {
    splash: '¡Hola! Soy Tequeño. Toca Empezar y te guío en el caminito 🧀',
    map: 'Elige una parada. Si te trabas, dame un toque y te tiro una pista.',
    intro: 'Ese “No” es un cobarde… ¡persíguelo! O mejor: di que sí.',
    jam: 'Ojo: pueden subir los 4 primeros de la fila, no solo el del frente. ¡Tú puedes!',
    jamSoft: 'Uy, plazas llenas y los 4 de adelante no entran. Saca otro color… o Soplo de Ale.',
    jamWin: '¡Siiii! Lo lograste. Te mereces un abrazo… y un tequeño extra.',
    cozy: 'Sofá, tele, palomitas… y tú pegadita. Si te pica la curiosidad, hay un spin-off abajo 👀',
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
    tequyRoot.classList.toggle('is-compact', name === 'jam');
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
      const spin = document.getElementById('cozy-spinoff');
      if (spin && !spin.hidden) {
        tequySay('¡Spin-off desbloqueado! El oso mañoso… al final sí me cayó bien 🐻', 'happy');
      } else {
        tequySay('cozy', 'talk');
      }
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
