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
    rose: 'tequeña',
    sky: 'abrazos',
    gold: 'tequeños',
    mint: 'conciertos',
    lilac: 'Ed Sheeran',
    coral: 'carne asada',
    brown: 'Paco Yonque',
  };

  const STORAGE_KEY = 'ella-camino-v2';
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
    finale: document.getElementById('finale-screen'),
  };

  const memoryEl = document.getElementById('memory');
  const toastEl = document.getElementById('toast');

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[name].classList.add('active');
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
      title: 'Para ti, tequeña',
      text: 'No se me olvidó tu día. Aunque estemos lejos, quise dejarte algo hecho a mano: un caminito solo tuyo.',
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
  // Nivel artesanal FÁCIL: muchos buses ya miran hacia afuera (salida libre).
  // Verificado con BFS: hay camino a ganar. No es un MIT challenge.
  const JAM_LEVELS = {
    2: {
      title: 'Atasco de cariño',
      hint: 'Empieza por los buses de los bordes (casi siempre salen). Luego desatasca el centro. Mira el color de la fila.',
      cols: 5,
      rows: 5,
      bayLimit: 4,
      blows: 2,
      queue: [
        'rose', 'gold', 'sky', 'mint', 'rose', 'gold',
        'lilac', 'coral', 'coral', 'sky', 'brown', 'mint', 'rose',
      ],
      vehicles: [
        // Bordes con salida libre → dopamina inmediata
        { id: 'a', r: 0, c: 1, dir: 'up', len: 1, color: 'rose' },
        { id: 'b', r: 0, c: 3, dir: 'up', len: 1, color: 'gold' },
        { id: 'c', r: 1, c: 4, dir: 'right', len: 1, color: 'sky' },
        { id: 'd', r: 3, c: 4, dir: 'right', len: 1, color: 'mint' },
        { id: 'e', r: 4, c: 2, dir: 'down', len: 1, color: 'rose' },
        { id: 'f', r: 4, c: 0, dir: 'down', len: 1, color: 'gold' },
        { id: 'g', r: 2, c: 0, dir: 'left', len: 1, color: 'lilac' },
        // Centro suave (se abre cuando salen algunos del borde)
        { id: 'h', r: 1, c: 2, dir: 'right', len: 2, color: 'coral' },
        { id: 'i', r: 2, c: 2, dir: 'down', len: 1, color: 'sky' },
        { id: 'j', r: 3, c: 1, dir: 'left', len: 1, color: 'brown' },
        { id: 'k', r: 2, c: 3, dir: 'up', len: 1, color: 'mint' },
        { id: 'l', r: 3, c: 3, dir: 'down', len: 1, color: 'rose' },
      ],
      winMemory: {
        photo: 'assets/cita-mesa.jpg',
        title: 'Esa mesa, nosotros',
        text: 'Carne, risas, corazones en la pared… y tú haciendo carita. Me gusta recordarnos así, tequeña.',
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
    jam.cell = Math.max(26, Math.floor(Math.min(cellW, cellH)));
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

  function processBays() {
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < jam.bays.length; i++) {
        const bay = jam.bays[i];
        while (
          bay.boarded < bay.cap &&
          jam.queue.length &&
          jam.queue[0] === bay.color
        ) {
          jam.queue.shift();
          bay.boarded += 1;
          sfx.board();
          changed = true;
        }
      }
      const before = jam.bays.length;
      jam.bays = jam.bays.filter((b) => {
        if (b.boarded >= b.cap) {
          sfx.depart();
          return false;
        }
        return true;
      });
      if (jam.bays.length !== before) changed = true;
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
        <div class="passenger ${i === 0 ? 'next' : ''}" style="border-color:${i === 0 ? COLORS[color] : 'transparent'}; --pcolor:${COLORS[color]}">
          <div class="person" aria-hidden="true">
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
        ? `<div class="passenger more">+${hidden}<span>más allá →</span></div>`
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
        bay.style.background = COLORS[b.color];
        bay.style.borderColor = COLORS[b.color];
        bay.innerHTML = `
          <div class="bay-bus">${ARROWS[b.dir]}</div>
          <div class="bay-meta">${PASSENGER_LABELS[b.color]}</div>
          <div class="bay-seats">${'●'.repeat(b.boarded)}${'○'.repeat(b.cap - b.boarded)}</div>
        `;
      } else {
        bay.innerHTML = '<span class="bay-empty">plaza</span>';
      }
      baysEl.appendChild(bay);
    }

    const lot = document.getElementById('lot');
    lot.innerHTML = '';
    drawLotDecor(lot);

    jam.vehicles.forEach((v) => {
      const box = busBox(v);
      const btn = document.createElement('button');
      btn.className = `bus bus-${v.dir} bus-len-${v.len}`;
      btn.type = 'button';
      btn.dataset.id = v.id;
      btn.style.left = `${box.left}px`;
      btn.style.top = `${box.top}px`;
      btn.style.width = `${box.width}px`;
      btn.style.height = `${box.height}px`;
      btn.style.background = `linear-gradient(145deg, ${COLORS[v.color]}, ${COLORS[v.color]}b8)`;
      btn.title = `${PASSENGER_LABELS[v.color]} · ${v.len} asiento${v.len > 1 ? 's' : ''}`;
      const windows = Array.from({ length: Math.min(v.len, 3) }, () => '<span class="bus-window"></span>').join('');
      btn.innerHTML = `
        <span class="bus-shine"></span>
        <span class="bus-windows">${windows}</span>
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
    }
    if (!locked) jam.softWarned = false;

    if (!jam.queue.length && !jam.vehicles.length && !jam.bays.length && !jam.won) {
      jam.won = true;
      sfx.win();
      setTimeout(() => completeLevel(2, jam.level.winMemory), 500);
    } else if (!jam.queue.length && !jam.won) {
      // fila vacía pero quedan buses: gana igual (ya subió toda la gente)
      jam.won = true;
      sfx.win();
      setTimeout(() => completeLevel(2, jam.level.winMemory), 500);
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
    processBays();
    jam.busy = false;
    renderJam();
  }

  document.getElementById('jam-reset').addEventListener('click', () => {
    if (state.currentLevel) startJam(state.currentLevel);
  });

  document.getElementById('jam-blow')?.addEventListener('click', () => {
    if (jam.blows <= 0 || jam.busy) return;
    if (!jam.bays.length) {
      toast('No hay buses en las plazas');
      return;
    }
    // Quita el que NO puede subir ahora (si todos pueden, el más vacío)
    const need = jam.queue[0];
    let idx = jam.bays.findIndex((b) => b.color !== need);
    if (idx < 0) idx = 0;
    jam.bays.splice(idx, 1);
    jam.blows -= 1;
    sfx.whoosh();
    toast('Soplo de Ale 💨');
    processBays();
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

  /* ---------- Level 4 ---------- */
  function startFinale() {
    showScreen('finale');
    state.done[4] = true;
    state.unlocked = Math.max(state.unlocked, 4);
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

  /* ---------- Nav ---------- */
  document.getElementById('enter-btn').addEventListener('click', () => {
    sfx.unlock();
    showScreen('map');
    renderMap();
  });

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
      else if (n === 4) startFinale();
    });
  });

  loadProgress();
  renderMap();
})();
