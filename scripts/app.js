if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.error('SW register failed', err);
    });
  });
}

// URL deployment aktif Apps Script (EXEC)
const APPS_SCRIPT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycby9PRznogJcmuzsJ7NaiSX4i4m--zW1CAiOMigPF0MTvj3ydWxNZEdkIx9YKAGXhwmK/exec';

document.addEventListener('DOMContentLoaded', () => {
  const navItems = Array.from(document.querySelectorAll('.nav-item'));
  const screens = Array.from(document.querySelectorAll('.screen'));
  const loginPill = document.querySelector('.login-pill');
  const primaryAction = document.querySelector('.primary-action');
  const fab = document.querySelector('.fab');

  function switchScreen(target) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.target === target);
    });

    screens.forEach(screen => {
      screen.classList.toggle('active', screen.dataset.screen === target);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => switchScreen(item.dataset.target));
  });

  if (loginPill) {
    loginPill.addEventListener('click', () => switchScreen('login'));
  }

  if (fab) {
    fab.addEventListener('click', () => switchScreen('login'));
  }

  if (primaryAction) {
    primaryAction.addEventListener('click', () => {
      const emailInput = document.getElementById('emailInput');
      const email = (emailInput?.value || '').trim();

      if (!email) {
        alert('Silakan isi email terlebih dahulu.');
        emailInput?.focus();
        return;
      }

      alert(
        'UI login sudah aktif, tetapi endpoint login di Apps Script belum disambungkan di frontend ini. Langkah berikutnya adalah menambahkan API login dan panel internal.'
      );
    });
  }

  loadPublicData();
});

async function loadPublicData() {
  try {
    setLoadingState();

    const data = await loadJsonp(`${APPS_SCRIPT_WEB_APP_URL}?api=public`);
    renderPublicData(data);
  } catch (err) {
    console.error('Public API load failed', err);
    renderLoadError(err);
  }
}

