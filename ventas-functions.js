// ==========================================================
// ADASMEG VENTAS — renderVentasTable / renderVentasCharts / exportVentasDashboardPDF
// Usa las globales ya declaradas: chartVentasCliente, chartVentasCostos,
// chartVentasTecnico, chartVentasEvolucion, y los helpers vEl, vMoney, vSum.
// ==========================================================

// Escapa texto para insertarlo de forma segura en innerHTML
function ventasEsc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Regla de negocio: utilidad neta negativa o margen neto < 10% => alerta
function ventasEsAlerta(d) {
    if (d.utilidadNeta < 0) return true;
    return d.factura > 0 && (d.utilidadNeta / d.factura) < 0.10;
}

// ------------------------------------------------------------------
// 1. TABLA
// ------------------------------------------------------------------
function renderVentasTable(data) {
    const head = document.getElementById('ventas-table-head');
    const body = document.getElementById('table-body-ventas');
    const foot = document.getElementById('ventas-table-foot');
    const count = document.getElementById('ventas-table-count');
    if (!head || !body || !foot) return;

    const cols = [
        ['Cliente', 'left'], ['Orden', 'left'], ['Factura S/I', 'right'], ['Costo Total', 'right'],
        ['Equipos', 'right'], ['Mano Obra', 'right'], ['Materiales', 'right'], ['Técnico', 'left'],
        ['Utilidad Bruta', 'right'], ['Utilidad Neta', 'right'], ['Estado', 'left']
    ];
    head.innerHTML = cols.map(([t, a]) =>
        `<th class="p-3 whitespace-nowrap ${a === 'right' ? 'text-right' : 'text-left'}">${t}</th>`).join('');

    if (count) count.textContent = data.length ? `(${data.length} registros)` : '';

    if (!data.length) {
        body.innerHTML = `<tr><td colspan="${cols.length}" class="p-6 text-center text-slate-400">No hay facturas para los filtros seleccionados.</td></tr>`;
        foot.innerHTML = '';
        return;
    }

    body.innerHTML = data.map(d => {
        const alerta = ventasEsAlerta(d);
        const fin = String(d.estado).toLowerCase() === 'finalizado';
        const badge = fin ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
        const unCls = d.utilidadNeta < 0 ? 'text-red-600 font-semibold' : 'text-slate-800 font-semibold';
        return `<tr class="${alerta ? 'bg-red-50' : 'hover:bg-gray-50'}">
            <td class="p-3 text-slate-800 font-medium">${ventasEsc(d.cliente)}</td>
            <td class="p-3 text-slate-600 whitespace-nowrap">${ventasEsc(d.orden) || '—'}</td>
            <td class="p-3 text-right text-slate-700 whitespace-nowrap">${vMoney(d.factura)}</td>
            <td class="p-3 text-right text-slate-700 whitespace-nowrap">${vMoney(d.costoTotal)}</td>
            <td class="p-3 text-right text-slate-600 whitespace-nowrap">${vMoney(d.equipos)}</td>
            <td class="p-3 text-right text-slate-600 whitespace-nowrap">${vMoney(d.manoObra)}</td>
            <td class="p-3 text-right text-slate-600 whitespace-nowrap">${vMoney(d.materiales)}</td>
            <td class="p-3 text-slate-600 whitespace-nowrap">${ventasEsc(d.tecnico)}</td>
            <td class="p-3 text-right text-slate-700 whitespace-nowrap">${vMoney(d.utilidadBruta)}</td>
            <td class="p-3 text-right whitespace-nowrap ${unCls}">${vMoney(d.utilidadNeta)}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${badge}">${ventasEsc(vCap(String(d.estado)))}</span></td>
        </tr>`;
    }).join('');

    foot.innerHTML = `<tr class="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
        <td class="p-3" colspan="2">TOTALES</td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'factura'))}</td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'costoTotal'))}</td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'equipos'))}</td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'manoObra'))}</td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'materiales'))}</td>
        <td class="p-3"></td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'utilidadBruta'))}</td>
        <td class="p-3 text-right whitespace-nowrap">${vMoney(vSum(data, 'utilidadNeta'))}</td>
        <td class="p-3"></td>
    </tr>`;
}

