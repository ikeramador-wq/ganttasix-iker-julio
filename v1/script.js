(function () {
  /* ------------------ CONFIGURACIÓN ------------------ */
  const BASE_H_CELL = 50, BASE_D_CELL = 110;
  
  // Configuración de px por unidad visual
  const ZOOM_CONFIG = {
    hours: 60, days: 120, weeks: 50, fortnight: 30, 
    month: 100, // Mensual ahora es más ancho para mostrar "Lunes, Martes..."
    quarter: 10, semester: 5, annual: 1 // Annual se calcula dinámico
  };

  let now = new Date();

  const config = {
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
    inpDateFrom: document.getElementById('dateFrom'),
    inpDateTo: document.getElementById('dateTo'),
    chkResources: document.getElementById('chkResources'),
    chkAlarms: document.getElementById('chkAlarms'),
    filterCode: document.getElementById('filterCode'),
    filterDesc: document.getElementById('filterDesc')
  };

  /* ------------------ LOGICA ESCALAS ------------------ */
  function getPxPerUnit() {
    // Para Anual, calculamos el ancho para que quepa en pantalla
    if (config.scale === 'annual') {
        const containerW = el.timelineScroll.clientWidth || 1000;
        // Queremos mostrar aprox 12 meses.
        // Pero la unidad base lógica es 'día' para posicionar.
        // 365 días en containerW.
        return containerW / 370; // un poco menos para asegurar márgenes
    }
    return ZOOM_CONFIG[config.scale] || ZOOM_CONFIG.days;
  }

  function getScaleUnitMs() {
    return config.scale === 'hours' ? 3600000 : 86400000;
  }

  function computeTimelineRange() {
    if (config.manualStart && config.manualEnd) {
      return { 
        timelineStartDate: new Date(config.manualStart), 
        timelineEndDate: new Date(config.manualEnd) 
      };
    }
    
    const stamps = [];
    data.forEach(c => c.machines.forEach(m => m.jobs.forEach(j => {
      const s = new Date(j.start).getTime(), e = new Date(j.end).getTime();
      if (!isNaN(s)) stamps.push(s);
      if (!isNaN(e)) stamps.push(e);
    })));

    let earliest, latest;

    if (!stamps.length) {
      const s = new Date(); s.setDate(s.getDate() - 1);
      const e = new Date(); e.setDate(e.getDate() + 30);
      earliest = s; latest = e;
    } else {
      earliest = new Date(Math.min(...stamps));
      latest = new Date(Math.max(...stamps));
    }

    const today = new Date();
    if(today < earliest) earliest = new Date(today);
    if(today > latest) latest = new Date(today);

    // LÓGICA DE BUFFER (MÁRGENES)
    if (config.scale === 'hours') {
      earliest.setHours(earliest.getHours() - 2); 
      latest.setHours(latest.getHours() + 24);
    } 
    else if (config.scale === 'annual') {
      // En anual mostramos el año actual completo o un rango fijo de 12 meses desde inicio
      earliest.setDate(1); earliest.setMonth(0); // 1 Enero
      latest = new Date(earliest); latest.setFullYear(latest.getFullYear() + 1); // 1 Año entero
    }
    else {
      earliest.setDate(earliest.getDate() - 3); 
      latest.setDate(latest.getDate() + 45); 
    }
    
    earliest.setHours(0,0,0,0); latest.setHours(23,59,59,999);
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
    setTimeout(centerNow, 50);
  }

  /* --- HEADER ESPECIAL (MENSUAL / ANUAL) --- */
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

    // 1. ESCALA MENSUAL (Detalle Semanal + Diario con nombres)
    if (config.scale === 'month') {
        // Mostramos cada día, pero agrupando visualmente la semana
        // Aunque dibujamos día a día para que cuadre con el Gantt.
        for(let i=0; i<totalUnits; i++) {
            const d = new Date(timelineStartDate); d.setDate(d.getDate() + i);
            const dayNum = d.getDay(); // 0 Dom, 1 Lun, etc.
            const block = document.createElement('div');
            block.className = 'day-block';
            block.style.width = pxPerUnit + 'px';
            
            // Texto detallado "Lun 01"
            const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' }); // "lun."
            const dayNumber = d.getDate();
            
            // Estilo especial para el inicio de semana (Lunes=1)
            if(dayNum === 1) {
                block.style.borderLeft = '2px solid rgba(16,185,129,0.3)'; // Marca visual semana
            }
            
            block.innerHTML = `
                <div class="day-label" style="line-height:1.2">
                    <span style="font-size:11px; text-transform:capitalize; opacity:0.6">${dayName}</span>
                    <span style="font-size:14px">${dayNumber}</span>
                </div>
            `;
            frag.appendChild(block);
        }
    }
    // 2. ESCALA ANUAL (Ocupar ancho, mostrar meses)
    else if (config.scale === 'annual') {
        // Aquí no dibujamos días, dibujamos MESES
        // PERO el Gantt dibuja por posición absoluta de tiempo.
        // Así que el header debe coincidir matemáticamente.
        
        let current = new Date(timelineStartDate);
        while(current < timelineEndDate) {
            const mStart = new Date(current);
            const mEnd = new Date(current.getFullYear(), current.getMonth()+1, 1);
            const days = (mEnd - mStart) / 86400000;
            const width = days * pxPerUnit; // pxPerUnit está calculado para encajar el año
            
            const block = document.createElement('div');
            block.className = 'day-block';
            block.style.width = width + 'px';
            block.style.borderRight = '1px solid rgba(0,0,0,0.1)';
            block.innerHTML = `<div class="day-label">${mStart.toLocaleString('es',{month:'long'})}</div>`;
            
            frag.appendChild(block);
            current = mEnd;
        }
    }
    // 3. HORAS
    else if (config.scale === 'hours') {
      const days = Math.ceil(totalUnits / 24);
      for(let i=0; i<days; i++) {
        const d = new Date(timelineStartDate); d.setDate(d.getDate() + i);
        const block = document.createElement('div');
        block.className = 'day-block';
        block.style.width = (pxPerUnit * 24) + 'px';
        block.innerHTML = `<div class="day-label">${fmtDateClean(d)}</div><div class="hours">${renderHoursRow(pxPerUnit)}</div>`;
        frag.appendChild(block);
      }
    } 
    // 4. RESTO (Días normales)
    else {
      for(let i=0; i<totalUnits; i++) {
        const d = new Date(timelineStartDate); d.setDate(d.getDate() + i);
        const block = document.createElement('div');
        block.className = 'day-block';
        block.style.width = pxPerUnit + 'px';
        let text = fmtDateClean(d);
        if (d.getDay()===0||d.getDay()===6) block.style.backgroundColor = 'rgba(0,0,0,0.02)';
        block.innerHTML = `<div class="day-label" style="font-size:11px">${text}</div>`;
        frag.appendChild(block);
      }
    }
    el.headerDays.appendChild(frag);
  }

  function renderHoursRow(w) {
    let html = '';
    if (w < 20) return ''; 
    for(let h=0; h<24; h+= (w<30 ? 2 : 1)) {
       html += `<div class="hour" style="flex:1; border-right:1px solid #eee; font-size:9px;">${h}</div>`;
    }
    return html;
  }

  /* ------------------ RENDER MENU ------------------ */
  function renderMenu() {
    if(!el.centersContainer) return;
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
      card.className = `center-card ${center.expanded ? 'expanded' : ''}`; // Clase expanded para el icono
      
      // HEADER CON ICONO FLECHA
      card.innerHTML = `
        <div class="sidebar-center-header">
           <div>${center.code} — ${center.name}</div>
           <div style="display:flex; align-items:center; gap:5px; font-size:11px;opacity:0.7">
             <span>(${visibleMachines.length})</span>
             <!-- ICONO CHEVRON -->
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
    if(!el.calendar) return;
    el.calendar.innerHTML = '';
    const fCode = (el.filterCode.value || '').toLowerCase();
    const fDesc = (el.filterDesc.value || '').toLowerCase();

    data.forEach(center => {
      if (config.hideEmptyResources && !center.machines.some(m=>m.jobs.length>0)) return;
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
            if(isNaN(s) || isNaN(e)) return;
            
            const unitMs = getScaleUnitMs();
            const pxPerUnit = getPxPerUnit();
            
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
       if(active) e.style.setProperty('background-color', 'rgba(16, 185, 129, 0.1)', 'important');
       else e.style.removeProperty('background-color');
    });
  }

  function transformApiData(apiResponse) {
    const centersMap = new Map();
    const colors = ['#10b981', '#34d399', '#0ea5e9', '#facc15', '#f87171', '#a78bfa'];
    (apiResponse.result.Menu || []).forEach(m => {
      if (!centersMap.has(m.Centro)) centersMap.set(m.Centro, { code: m.Centro, name: m.Descripcion||'', expanded:true, machines:[] });
      if (m.Maquina) m.Maquina.forEach(mq => centersMap.get(m.Centro).machines.push({ code: mq.Maquina, name: mq.Descripcion||'', jobs:[] }));
    });
    (apiResponse.result.trabajos_O || []).forEach(t => {
      const c = centersMap.get(t.Centro_Trabajo);
      if(c) {
        const mq = c.machines.find(x => x.code === t.Codigo_Maquina);
        if(mq) mq.jobs.push({
          name: t.Articulo, 
          start: new Date(t.Fe_Ho_Inicio_Asig), 
          end: new Date(t.Fe_Ho_Final_Asig),
          color: colors[Math.floor(Math.random()*colors.length)],
          articulo: t.Articulo, fase: t.Descripcion_Fase, trabajo: t.Trabajo
        });
      }
    });
    return Array.from(centersMap.values());
  }
  function fmtDateClean(d) { return `${d.getDate()} ${d.toLocaleString('es',{month:'short'})}`; }
  function fmtDateTime(d) { return d.toLocaleString('es'); }

  function init() {
    if(el.chkCurrentTime) el.chkCurrentTime.onchange = (e) => { config.showCurrentTime = e.target.checked; centerNow(); };
    if(el.inpBgColor) el.inpBgColor.addEventListener('input', (e) => { config.bgColor = e.target.value; document.documentElement.style.setProperty('--bg-normal', config.bgColor); });
    if(el.inpAltColor) el.inpAltColor.addEventListener('input', (e) => { config.altColor = e.target.value; document.documentElement.style.setProperty('--bg-alt', config.altColor); });
    if(el.inpLineColor) el.inpLineColor.addEventListener('input', (e) => { config.lineColor = e.target.value; document.documentElement.style.setProperty('--line-color', config.lineColor); });

    const updateDates = () => {
       if (el.inpDateFrom.value) config.manualStart = el.inpDateFrom.value;
       if (el.inpDateTo.value) config.manualEnd = el.inpDateTo.value;
       refreshAll();
    };
    if(el.inpDateFrom) el.inpDateFrom.onchange = updateDates;
    if(el.inpDateTo) el.inpDateTo.onchange = updateDates;
    if(el.chkResources) el.chkResources.onchange = (e) => { config.hideEmptyResources = e.target.checked; refreshAll(); };
    if(el.chkAlarms) el.chkAlarms.onchange = (e) => { config.showAlarms = e.target.checked; refreshAll(); };

    document.querySelectorAll('input[name="scaleGroup"]').forEach(r => {
      r.onchange = (e) => { if(e.target.checked) { config.scale = e.target.value; refreshAll(); } };
    });

    if(el.btnAdvanced) el.btnAdvanced.onclick = () => el.drawer.classList.toggle('visible');
    if(el.btnDrawerClose) el.btnDrawerClose.onclick = () => el.drawer.classList.remove('visible');
    
    let isSync = false;
    if(el.centersContainer && el.timelineScroll) {
      el.centersContainer.onscroll = function() { if(!isSync) { isSync=true; el.timelineScroll.scrollTop = this.scrollTop; isSync=false; } };
      el.timelineScroll.onscroll = function() { if(!isSync) { isSync=true; el.centersContainer.scrollTop = this.scrollTop; isSync=false; } };
    }
    
    [el.filterCode, el.filterDesc].forEach(i => { if(i) i.addEventListener('input', refreshAll); });
    window.addEventListener('resize', () => { createHeader(); renderCalendar(); centerNow(); });

    document.querySelectorAll('.acc-head').forEach(head => {
      head.addEventListener('click', function() {
         const body = this.nextElementSibling;
         const toggle = this.querySelector('.acc-toggle');
         const isOpen = body.classList.contains('open');
         if(!isOpen) { body.classList.add('open'); body.style.maxHeight = body.scrollHeight + 'px'; toggle.textContent = '▾'; }
         else { body.classList.remove('open'); body.style.maxHeight = null; toggle.textContent = '▸'; }
      });
    });

    if(el.inpBgColor) el.inpBgColor.value = config.bgColor;
    if(el.inpAltColor) el.inpAltColor.value = config.altColor;
    if(el.inpLineColor) el.inpLineColor.value = config.lineColor;

    refreshAll();
    setTimeout(() => {
        centerNow();
        if(el.timelineScroll && el.timeLine) {
            const left = parseFloat(el.timeLine.style.left || 0);
            el.timelineScroll.scrollLeft = Math.max(0, left - (el.timelineScroll.clientWidth / 2));
        }
    }, 150);
    setInterval(centerNow, 60000);
  }

  init();
})();