function loadJsonp(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const callbackName = `dkmJsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const script = document.createElement('script');
    const joiner = url.includes('?') ? '&' : '?';

    let timeoutHandle = null;
    let finished = false;

    function cleanup() {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      try {
        delete window[callbackName];
      } catch (_) {
        window[callbackName] = undefined;
      }

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    }

    window[callbackName] = payload => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('Gagal memuat JSONP Apps Script'));
    };

    timeoutHandle = setTimeout(() => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(new Error('Request Apps Script timeout'));
    }, timeoutMs);

    script.src = `${url}${joiner}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

function setLoadingState() {
  setText('saldoKasValue', 'Memuat...');
  setText('pemasukanValue', 'Memuat...');
  setText('pengeluaranValue', 'Memuat...');
  setText('saldoOperasionalValue', 'Memuat...');
  setText('saldoRamadhanValue', 'Memuat...');
  setText('balanceToneValue', 'Loading');

  setText('qurbanDanaTerkumpulValue', 'Memuat...');
  setText('qurbanProgressValue', '0%');
  setText('qurbanNeedValue', 'Mengambil data backend...');
  setText('qurbanSlotValue', 'Memuat data slot...');
  setProgress('qurbanProgressFill', 0, 'red');

  setText('eventTotalSapiValue', '0');
  setText('eventSlotTerisiValue', '0');
  setText('eventSisaSlotValue', '0');
  setText('eventDanaValue', 'Rp 0');

  const groupList = document.getElementById('groupList');
  if (groupList) {
    groupList.innerHTML =
      '<article class="group-card"><strong>Memuat data grup...</strong><div class="muted-line">Mohon tunggu sebentar.</div></article>';
  }
}

function renderLoadError(err) {
  setText('saldoKasValue', 'Gagal load');
  setText('balanceToneValue', 'Offline/Error');
  setText('qurbanNeedValue', 'Backend publik belum terbaca');
  setText('qurbanSlotValue', err?.message || 'Unknown error');

  const groupList = document.getElementById('groupList');
  if (groupList) {
    groupList.innerHTML =
      '<article class="group-card"><strong>Gagal memuat data</strong><div class="muted-line">Periksa Apps Script deployment, akses publik, dan format JSONP callback.</div></article>';
  }
}

function renderPublicData(data) {
  if (!data) {
    renderLoadError(new Error('Payload kosong dari backend'));
    return;
  }

  const summary = data.summary || {};
  const qurban = data.qurban || {};
  const seasonal = data.seasonal || {};
  const groups = Array.isArray(qurban.groups) ? qurban.groups : [];

  setText('saldoKasValue', formatCurrency(summary['Saldo Kas']));
  setText('pemasukanValue', formatCurrency(summary['Total Pemasukan']));
  setText('pengeluaranValue', formatCurrency(summary['Total Pengeluaran']));
  setText('saldoOperasionalValue', formatCurrency(summary['Saldo Operasional']));
  setText('saldoRamadhanValue', formatCurrency(summary['Saldo Ramadhan']));
  setText('balanceToneValue', getBalanceTone(summary['Saldo Kas']));

  setText('qurbanDanaTerkumpulValue', formatCurrency(qurban.totalNominal));
  setText('qurbanProgressValue', `${safeNumber(qurban.progressPct)}%`);
  setText(
    'qurbanNeedValue',
    safeNumber(qurban.remainingNominal) > 0
      ? `Masih butuh ${formatCurrency(qurban.remainingNominal)}`
      : 'Target qurban sudah tercapai'
  );
  setText(
    'qurbanSlotValue',
    `Slot terisi ${safeNumber(qurban.totalFilled)} dari ${safeNumber(qurban.totalSlots)}`
  );
  setProgress('qurbanProgressFill', safeNumber(qurban.progressPct), qurban.progressColor);

  setText('eventTotalSapiValue', safeNumber(qurban.totalGroups));
  setText('eventSlotTerisiValue', safeNumber(qurban.totalFilled));
  setText('eventSisaSlotValue', safeNumber(qurban.totalEmpty));
  setText('eventDanaValue', formatCurrency(qurban.totalNominal));

  renderGroupList(groups);
  renderHeroNotes(groups, seasonal);
}

function renderHeroNotes(groups, seasonal) {
  const topGroup = groups[0];

  if (topGroup) {
    setText('qurbanHighlightTitle', topGroup.groupName || 'Grup utama');
    setText(
      'qurbanHighlightText',
      `${safeNumber(topGroup.filledSlots)} dari ${safeNumber(topGroup.totalSlots)} slot terisi, progres pembayaran ${safeNumber(topGroup.paymentProgressPct)}%.`
    );
    setText('qurbanHighlightBadge', topGroup.status || 'Aktif');
  } else {
    setText('qurbanHighlightTitle', 'Grup utama belum tersedia');
    setText('qurbanHighlightText', 'Data grup qurban akan tampil otomatis dari backend publik.');
    setText('qurbanHighlightBadge', 'Musiman');
  }

  const heroEvent = String(seasonal.heroEvent || 'GENERAL').toUpperCase();

  if (heroEvent === 'QURBAN') {
    setText('seasonalHeroTitle', 'Qurban menjadi fokus utama');
    setText('seasonalHeroText', 'Layar publik otomatis menonjolkan kebutuhan qurban saat musimnya aktif.');
  } else if (heroEvent === 'RAMADHAN') {
    setText('seasonalHeroTitle', 'Ramadhan menjadi fokus utama');
    setText('seasonalHeroText', 'Nantinya layar publik akan memprioritaskan progres kegiatan Ramadhan.');
  } else {
    setText('seasonalHeroTitle', 'Kas umum tetap mudah dipantau');
    setText('seasonalHeroText', 'Di luar musim event utama, warga langsung melihat kondisi kas dan ringkasan penting.');
  }
}

function renderGroupList(groups) {
  const container = document.getElementById('groupList');
  if (!container) return;

  container.innerHTML = '';

  if (!groups.length) {
    container.innerHTML =
      '<article class="group-card"><strong>Belum ada data grup</strong><div class="muted-line">Data qurban akan tampil setelah backend publik terbaca.</div></article>';
    return;
  }

  groups.forEach(group => {
    const progressClass = mapProgressClass(group.paymentProgressColor);
    const fillColor = group.fillPct >= 90 ? 'green' : group.fillPct >= 60 ? 'yellow' : 'red';

    const card = document.createElement('article');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-head">
        <strong>${escapeHtml(group.groupName || '-')}</strong>
        <span>${safeNumber(group.filledSlots)}/${safeNumber(group.totalSlots)} peserta</span>
      </div>

      <div class="line-item">
        <span>Keterisian</span>
        <span>${safeNumber(group.fillPct)}%</span>
      </div>
      <div class="progress-rail thin">
        <div class="progress-fill ${mapProgressClass(fillColor)}" style="width:${safeNumber(group.fillPct)}%"></div>
      </div>

      <div class="line-item muted-line">
        <span>Pembayaran</span>
        <span>${safeNumber(group.paymentProgressPct)}%</span>
      </div>
      <div class="progress-rail thin">
        <div class="progress-fill ${progressClass}" style="width:${safeNumber(group.paymentProgressPct)}%"></div>
      </div>
    `;

    container.appendChild(card);
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function setProgress(id, pct, color) {
  const el = document.getElementById(id);
  if (!el) return;

  el.style.width = `${safeNumber(pct)}%`;
  el.className = `progress-fill ${mapProgressClass(color)}`;
}

function mapProgressClass(color) {
  const normalized = String(color || '').toLowerCase();

  if (normalized === 'green') return 'fill-good';
  if (normalized === 'yellow') return 'fill-warn';
  return 'fill-low';
}

function getBalanceTone(value) {
  return safeNumber(value) > 0 ? 'Stabil' : 'Awal';
}

function safeNumber(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
}

function formatCurrency(value) {
  return `Rp ${safeNumber(value).toLocaleString('id-ID')}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}