// ------------------------------------------------------------------
// 2. GRÁFICOS
// ------------------------------------------------------------------
function renderVentasCharts(data, dataSinFiltroMes) {
    const base = dataSinFiltroMes || data;
    const money = v => vMoney(v);
    const compact = v => Math.abs(v) >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k' : '$' + v;
    const trunc = s => s.length > 22 ? s.slice(0, 21) + '…' : s;

    // Destruir gráficos previos
    if (chartVentasCliente) chartVentasCliente.destroy();
    if (chartVentasCostos) chartVentasCostos.destroy();
    if (chartVentasTecnico) chartVentasTecnico.destroy();
    if (chartVentasEvolucion) chartVentasEvolucion.destroy();
    chartVentasCliente = chartVentasCostos = chartVentasTecnico = chartVentasEvolucion = null;

    // ---- Gráfico 1: Top 10 clientes (barras horizontales) ----
    const porCliente = {};
    data.forEach(d => { porCliente[d.cliente] = (porCliente[d.cliente] || 0) + d.factura; });
    const top = Object.entries(porCliente).sort((a, b) => b[1] - a[1]).slice(0, 10);
    setEmptyState('ventas-cliente', data.length > 0);
    if (data.length > 0) {
        chartVentasCliente = new Chart(document.getElementById('chartVentasCliente'), {
            type: 'bar',
            data: { labels: top.map(t => t[0]), datasets: [{ label: 'Monto Facturado', data: top.map(t => t[1]), backgroundColor: '#3b82f6', borderRadius: 4 }] },
            options: {
                indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + money(c.parsed.x) } } },
                scales: {
                    x: { beginAtZero: true, title: { display: true, text: 'Monto Facturado' }, ticks: { callback: v => compact(v) } },
                    y: { ticks: { callback: function (v) { return trunc(String(this.getLabelForValue(v))); } } }
                }
            }
        });
    }

    // ---- Gráfico 2: Composición de costos (dona) ----
    const comp = [vSum(data, 'equipos'), vSum(data, 'manoObra'), vSum(data, 'materiales'), vSum(data, 'otros')];
    const compTotal = comp.reduce((s, v) => s + v, 0);
    setEmptyState('ventas-costos', compTotal > 0);
    if (compTotal > 0) {
        chartVentasCostos = new Chart(document.getElementById('chartVentasCostos'), {
            type: 'doughnut',
            data: {
                labels: ['Equipos', 'Mano de Obra', 'Materiales', 'Otros'],
                datasets: [{ data: comp, backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'], borderColor: '#fff', borderWidth: 2 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '55%',
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: { callbacks: { label: c => ` ${c.label}: ${money(c.parsed)} (${(c.parsed / compTotal * 100).toFixed(1)}%)` } }
                }
            }
        });
    }

    // ---- Gráfico 3: Utilidad neta por técnico (barras verticales) ----
    const porTec = {};
    data.forEach(d => { porTec[d.tecnico] = (porTec[d.tecnico] || 0) + d.utilidadNeta; });
    const tecs = Object.entries(porTec).sort((a, b) => b[1] - a[1]);
    setEmptyState('ventas-tecnico', tecs.length > 0);
    if (tecs.length > 0) {
        chartVentasTecnico = new Chart(document.getElementById('chartVentasTecnico'), {
            type: 'bar',
            data: { labels: tecs.map(t => t[0]), datasets: [{ label: 'Utilidad Neta', data: tecs.map(t => t[1]), backgroundColor: '#6366f1', borderRadius: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + money(c.parsed.y) } } },
                scales: { y: { ticks: { callback: v => compact(v) } } }
            }
        });
    }

    // ---- Gráfico 4: Evolución mensual (usa base = sin filtro de mes) ----
    const porMes = {};
    base.forEach(d => {
        const m = porMes[d.mes] || (porMes[d.mes] = { n: d.mesNum, v: 0, c: 0, u: 0 });
        m.v += d.factura; m.c += d.costoTotal; m.u += d.utilidadNeta;
    });
    const meses = Object.entries(porMes).sort((a, b) => a[1].n - b[1].n); // cronológico
    setEmptyState('ventas-evolucion', meses.length > 0);
    if (meses.length > 0) {
        const line = (label, key, color) => ({
            label, data: meses.map(m => m[1][key]), borderColor: color, backgroundColor: color + '22',
            borderWidth: 2.5, tension: 0.3, pointRadius: 4, pointBackgroundColor: color
        });
        chartVentasEvolucion = new Chart(document.getElementById('chartVentasEvolucion'), {
            type: 'line',
            data: {
                labels: meses.map(m => m[0]),
                datasets: [line('Ventas Totales', 'v', '#3b82f6'), line('Costo Total', 'c', '#ef4444'), line('Utilidad Neta', 'u', '#10b981')]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${money(c.parsed.y)}` } } },
                scales: { y: { ticks: { callback: v => compact(v) } } }
            }
        });
    }
}

// ------------------------------------------------------------------
// 3. PDF EJECUTIVO
// ------------------------------------------------------------------
function exportVentasDashboardPDF() {
    const data = getVentasFiltered(false);
    if (!data.length) { alert('No hay datos de ventas para exportar. Carga el archivo o ajusta los filtros.'); return; }
    if (!window.jspdf || !window.jspdf.jsPDF) { alert('No se pudo cargar jsPDF.'); return; }

    const pm = typeof formatPdfMoney === 'function' ? formatPdfMoney : vMoney;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();   // 210
    const M = 12;

    const tv = vSum(data, 'factura'), ct = vSum(data, 'costoTotal'),
          ub = vSum(data, 'utilidadBruta'), un = vSum(data, 'utilidadNeta');
    const margen = tv > 0 ? (un / tv * 100).toFixed(2) : '0.00';

    // ---- Página 1: encabezado ----
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('INFORME EJECUTIVO DE VENTAS - ADASMEG LOJA', M, 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Generado: ' + new Date().toLocaleDateString('es-EC'), M, 17.5);

    // Filtros aplicados
    const val = id => { const e = vEl(id); return e ? e.value : 'TODOS'; };
    const f = v => v === 'TODOS' ? 'Todos' : v;
    const q = vEl('search-ventas') ? vEl('search-ventas').value.trim() : '';
    doc.setTextColor(71, 85, 105); doc.setFontSize(9);
    doc.text(`Filtros:  Mes: ${f(val('filter-ventas-mes'))}   |   Técnico: ${f(val('filter-ventas-tecnico'))}   |   Estado: ${f(val('filter-ventas-estado'))}   |   Búsqueda: ${q || '—'}`, M, 29);

    // KPIs (3 x 2)
    const kpis = [
        ['Total Ventas', pm(tv), [59, 130, 246]],
        ['Costo Total', pm(ct), [239, 68, 68]],
        ['Utilidad Bruta', pm(ub), [16, 185, 129]],
        ['Utilidad Neta', pm(un), [99, 102, 241]],
        ['Margen Neto', margen + '%', [245, 158, 11]],
        ['N° Facturas', String(data.length), [100, 116, 139]]
    ];
    const gap = 4, kw = (W - 2 * M - 2 * gap) / 3, kh = 20, ky0 = 34;
    kpis.forEach((k, i) => {
        const x = M + (i % 3) * (kw + gap), y = ky0 + Math.floor(i / 3) * (kh + gap);
        doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, kw, kh, 2, 2, 'FD');
        doc.setFillColor(...k[2]); doc.roundedRect(x, y, 1.8, kh, 0.9, 0.9, 'F');
        doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(k[0], x + 5, y + 7);
        doc.setTextColor(...k[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
        doc.text(k[1], x + 5, y + 15.5);
    });

    // Gráficos (grid 2x2), con fondo blanco y proporción conservada
    const charts = [
        ['Ventas por Cliente (Top 10)', 'chartVentasCliente'],
        ['Composición de Costos', 'chartVentasCostos'],
        ['Utilidad Neta por Técnico', 'chartVentasTecnico'],
        ['Evolución Mensual', 'chartVentasEvolucion']
    ];
    const cw = (W - 2 * M - gap) / 2, ch = 66, cy0 = ky0 + 2 * (kh + gap) + 4;
    charts.forEach(([title, id], i) => {
        const x = M + (i % 2) * (cw + gap), y = cy0 + Math.floor(i / 2) * (ch + gap);
        doc.setFillColor(255, 255, 255); doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cw, ch, 2, 2, 'FD');
        doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text(title, x + 3, y + 5.5);
        const src = document.getElementById(id);
        if (!src || !src.width || !src.height) return;
        try {
            const tmp = document.createElement('canvas');
            tmp.width = src.width; tmp.height = src.height;
            const ctx = tmp.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, tmp.width, tmp.height);
            ctx.drawImage(src, 0, 0);
            const img = tmp.toDataURL('image/png');
            const bw = cw - 6, bh = ch - 10, r = src.width / src.height;
            let iw = bw, ih = bw / r;
            if (ih > bh) { ih = bh; iw = bh * r; }
            doc.addImage(img, 'PNG', x + 3 + (bw - iw) / 2, y + 8 + (bh - ih) / 2, iw, ih);
        } catch (e) { console.warn('No se pudo capturar ' + id, e); }
    });

    // ---- Página 2: tabla detallada ----
    doc.addPage();
    doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text('Detalle de Ventas', M, 16);

    doc.autoTable({
        startY: 21,
        margin: { left: M, right: M, bottom: 16 },
        head: [['Cliente', 'Factura', 'Costo Total', 'Utilidad Bruta', 'Utilidad Neta', 'Estado']],
        body: data.map(d => [d.cliente, pm(d.factura), pm(d.costoTotal), pm(d.utilidadBruta), pm(d.utilidadNeta), vCap(String(d.estado))]),
        foot: [['TOTALES', pm(tv), pm(ct), pm(ub), pm(un), '']],
        showFoot: 'lastPage',
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85], lineColor: [226, 232, 240] },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
        didParseCell: h => {
            if (h.section !== 'body') return;
            const d = data[h.row.index];
            if (d && ventasEsAlerta(d)) h.cell.styles.fillColor = [254, 226, 226];
            if (d && h.column.index === 4 && d.utilidadNeta < 0) h.cell.styles.textColor = [220, 38, 38];
        }
    });

    // ---- Footer en todas las páginas ----
    const total = doc.internal.getNumberOfPages(), H = doc.internal.pageSize.getHeight();
    for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setDrawColor(203, 213, 225); doc.line(M, H - 11, W - M, H - 11);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text('Informe mensual • ADASMEG Loja', M, H - 6);
        doc.text(`Página ${p} de ${total}`, W - M, H - 6, { align: 'right' });
    }

    doc.save('Informe_Ejecutivo_Ventas_ADASMEG.pdf');
}
