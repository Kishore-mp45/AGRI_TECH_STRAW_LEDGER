/* ============================================================
   THE STRAW LEDGER — Farmer Onboarding
   ============================================================ */
(function () {
  'use strict';

  const UI = window.StrawLedgerUI;
  const API = window.StrawLedgerAPI;
  const I = UI.ICONS;
  const fmt = UI.fmt;

  const FIELDS = ['farmer_name', 'farmer_phone', 'village', 'district', 'state',
    'latitude', 'longitude', 'plot_area_acres', 'crop_type', 'straw_volume_t',
    'moisture_pct', 'harvest_date'];

  const RULES = {
    farmer_name: (v) => (!v.trim() ? 'Full name is required.' : v.trim().length < 3 ? 'Enter the full name (min 3 characters).' : ''),
    farmer_phone: (v) => (!v.trim() ? 'Mobile number is required.' : (v.replace(/\D/g, '').length < 10 ? 'Enter a valid 10-digit mobile number.' : '')),
    village: (v) => (!v.trim() ? 'Village is required.' : ''),
    district: (v) => (!v.trim() ? 'District is required.' : ''),
    state: (v) => (!v.trim() ? 'State is required.' : ''),
    latitude: (v) => {
      if (v === '') return 'Latitude is required.';
      const n = parseFloat(v);
      return isNaN(n) || n < -90 || n > 90 ? 'Latitude must be between −90 and 90.' : '';
    },
    longitude: (v) => {
      if (v === '') return 'Longitude is required.';
      const n = parseFloat(v);
      return isNaN(n) || n < -180 || n > 180 ? 'Longitude must be between −180 and 180.' : '';
    },
    plot_area_acres: (v) => (v === '' ? 'Plot area is required.' : parseFloat(v) <= 0 ? 'Area must be greater than zero.' : ''),
    crop_type: (v) => (!v ? 'Select the crop type.' : ''),
    straw_volume_t: (v) => (v === '' ? 'Straw volume is required.' : parseFloat(v) <= 0 ? 'Volume must be greater than zero.' : ''),
    moisture_pct: (v) => {
      if (v === '') return '';
      const n = parseFloat(v);
      return isNaN(n) || n < 0 || n > 60 ? 'Moisture must be between 0 and 60%.' : '';
    },
    harvest_date: (v) => (!v ? 'Harvest date is required.' : '')
  };

  const val = (id) => (document.getElementById(id) ? document.getElementById(id).value : '');

  function setError(fieldId, msg) {
    const group = document.getElementById(fieldId)?.closest('.form-group');
    const errEl = document.querySelector(`[data-error="${fieldId}"]`);
    if (group) group.classList.toggle('is-invalid', !!msg);
    if (errEl) errEl.innerHTML = msg ? `${I.alert} ${msg}` : '';
  }

  function validateField(fieldId) {
    const msg = RULES[fieldId] ? RULES[fieldId](val(fieldId)) : '';
    setError(fieldId, msg);
    return !msg;
  }

  function validateAll() {
    let firstBad = null;
    FIELDS.forEach((f) => {
      const ok = validateField(f);
      if (!ok && !firstBad) firstBad = f;
    });
    return firstBad;
  }

  /* ---- Live summary + step rail ---- */
  function updateSummary() {
    const name = val('farmer_name').trim();
    const village = val('village').trim();
    const district = val('district').trim();
    const lat = val('latitude'); const lng = val('longitude');
    const vol = val('straw_volume_t');
    const date = val('harvest_date');
    const rows = [
      ['Farmer', name || '—'],
      ['Location', lat && lng ? `${parseFloat(lat).toFixed(4)}, ${parseFloat(lng).toFixed(4)}` : (village || district ? `${village}${district ? ', ' + district : ''}` : '—')],
      ['Straw volume', vol ? fmt.tonnes(parseFloat(vol), 1) : '—'],
      ['Harvest', date ? fmt.date(date) : '—']
    ];
    document.getElementById('liveSummary').innerHTML = rows.map((r) =>
      `<div class="dlist__row"><span class="dlist__k">${r[0]}</span><span class="dlist__v ${r[1] === '—' ? 'muted' : ''}">${r[1]}</span></div>`).join('');

    /* Step rail state */
    const sections = [
      ['farmer_name', 'farmer_phone', 'village', 'district', 'state'],
      ['latitude', 'longitude', 'plot_area_acres'],
      ['crop_type', 'straw_volume_t', 'harvest_date']
    ];
    const states = sections.map((fields) => {
      const filled = fields.filter((f) => val(f) !== '').length;
      const valid = fields.every((f) => val(f) !== '' && !RULES[f](val(f)));
      return { filled, valid, total: fields.length };
    });
    const activeIdx = states.findIndex((s) => s.filled < s.total);
    document.querySelectorAll('#stepRail .step-rail__item').forEach((el, idx) => {
      el.classList.toggle('is-done', states[idx].valid);
      el.classList.toggle('is-active', idx === (activeIdx === -1 ? 2 : activeIdx));
      const dot = el.querySelector('.step-rail__dot');
      if (dot) dot.innerHTML = states[idx].valid ? I.check : String(idx + 1);
    });
  }

  /* ---- Submission ---- */
  function buildPayload() {
    return {
      farmer: {
        name: val('farmer_name').trim(),
        phone: val('farmer_phone').trim(),
        village: val('village').trim(),
        district: val('district').trim(),
        state: val('state').trim()
      },
      batch: {
        crop_type: val('crop_type'),
        straw_volume_t: parseFloat(val('straw_volume_t')),
        moisture_pct: val('moisture_pct') === '' ? null : parseFloat(val('moisture_pct')),
        plot_area_acres: parseFloat(val('plot_area_acres')),
        latitude: parseFloat(val('latitude')),
        longitude: parseFloat(val('longitude')),
        harvest_date: val('harvest_date')
      }
    };
  }

  function setSubmitting(on) {
    const btn = document.getElementById('submitBtn');
    const icon = document.getElementById('submitIcon');
    btn.disabled = on;
    icon.innerHTML = on ? '<span class="spinner"></span>' : I.sprout;
    btn.lastChild.textContent = on ? ' Registering…' : ' Register farmer & batch';
  }

  async function onSubmit(e) {
    e.preventDefault();
    document.getElementById('formAlert').innerHTML = '';
    const firstBad = validateAll();
    if (firstBad) {
      document.getElementById('formAlert').innerHTML = `
        <div class="alert alert--error" style="margin-bottom:14px">${I.alert}
          <div><b>Please fix the highlighted fields.</b><div class="small">Required fields are marked with an asterisk and validated inline.</div></div>
        </div>`;
      const el = document.getElementById(firstBad);
      if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return;
    }

    setSubmitting(true);
    try {
      const result = await API.onboardFarmer(buildPayload());
      const batchId = result.batch_id || result.id || '—';
      document.getElementById('formColumn').classList.add('hidden');
      document.querySelector('.onboard-rail').classList.add('hidden');
      const wrap = document.getElementById('successWrap');
      wrap.classList.remove('hidden');
      document.getElementById('successIcon').innerHTML = I.check;
      document.getElementById('newBatchId').textContent = batchId;
      document.getElementById('successMeta').textContent =
        `${val('farmer_name')} · ${val('village')}, ${val('district')} · ${fmt.tonnes(parseFloat(val('straw_volume_t')), 1)} registered`;
      UI.toast(`Batch ${batchId} registered successfully.`);
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      document.getElementById('formAlert').innerHTML = `
        <div class="alert alert--error" style="margin-bottom:14px">${I.alert}
          <div><b>Registration failed.</b><div class="small">${err.message || 'The backend rejected the request.'}</div></div>
        </div>`;
      UI.toast('Registration failed — see the form alert.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    const form = document.getElementById('onboardForm');
    form.reset();
    FIELDS.forEach((f) => setError(f, ''));
    document.getElementById('formAlert').innerHTML = '';
    updateSummary();
  }

  window.StrawLedgerApp.init(() => {
    document.getElementById('submitIcon').innerHTML = I.sprout;
    document.getElementById('helpIcon').innerHTML = I.info;
    document.getElementById('successIcon').innerHTML = I.check;

    FIELDS.forEach((f) => {
      const el = document.getElementById(f);
      if (!el) return;
      el.addEventListener('input', () => {
        if (el.closest('.form-group').classList.contains('is-invalid')) validateField(f);
        updateSummary();
      });
      el.addEventListener('blur', () => { if (val(f) !== '') validateField(f); });
    });

    document.getElementById('onboardForm').addEventListener('submit', onSubmit);
    document.getElementById('resetBtn').addEventListener('click', resetForm);
    document.getElementById('againBtn').addEventListener('click', () => {
      resetForm();
      document.getElementById('successWrap').classList.add('hidden');
      document.getElementById('formColumn').classList.remove('hidden');
      document.querySelector('.onboard-rail').classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* default harvest date: today */
    const hd = document.getElementById('harvest_date');
    if (hd && !hd.value) hd.value = new Date().toISOString().slice(0, 10);

    updateSummary();
  });
})();
