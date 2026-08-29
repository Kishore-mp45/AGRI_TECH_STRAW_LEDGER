/* ============================================================
   THE STRAW LEDGER — MRV Ledger
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  let allRecords = [];
  let currentRecord = null;
  let pendingAction = null; // 'verified' | 'rejected'

  const $ = (id) => document.getElementById(id);

  function filters() {
    return { q: $('mrvSearch').value.trim(), status: $('statusFilter').value, zone: $('zoneFilter').value };
  }

  function applyFilters() {
    const f = filters();
    let rows = allRecords.slice();
    if (f.status !== 'all') rows = rows.filter((r) => r.status === f.status);
    if (f.zone !== 'all') rows = rows.filter((r) => String((r.routing || {}).zone_id || 'unassigned') === f.zone);
    if (f.q) {
      const q = f.q.toLowerCase();
      rows = rows.filter((r) =>
        [r.mrv_id, r.batch_id, r.farmer_name, r.plot_name, r.plot_province, (r.routing||{}).zone_name, (r.routing||{}).facility_name].join(' ').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  function renderStats() {
    const total = allRecords.length;
    const count = (s) => allRecords.filter((r) => r.mrv_status === s).length;
    const cards = [
      { icon: 'ledger', cls: 'kpi--pine', label: 'Total MRV records', v: total, f: (v) => fmt.num(v, 0), foot: 'on the ledger' },
      { icon: 'info', cls: 'kpi--gold', label: 'Pending review', v: count('pending'), f: (v) => fmt.num(v, 0), foot: 'awaiting verification' },
      { icon: 'shield', cls: 'kpi--pine', label: 'Verified', v: count('verified'), f: (v) => fmt.num(v, 0), foot: 'audit complete' },
      { icon: 'alert', cls: 'kpi--rust', label: 'Rejected', v: count('rejected'), f: (v) => fmt.num(v, 0), foot: 'resubmission required' }
    ];
    $('mrvStats').innerHTML = cards.map((k) => `
      <div class="kpi ${k.cls}">
        <div class="kpi__label">${I[k.icon]} ${k.label}</div>
        <div class="kpi__value">${k.f(k.v)}</div>
        <div class="kpi__foot">${k.foot}</div>
      </div>`).join('');
  }

  function renderTable() {
    const rows = applyFilters();
    $('resultCount').textContent = `${rows.length} of ${allRecords.length} records`;
    const wrap = $('mrvTableWrap');
    if (!allRecords.length) {
      UI.mountState(wrap, 'empty', { icon: 'ledger', title: 'No MRV records yet', message: 'Records are written to the ledger when straw batches pass through conversion.' });
      return;
    }
    if (!rows.length) {
      UI.mountState(wrap, 'empty', { icon: 'search', title: 'No matching records', message: 'Adjust the search text or filters to widen the result set.' });
      return;
    }
    wrap.innerHTML = `
      <table class="table table--clickable">
        <thead><tr>
          <th>MRV ID</th><th>Batch · Source</th><th>Plot</th><th>Straw</th>
          <th>CO₂e</th><th>Zone → Facility</th><th>Status</th><th>Updated</th>
        </tr></thead>
        <tbody>${rows.map((r) => `
          <tr data-mrv="${r.mrv_id}">
            <td><span class="mrv-row-id">${r.mrv_id}</span></td>
            <td><span class="cell-main mono">${r.batch_code || r.batch_id}</span><span class="cell-sub">${r.farmer_name}</span></td>
            <td>${r.plot_name}<span class="cell-sub">${r.plot_province} · ${r.plot_area_rai} rai</span></td>
            <td class="num">${fmt.tonnes(r.straw_volume_ton, 1)}</td>
            <td class="num">${fmt.co2e((r.calculation||{}).co2e_sequestered_ton, 1)}</td>
            <td>${(r.routing||{}).zone_name}<span class="cell-sub">${(r.routing||{}).facility_name}</span></td>
            <td>${UI.badge(r.mrv_status)}</td>
            <td class="small muted" style="white-space:nowrap">${fmt.date(r.mrv_updated_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    wrap.querySelectorAll('tr[data-mrv]').forEach((tr) => {
      tr.addEventListener('click', () => openDrawer(tr.dataset.mrv));
    });
  }

  /* ---------------- Drawer ---------------- */
  function openDrawer(id) {
    const r = allRecords.find((x) => x.mrv_id === id);
    if (!r) return;
    currentRecord = r;
    $('drawerId').textContent = r.mrv_id;
    $('drawerStatus').innerHTML = UI.badge(r.mrv_status);
    $('drawerBody').innerHTML = `
      <div class="tiny muted" style="font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:8px">Traceability chain</div>
      <div class="trace" style="padding-bottom:4px">
        <div class="trace__node">${I.farmer}<b>Farmer</b><span>${r.farmer_name}</span></div>
        <span class="trace__arrow">${I.arrowRight}</span>
        <div class="trace__node">${I.package}<b>Batch</b><span class="mono">${r.batch_code || r.batch_id}</span></div>
        <span class="trace__arrow">${I.arrowRight}</span>
        <div class="trace__node">${I.route}<b>Routing</b><span>${(r.routing||{}).zone_name}</span></div>
        <span class="trace__arrow">${I.arrowRight}</span>
        <div class="trace__node">${I.leaf}<b>Calc</b><span>${fmt.co2e((r.calculation||{}).co2e_sequestered_ton, 1)}</span></div>
        <span class="trace__arrow">${I.arrowRight}</span>
        <div class="trace__node">${I.ledger}<b>MRV</b><span class="mono">${r.mrv_id}</span></div>
      </div>

      <div class="tiny muted" style="font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:18px 0 6px">Source & plot</div>
      <div class="dlist">
        <div class="dlist__row"><span class="dlist__k">Farmer</span><span class="dlist__v">${r.farmer_name}</span></div>
        <div class="dlist__row"><span class="dlist__k">Plot</span><span class="dlist__v">${r.plot_name}, ${r.plot_province}</span></div>
        <div class="dlist__row"><span class="dlist__k">Coordinates</span><span class="dlist__v mono">${r.plot_latitude.toFixed(4)}, ${r.plot_longitude.toFixed(4)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Plot area</span><span class="dlist__v mono">${r.plot_area_rai} rai</span></div>
        <div class="dlist__row"><span class="dlist__k">Harvest</span><span class="dlist__v">${fmt.date(r.harvest_date)}</span></div>
      </div>

      <div class="tiny muted" style="font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:18px 0 6px">Routing</div>
      <div class="dlist">
        <div class="dlist__row"><span class="dlist__k">Collection zone</span><span class="dlist__v">${(r.routing||{}).zone_name} <span class="mono tiny muted">${(r.routing||{}).zone_code || '—'}</span></span></div>
        <div class="dlist__row"><span class="dlist__k">Pyrolysis facility</span><span class="dlist__v">${(r.routing||{}).facility_name}</span></div>
      </div>

      <div class="tiny muted" style="font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:18px 0 6px">Calculations</div>
      <div class="dlist">
        <div class="dlist__row"><span class="dlist__k">Straw volume</span><span class="dlist__v mono">${fmt.tonnes(r.straw_volume_ton, 2)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Biochar</span><span class="dlist__v mono">${fmt.tonnes((r.calculation||{}).biochar_yield_ton, 2)}</span></div>
        <div class="dlist__row"><span class="dlist__k">CO₂e sequestered</span><span class="dlist__v mono">${fmt.co2e((r.calculation||{}).co2e_sequestered_ton, 2)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Gross value</span><span class="dlist__v mono">${fmt.moneyCompact((r.calculation||{}).gross_value_usd)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Farmer payout</span><span class="dlist__v mono">${fmt.moneyCompact((r.calculation||{}).farmer_payout_usd)}</span></div>
      </div>

      <div class="tiny muted" style="font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin:18px 0 6px">Audit trail</div>
      <div class="dlist">
        <div class="dlist__row"><span class="dlist__k">Created</span><span class="dlist__v mono small">${fmt.dateTime(r.mrv_created_at)}</span></div>
        <div class="dlist__row"><span class="dlist__k">Last update</span><span class="dlist__v mono small">${fmt.dateTime(r.mrv_updated_at)}</span></div>
      </div>
      ${r.rejection_reason ? `<div class="alert alert--error" style="margin-top:12px">${I.clipboard}<div class="small"><b>Verifier note</b><br/>${r.rejection_reason}</div></div>` : ''}`;

    const isPending = r.mrv_status !== 'verified';
    $('verifyBtn').style.display = isPending ? '' : 'none';
    $('rejectBtn').style.display = isPending ? '' : 'none';

    $('mrvDrawer').classList.add('is-open');
    $('drawerBackdrop').classList.add('is-open');
  }

  function closeDrawer() {
    $('mrvDrawer').classList.remove('is-open');
    $('drawerBackdrop').classList.remove('is-open');
    currentRecord = null;
  }

  /* ---------------- Status update ---------------- */
  function askNote(action) {
    if (!currentRecord) return;
    pendingAction = action;
    $('noteModalTitle').textContent = action === 'verified' ? 'Verify record' : 'Reject record';
    $('noteModalText').textContent = action === 'verified'
      ? `Mark ${currentRecord.mrv_id} as verified. The note is appended to the audit trail.`
      : `Reject ${currentRecord.mrv_id}. Explain why so the farmer/operator can resubmit.`;
    $('verifierNote').value = '';
    $('noteModal').classList.add('is-open');
    setTimeout(() => $('verifierNote').focus(), 120);
  }

  async function confirmNote() {
    if (!currentRecord || !pendingAction) return;
    const note = $('verifierNote').value.trim();
    const id = currentRecord.mrv_id;
    const action = pendingAction;
    const btn = $('noteConfirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving…';
    try {
      const updated = await API.updateMrvStatus(id, action, note);
      const idx = allRecords.findIndex((r) => r.mrv_id === id);
      if (idx >= 0) allRecords[idx] = updated;
      $('noteModal').classList.remove('is-open');
      closeDrawer();
      renderStats();
      renderTable();
      UI.toast(`${id} marked as ${action}.`, action === 'verified' ? 'success' : 'warn');
    } catch (err) {
      UI.toast('Status update failed — ' + (err.message || 'unknown error'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm';
      pendingAction = null;
    }
  }

  /* ---------------- Load ---------------- */
  async function load() {
    $('mrvTableWrap').innerHTML = '<div class="skeleton skeleton--block" style="margin:18px"></div>';
    $('mrvStats').innerHTML = '<div class="skeleton skeleton--kpi"></div><div class="skeleton skeleton--kpi"></div><div class="skeleton skeleton--kpi"></div><div class="skeleton skeleton--kpi"></div>';
    try {
      allRecords = await API.getMrvRecords({});
      const zoneSel = $('zoneFilter');
      const zoneIds = [...new Set(allRecords.map((r) => (r.routing||{}).zone_id).filter(Boolean))];
      const current = zoneSel.value;
      zoneSel.innerHTML = '<option value="all">All collection zones</option>' +
        '<option value="unassigned">Unassigned</option>' +
        zoneIds.map((z) => `<option value="${z}">${z}</option>`).join('');
      zoneSel.value = current || 'all';
      renderStats();
      renderTable();
    } catch (err) {
      UI.mountState($('mrvTableWrap'), 'error', { message: err.message, onRetry: load });
      UI.mountState($('mrvStats'), 'error', { message: err.message, retry: false });
    }
  }

  window.StrawLedgerApp.init(() => {
    $('searchIcon').innerHTML = I.search;
    $('mrvRefreshIcon').innerHTML = I.refresh;
    $('drawerCloseIcon').innerHTML = I.x;
    $('noteCloseIcon').innerHTML = I.x;
    $('verifyIcon').innerHTML = I.check;
    $('rejectIcon').innerHTML = I.x;

    let debounce = null;
    $('mrvSearch').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(renderTable, 220);
    });
    $('statusFilter').addEventListener('change', renderTable);
    $('zoneFilter').addEventListener('change', renderTable);
    $('mrvRefreshBtn').addEventListener('click', load);

    $('drawerClose').addEventListener('click', closeDrawer);
    $('drawerBackdrop').addEventListener('click', closeDrawer);
    $('verifyBtn').addEventListener('click', () => askNote('verified'));
    $('rejectBtn').addEventListener('click', () => askNote('rejected'));
    $('noteCancel').addEventListener('click', () => $('noteModal').classList.remove('is-open'));
    $('noteModalClose').addEventListener('click', () => $('noteModal').classList.remove('is-open'));
    $('noteConfirm').addEventListener('click', confirmNote);
    $('noteModal').addEventListener('click', (e) => { if (e.target === $('noteModal')) $('noteModal').classList.remove('is-open'); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeDrawer(); $('noteModal').classList.remove('is-open'); }
    });

    load();
  });
})();
