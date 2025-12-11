(function () {
  /* ------------------ CONFIGURACIÓN ------------------ */
  const BASE_H_CELL = 50, BASE_D_CELL = 110;
  // CAMBIO DE CLAVE: Para resetear estado y que se abran los menús por defecto
  const STORAGE_KEY = 'gantt_config_v2';

  const ZOOM_CONFIG = {
    hours: 60, days: 120, weeks: 50, fortnight: 50,
    month: 35, quarter: 12, semester: 6, annual: 3
  };

  let now = new Date();

  let config = {
    showCurrentTime: true,
    bgColor: '#ffffff',
    altColor: '#f7fff9',
    lineColor: '#ff4d4d',
    manualStart: null,
    manualEnd: null,
    hideEmptyResources: false,
    showPreps: true,
    showOps: true,
    showAlarms: false,
    scale: 'days'
  };

  /* ------------------ DATA ------------------ */
  const rawResponse = (typeof response !== 'undefined') ? response : { result: { Menu: [], trabajos_O: [] } };
  const data = transformApiData(rawResponse);

  let timelineStartDate, timelineEndDate, startTimeMs;

  const el = {
    headerDays: document.getElementById('headerDays'),
    calendar: document.getElementById('calendar'),
    centersContainer: document.getElementById('centersContainer'),
    timelineScroll: document.getElementById('timelineScroll'),
    timeLine: document.getElementById('timeLine'),
    tooltip: document.getElementById('tooltipPro'),
    drawer: document.getElementById('drawer'),
    btnAdvanced: document.getElementById('btnAdvanced'),
    btnDrawerClose: document.getElementById('btnDrawerClose'),
    chkCurrentTime: document.getElementById('checkCurrentTime'),
    inpBgColor: document.getElementById('colBg'),
    inpAltColor: document.getElementById('colAlt'),
    inpLineColor: document.getElementById('colLine'),
    chkResources: document.getElementById('chkResources'),
    chkAlarms: document.getElementById('chkAlarms'),
    filterCode: document.getElementById('filterCode'),
    filterDesc: document.getElementById('filterDesc'),
    tabla_gantt: document.getElementById('tabla_gantt')
  };

  /* ------------------ LOCALSTORAGE ------------------ */
  function saveState() {
    const state = {
      config: config,
      filters: { code: el.filterCode.value, desc: el.filterDesc.value },
      drawerOpen: el.drawer.classList.contains('visible'),
      accordions: Array.from(document.querySelectorAll('.acc-body')).map(acc => acc.classList.contains('open'))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false; // Retornamos false si es la primera vez
    try {
      const state = JSON.parse(saved);
      config = { ...config, ...state.config };
      if (el.chkCurrentTime) el.chkCurrentTime.checked = config.showCurrentTime;
      if (el.inpBgColor) el.inpBgColor.value = config.bgColor;
      if (el.inpAltColor) el.inpAltColor.value = config.altColor;
      if (el.inpLineColor) el.inpLineColor.value = config.lineColor;
      if (el.chkResources) el.chkResources.checked = config.hideEmptyResources;
      if (el.chkAlarms) el.chkAlarms.checked = config.showAlarms;
      if (state.filters) { el.filterCode.value = state.filters.code || ''; el.filterDesc.value = state.filters.desc || ''; }
      
      // Restaurar si el drawer estaba abierto y ajustar el ancho
      if (state.drawerOpen) {
          el.drawer.classList.add('visible');
          if(el.tabla_gantt) el.tabla_gantt.style.maxWidth = '44.76%';
      }

      // Restaurar estado acordeones
      if (state.accordions) {
        const bodies = document.querySelectorAll('.acc-body');
        state.accordions.forEach((isOpen, i) => {
          if (bodies[i]) {
            if (isOpen) {
              bodies[i].classList.add('open');
              bodies[i].previousElementSibling.querySelector('.acc-toggle').textContent = '▾';
            } else {
              bodies[i].classList.remove('open');
              bodies[i].previousElementSibling.querySelector('.acc-toggle').textContent = '▸';
            }
          }
        });
      }
      return true;
    } catch (e) { console.error("Error cargando estado", e); return false; }
  }

  /* ------------------ LOGICA ESCALAS ------------------ */
  function getPxPerUnit() {
    if (config.scale === 'annual') {
      const containerW = el.timelineScroll.clientWidth || 1200;
      return Math.max(3, containerW / 380);
    }
    return ZOOM_CONFIG[config.scale] || ZOOM_CONFIG.days;
  }

  function getScaleUnitMs() {
    return config.scale === 'hours' ? 3600000 : 86400000;
  }

  function computeTimelineRange() {
    if (config.manualStart && config.manualEnd) {
      return { timelineStartDate: new Date(config.manualStart), timelineEndDate: new Date(config.manualEnd) };
    }
    const stamps = [];
    data.forEach(c => c.machines.forEach(m => m.jobs.forEach(j => {
      const s = new Date(j.start).getTime(), e = new Date(j.end).getTime();
      if (!isNaN(s)) stamps.push(s); if (!isNaN(e)) stamps.push(e);
    })));

    let earliest, latest;
    if (!stamps.length) {
      const s = new Date(); s.setDate(s.getDate() - 1); const e = new Date(); e.setDate(e.getDate() + 30);
      earliest = s; latest = e;
    } else {
      earliest = new Date(Math.min(...stamps)); latest = new Date(Math.max(...stamps));
    }

    const today = new Date();
    if (today < earliest) earliest = new Date(today);
    if (today > latest) latest = new Date(today);

    if (config.scale === 'hours') { earliest.setHours(earliest.getHours() - 2); latest.setHours(latest.getHours() + 24); }
    else if (['annual', 'semester', 'quarter'].includes(config.scale)) { earliest.setDate(1); latest.setMonth(latest.getMonth() + 6); }
    else { earliest.setDate(earliest.getDate() - 3); latest.setDate(latest.getDate() + 45); }

    earliest.setHours(0, 0, 0, 0); latest.setHours(23, 59, 59, 999);
    return { timelineStartDate: earliest, timelineEndDate: latest };
  }

  /* ------------------ RENDER ------------------ */
  function refreshAll() {
    const ranges = computeTimelineRange();
    timelineStartDate = ranges.timelineStartDate;
    timelineEndDate = ranges.timelineEndDate;
    startTimeMs = timelineStartDate.getTime();

    document.documentElement.style.setProperty('--bg-normal', config.bgColor);
    document.documentElement.style.setProperty('--bg-alt', config.altColor);
    document.documentElement.style.setProperty('--line-color', config.lineColor);

    createHeader();
    renderMenu();
    renderCalendar();
    saveState();
    setTimeout(centerNow, 50);
  }

  function createHeader() {
    if (!el.headerDays) return;
    el.headerDays.innerHTML = '';
    const pxPerUnit = getPxPerUnit();
    const unitMs = getScaleUnitMs();
    const totalMs = timelineEndDate - timelineStartDate;
    const totalUnits = Math.ceil(totalMs / unitMs);
    const totalWidth = totalUnits * pxPerUnit;

    el.calendar.style.minWidth = totalWidth + 'px';
    el.headerDays.style.minWidth = totalWidth + 'px';

    const frag = document.createDocumentFragment();

    if (['annual', 'semester', 'quarter'].includes(config.scale)) {
      let current = new Date(timelineStartDate);
      current.setDate(1);
      while (current < timelineEndDate) {
        const mStart = new Date(current);
        const mEnd = new Date(current.getFullYear(), current.getMonth() + 1, 1);
        const daysInMonth = (mEnd - mStart) / 86400000;
        const width = daysInMonth * pxPerUnit;
        const block = document.createElement('div');
        block.className = 'day-block';
        block.style.width = width + 'px';
        block.style.borderRight = '1px solid rgba(0,0,0,0.1)';
        const monthName = mStart.toLocaleString('es-ES', { month: 'long' });
        const yearNum = mStart.getFullYear();
        let label = config.scale === 'annual' ? monthName.substring(0, 3) : `${monthName} ${yearNum}`;
        block.innerHTML = `<div class="day-label" style="text-transform:capitalize;">${label}</div>`;
        frag.appendChild(block);
        current = mEnd;
      }
    }
    else if (config.scale === 'hours') {
      const days = Math.ceil(totalUnits / 24);
      for (let i = 0; i < days; i++) {
        const d = new Date(timelineStartDate); d.setDate(d.getDate() + i);
        const block = document.createElement('div');
        block.className = 'day-block';
        block.style.width = (pxPerUnit * 24) + 'px';
        block.innerHTML = `<div class="day-label">${fmtDateClean(d)}</div><div class="hours">${renderHoursRow(pxPerUnit)}</div>`;
        frag.appendChild(block);
      }
    }
    else {
      for (let i = 0; i < totalUnits; i++) {
        const d = new Date(timelineStartDate); d.setDate(d.getDate() + i);
        const dayNum = d.getDay();
        const dateNum = d.getDate();

        const block = document.createElement('div');
        block.className = 'day-block';
        block.style.width = pxPerUnit + 'px';

        const isNewMonth = dateNum === 1;
        const isStart = i === 0;
        const monthShort = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');

        if (isNewMonth || isStart) {
          block.style.borderLeft = '2px solid var(--accent)';
          block.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
          block.innerHTML = `
                <div class="day-label" style="color:var(--accent-600);">
                    <span class="date-number" style="font-size:14px;">${dateNum}</span>
                    <span class="day-name" style="color:var(--accent-600); font-size:9px;">${monthShort}</span>
                </div>`;
        }
        else {
          if (dayNum === 0 || dayNum === 6) block.style.backgroundColor = '#f8fafc';

          if (config.scale === 'month' && pxPerUnit < 40) {
            block.innerHTML = `<div class="day-label"><span class="date-number" style="font-size:12px">${dateNum}</span></div>`;
          } else {
            block.innerHTML = `
                <div class="day-label">
                    <span class="day-name">${dayName}</span>
                    <span class="date-number">${dateNum}</span>
                </div>`;
          }
        }
        frag.appendChild(block);
      }
    }
    el.headerDays.appendChild(frag);
  }

  function renderHoursRow(w) {
    let html = '';
    if (w < 20) return '';
    for (let h = 0; h < 24; h += (w < 30 ? 2 : 1)) {
      html += `<div class="hour" style="flex:1; border-right:1px solid #eee; font-size:9px;">${h}</div>`;
    }
    return html;
  }

  function renderMenu() {
    if (!el.centersContainer) return;
    el.centersContainer.innerHTML = '';
    const fCode = (el.filterCode.value || '').toLowerCase();
    const fDesc = (el.filterDesc.value || '').toLowerCase();

    data.forEach(center => {
      if (config.hideEmptyResources && !center.machines.some(m => m.jobs.length > 0)) return;
      const visibleMachines = center.machines.filter(m => {
        if (config.hideEmptyResources && m.jobs.length === 0) return false;
        return (!fCode || m.code.toLowerCase().includes(fCode)) && (!fDesc || m.name.toLowerCase().includes(fDesc));
      });

      const card = document.createElement('div');
      card.className = `center-card ${center.expanded ? 'expanded' : ''}`;
      const totalMachines = center.machines.length;
      const visibleCount = visibleMachines.length;

      card.innerHTML = `
        <div class="sidebar-center-header">
           <div>${center.code} — ${center.name}</div>
           <div style="display:flex; align-items:center; gap:5px; font-size:11px;opacity:0.7">
             <span>(${visibleCount}/${totalMachines})</span>
             <svg class="chevron-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
               <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
             </svg>
           </div>
        </div>`;

      const machineList = document.createElement('div');
      machineList.style.display = center.expanded ? 'block' : 'none';

      visibleMachines.forEach(m => {
        const item = document.createElement('div');
        item.className = 'sidebar-machine-item';
        item.innerHTML = `<span>${m.code}</span><span style="font-size:11px;font-weight:400">${m.name}</span>`;
        item.setAttribute('data-code', m.code);
        item.onmouseenter = () => highlightRow(m.code, true);
        item.onmouseleave = () => highlightRow(m.code, false);
        machineList.appendChild(item);
      });

      card.querySelector('.sidebar-center-header').onclick = () => {
        center.expanded = !center.expanded;
        refreshAll();
      };
      card.appendChild(machineList);
      el.centersContainer.appendChild(card);
    });
  }

  function renderCalendar() {
    if (!el.calendar) return;
    el.calendar.innerHTML = '';
    const fCode = (el.filterCode.value || '').toLowerCase();
    const fDesc = (el.filterDesc.value || '').toLowerCase();

    data.forEach(center => {
      if (config.hideEmptyResources && !center.machines.some(m => m.jobs.length > 0)) return;
      const visibleMachines = center.machines.filter(m => {
        if (config.hideEmptyResources && m.jobs.length === 0) return false;
        return (!fCode || m.code.toLowerCase().includes(fCode)) && (!fDesc || m.name.toLowerCase().includes(fDesc));
      });

      const sep = document.createElement('div');
      sep.className = 'calendar-center-header';
      sep.style.minWidth = el.calendar.style.minWidth;
      sep.textContent = center.code;
      el.calendar.appendChild(sep);

      if (center.expanded) {
        visibleMachines.forEach(m => {
          const row = document.createElement('div');
          row.className = 'calendar-machine-row';
          row.style.minWidth = el.calendar.style.minWidth;
          row.setAttribute('data-code', m.code);
          row.onmouseenter = () => highlightRow(m.code, true);
          row.onmouseleave = () => highlightRow(m.code, false);

          m.jobs.forEach(job => {
            const s = new Date(job.start).getTime(), e = new Date(job.end).getTime();
            if (isNaN(s) || isNaN(e)) return;
            const unitMs = getScaleUnitMs(), pxPerUnit = getPxPerUnit();
            const left = ((s - startTimeMs) / unitMs) * pxPerUnit;
            let width = ((e - s) / unitMs) * pxPerUnit;
            if (width < 2) width = 2;

            const bar = document.createElement('div');
            bar.className = 'bar';
            bar.textContent = job.name;
            bar.style.left = left + 'px';
            bar.style.width = width + 'px';
            bar.style.background = config.showAlarms ? '#ef4444' : job.color;
            if (width < 30) bar.style.color = 'transparent';

            bar.onmousemove = (ev) => {
              el.tooltip.innerHTML = `<b>${job.articulo}</b><br>${job.fase}<br>${fmtDateTime(new Date(job.start))} - ${fmtDateTime(new Date(job.end))}`;
              el.tooltip.style.left = (ev.clientX + 10) + 'px';
              el.tooltip.style.top = (ev.clientY + 10) + 'px';
              el.tooltip.style.opacity = 1;
            };
            bar.onmouseleave = () => el.tooltip.style.opacity = 0;
            row.appendChild(bar);
          });
          el.calendar.appendChild(row);
        });
      }
    });
    requestAnimationFrame(() => document.querySelectorAll('.bar').forEach(b => b.classList.add('visible')));
  }

  function centerNow() {
    if (!el.timeLine || !el.timelineScroll) return;
    if (!config.showCurrentTime) { el.timeLine.style.display = 'none'; return; }
    el.timeLine.style.display = 'block';

    now = new Date();
    const diff = now.getTime() - startTimeMs;
    const unit = getScaleUnitMs();
    const px = getPxPerUnit();
    const left = (diff / unit) * px;
    const max = el.timelineScroll.scrollWidth;

    el.timeLine.style.left = Math.max(0, Math.min(left, max)) + 'px';
    const h = el.timelineScroll.scrollHeight;
    el.timeLine.style.height = Math.max(0, h - 60) + 'px';
  }

  function highlightRow(code, active) {
    document.querySelectorAll(`[data-code="${code}"]`).forEach(e => {
      if (active) e.style.setProperty('background-color', 'rgba(16, 185, 129, 0.1)', 'important');
      else e.style.removeProperty('background-color');
    });
  }

  function transformApiData(apiResponse) {
    const centersMap = new Map();
    const colors = ['#10b981', '#34d399', '#0ea5e9', '#facc15', '#f87171', '#a78bfa'];
    (apiResponse.result.Menu || []).forEach(m => {
      if (!centersMap.has(m.Centro)) centersMap.set(m.Centro, { code: m.Centro, name: m.Descripcion || '', expanded: true, machines: [] });
      if (m.Maquina) m.Maquina.forEach(mq => centersMap.get(m.Centro).machines.push({ code: mq.Maquina, name: mq.Descripcion || '', jobs: [] }));
    });
    (apiResponse.result.trabajos_O || []).forEach(t => {
      const c = centersMap.get(t.Centro_Trabajo);
      if (c) {
        const mq = c.machines.find(x => x.code === t.Codigo_Maquina);
        if (mq) mq.jobs.push({
          name: t.Articulo,
          start: new Date(t.Fe_Ho_Inicio_Asig),
          end: new Date(t.Fe_Ho_Final_Asig),
          color: colors[Math.floor(Math.random() * colors.length)],
          articulo: t.Articulo, fase: t.Descripcion_Fase, trabajo: t.Trabajo
        });
      }
    });
    return Array.from(centersMap.values());
  }
  function fmtDateClean(d) { return `${d.getDate()} ${d.toLocaleString('es', { month: 'short' })}`; }
  function fmtDateTime(d) { return d.toLocaleString('es'); }
  function ucfirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  class InlineCalendar {
    constructor(containerId, onSelect, initialDate) {
      this.container = document.getElementById(containerId);
      this.onSelect = onSelect;
      this.currentDate = initialDate ? new Date(initialDate) : new Date();
      this.selectedDate = initialDate ? new Date(initialDate) : null;
      if (this.container) this.render();
    }
    render() {
      this.container.innerHTML = '';
      const year = this.currentDate.getFullYear();
      const month = this.currentDate.getMonth();
      const header = document.createElement('div');
      header.className = 'cal-header';
      const monthName = this.currentDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      const monthYear = monthName.charAt(0).toUpperCase() + monthName.slice(1);
      header.innerHTML = `<button class="cal-nav-btn" data-action="prev">‹</button><span class="cal-title">${monthYear}</span><button class="cal-nav-btn" data-action="next">›</button>`;
      header.querySelectorAll('button').forEach(b => b.onclick = (e) => this.changeMonth(e.target.dataset.action === 'prev' ? -1 : 1));
      this.container.appendChild(header);
      const grid = document.createElement('div');
      grid.className = 'cal-grid';
      ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].forEach(d => { grid.innerHTML += `<div class="cal-day-name">${d}</div>`; });
      const firstDay = new Date(year, month, 1).getDay();
      const startOffset = firstDay === 0 ? 6 : firstDay - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < startOffset; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;
      for (let i = 1; i <= daysInMonth; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'cal-day';
        dayEl.textContent = i;
        if (this.selectedDate && this.selectedDate.getDate() === i && this.selectedDate.getMonth() === month && this.selectedDate.getFullYear() === year) {
          dayEl.classList.add('selected');
        }
        dayEl.onclick = () => this.selectDate(i);
        grid.appendChild(dayEl);
      }
      this.container.appendChild(grid);
    }
    changeMonth(delta) { this.currentDate.setMonth(this.currentDate.getMonth() + delta); this.render(); }
    selectDate(day) {
      this.selectedDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), day);
      this.render();
      if (this.onSelect) this.onSelect(this.selectedDate);
    }
  }

  function init() {
    loadState();

    if (el.chkCurrentTime) el.chkCurrentTime.onchange = (e) => { config.showCurrentTime = e.target.checked; centerNow(); saveState(); };
    if (el.inpBgColor) el.inpBgColor.addEventListener('input', (e) => { config.bgColor = e.target.value; document.documentElement.style.setProperty('--bg-normal', config.bgColor); saveState(); });
    if (el.inpAltColor) el.inpAltColor.addEventListener('input', (e) => { config.altColor = e.target.value; document.documentElement.style.setProperty('--bg-alt', config.altColor); saveState(); });
    if (el.inpLineColor) el.inpLineColor.addEventListener('input', (e) => { config.lineColor = e.target.value; document.documentElement.style.setProperty('--line-color', config.lineColor); saveState(); });

    new InlineCalendar('calendarStart', (date) => { config.manualStart = date; refreshAll(); }, config.manualStart);
    new InlineCalendar('calendarEnd', (date) => { config.manualEnd = date; refreshAll(); }, config.manualEnd);
    document.getElementById('clearDatesBtn').onclick = () => { config.manualStart = null; config.manualEnd = null; refreshAll(); };

    if (el.chkResources) el.chkResources.onchange = (e) => { config.hideEmptyResources = e.target.checked; refreshAll(); };
    if (el.chkAlarms) el.chkAlarms.onchange = (e) => { config.showAlarms = e.target.checked; refreshAll(); };

    document.querySelectorAll('input[name="scaleGroup"]').forEach(r => {
      if (r.value === config.scale) r.checked = true;
      r.onchange = (e) => { if (e.target.checked) { config.scale = e.target.value; refreshAll(); } };
    });

    // --- AQUÍ ESTÁ LA CORRECCIÓN CLAVE ---
    if (el.btnAdvanced) {
        el.btnAdvanced.onclick = () => {
            // Hacemos toggle de la clase visible y guardamos el resultado (true/false)
            const isVisible = el.drawer.classList.toggle('visible');
            
            // Si está visible, aplicamos el ancho reducido. Si no, lo quitamos.
            if (isVisible) {
                el.tabla_gantt.style.maxWidth = '44.76%';
            } else {
                el.tabla_gantt.style.removeProperty('max-width');
            }
            saveState();
        };
    }
    // -------------------------------------

    if (el.btnDrawerClose) el.btnDrawerClose.onclick = () => { el.drawer.classList.remove('visible'); el.tabla_gantt.style.removeProperty('max-width'); saveState(); };

    let isSync = false;
    if (el.centersContainer && el.timelineScroll) {
      el.centersContainer.onscroll = function () { if (!isSync) { isSync = true; el.timelineScroll.scrollTop = this.scrollTop; isSync = false; } };
      el.timelineScroll.onscroll = function () { if (!isSync) { isSync = true; el.centersContainer.scrollTop = this.scrollTop; isSync = false; } };
    }

    [el.filterCode, el.filterDesc].forEach(i => {
      if (i) i.addEventListener('input', () => { refreshAll(); saveState(); });
    });

    window.addEventListener('resize', () => { createHeader(); renderCalendar(); centerNow(); });

    document.querySelectorAll('.acc-head').forEach(head => {
      head.addEventListener('click', function () {
        const body = this.nextElementSibling;
        const toggle = this.querySelector('.acc-toggle');
        const isOpen = body.classList.contains('open');
        if (!isOpen) { body.classList.add('open'); body.style.maxHeight = body.scrollHeight + 'px'; toggle.textContent = '▾'; }
        else { body.classList.remove('open'); body.style.maxHeight = null; toggle.textContent = '▸'; }
        setTimeout(saveState, 300);
      });
    });

    // INICIALIZACIÓN DE ACORDEONES ABIERTOS (Corrección Final)
    // Asegurar que si el HTML dice 'open', el JS les de altura al inicio
    document.querySelectorAll('.acc-body.open').forEach(b => {
      b.style.maxHeight = b.scrollHeight + 'px';
    });

    refreshAll();
    setTimeout(() => {
      centerNow();
      if (el.timelineScroll && el.timeLine) {
        const left = parseFloat(el.timeLine.style.left || 0);
        el.timelineScroll.scrollLeft = Math.max(0, left - (el.timelineScroll.clientWidth / 2));
      }
    }, 150);
    setInterval(centerNow, 60000);
  }

  init();
})();