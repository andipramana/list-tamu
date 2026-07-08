// ---- Konfigurasi Supabase ----
// Ganti dua nilai di bawah dengan Project URL & anon public key dari dashboard Supabase kamu
// (Project Settings > API). Ini memang key publik, aman dipasang di client - keamanan diatur
// lewat Row Level Security policy di seed.sql, bukan lewat kerahasiaan key ini.
const SUPABASE_URL = 'https://rxqolwczphehbzrzmisa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cW9sd2N6cGhlaGJ6cnptaXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzE2MjQsImV4cCI6MjA5OTAwNzYyNH0.JJYxsEBDENo_zSME47wvDWtVsK_pzC_FoVBl7K6OT98';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allTamu = [];

const bodyList = document.getElementById('body-list');
const bodyDihapus = document.getElementById('body-dihapus');
const countList = document.getElementById('count-list');
const countDihapus = document.getElementById('count-dihapus');
const statTamu = document.getElementById('stat-tamu');
const statOrang = document.getElementById('stat-orang');
const groupSuggestions = document.getElementById('group-suggestions');
const fabTambah = document.getElementById('fab-tambah');

const MOVE_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l-4 4"/><path d="M12 3l4 4"/><path d="M12 21l-4-4"/><path d="M12 21l4-4"/><path d="M12 3v18"/></svg>';

// ---- Modal alert/confirm (pengganti alert()/confirm() bawaan browser) ----

const modalConfirm = document.getElementById('modal-confirm');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');

function showDialog(message, { okLabel = 'OK', showCancel = false, danger = false } = {}) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmOk.textContent = okLabel;
    confirmOk.classList.toggle('btn-danger', danger);
    confirmCancel.classList.toggle('hidden', !showCancel);
    modalConfirm.classList.remove('hidden');

    function cleanup(result) {
      modalConfirm.classList.add('hidden');
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }

    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
  });
}

function showAlert(message) {
  return showDialog(message, { okLabel: 'OK', showCancel: false });
}

function showConfirm(message, okLabel = 'Ya', danger = false) {
  return showDialog(message, { okLabel, showCancel: true, danger });
}

// ---- Fetch & render ----

async function fetchTamu() {
  const { data, error } = await supabaseClient
    .from('tamu')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    await showAlert('Gagal memuat data: ' + error.message);
    return;
  }
  allTamu = data;
  render();
}

function render() {
  const list = allTamu.filter(t => !t.is_deleted);
  const dihapus = allTamu.filter(t => t.is_deleted);

  countList.textContent = list.length;
  countDihapus.textContent = dihapus.length;

  const totalOrang = list.reduce((sum, t) => sum + (t.jumlah || 0), 0);
  statTamu.textContent = list.length;
  statOrang.textContent = totalOrang;

  renderGroupSuggestions(list);
  renderRows(bodyList, list, false);
  renderRows(bodyDihapus, dihapus, true);
}

function renderGroupSuggestions(list) {
  const groups = [...new Set(list.map(t => t.group_tamu).filter(Boolean))];
  groupSuggestions.innerHTML = groups.map(g => `<option value="${g.replace(/"/g, '&quot;')}"></option>`).join('');
}

// Kelompokkan baris berdasarkan group_tamu, urutan grup mengikuti group_order (bisa digeser manual).
// Baris tanpa group_tamu dikumpulkan terpisah dan dirender terakhir tanpa judul section.
function groupRows(rows) {
  const buckets = new Map();
  const noGroup = [];

  for (const t of rows) {
    const key = t.group_tamu && t.group_tamu.trim() ? t.group_tamu : null;
    if (key == null) {
      noGroup.push(t);
      continue;
    }
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(t);
  }

  const sortedGroups = [...buckets.entries()].sort((a, b) => {
    const orderA = a[1][0].group_order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b[1][0].group_order ?? Number.MAX_SAFE_INTEGER;
    return orderA - orderB;
  });

  return { sortedGroups, noGroup };
}

function renderRows(tbody, rows, isDihapus) {
  tbody.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = `<td colspan="3">${isDihapus ? 'Belum ada tamu yang dihapus' : 'Belum ada tamu'}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const { sortedGroups, noGroup } = groupRows(rows);

  sortedGroups.forEach(([groupName, groupItems], index) => {
    const headerTr = document.createElement('tr');
    headerTr.className = 'group-header';
    const headerTd = document.createElement('td');
    headerTd.colSpan = 3;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'group-name';
    nameSpan.textContent = groupName;
    headerTd.appendChild(nameSpan);

    if (!isDihapus) {
      nameSpan.classList.add('editable-group');
      nameSpan.addEventListener('click', () => startGroupEdit(nameSpan, groupName));

      const btnMove = document.createElement('button');
      btnMove.className = 'btn-move';
      btnMove.innerHTML = MOVE_ICON_SVG;
      btnMove.title = 'Pindah grup';
      btnMove.setAttribute('aria-label', 'Pindah grup');
      btnMove.addEventListener('click', (e) => {
        e.stopPropagation();
        openMoveModal(groupName);
      });
      headerTd.appendChild(btnMove);
    }

    headerTr.appendChild(headerTd);
    tbody.appendChild(headerTr);

    for (const t of groupItems) {
      tbody.appendChild(makeGuestRow(t, isDihapus));
    }
  });

  for (const t of noGroup) {
    tbody.appendChild(makeGuestRow(t, isDihapus));
  }
}

function makeGuestRow(t, isDihapus) {
  const tr = document.createElement('tr');

  tr.appendChild(makeEditableCell(t, 'nama', isDihapus));
  tr.appendChild(makeEditableCell(t, 'jumlah', isDihapus, 'number'));

  const actionTd = document.createElement('td');
  actionTd.className = 'action-cell';

  if (isDihapus) {
    const btnRestore = document.createElement('button');
    btnRestore.className = 'btn-pulihkan';
    btnRestore.textContent = 'Pulihkan';
    btnRestore.addEventListener('click', () => restoreTamu(t.id));
    actionTd.appendChild(btnRestore);

    const btnPermanent = document.createElement('button');
    btnPermanent.className = 'btn-hapus-permanen';
    btnPermanent.textContent = 'Hapus Permanen';
    btnPermanent.addEventListener('click', () => deletePermanent(t.id, t.nama));
    actionTd.appendChild(btnPermanent);
  } else {
    const btnHapus = document.createElement('button');
    btnHapus.className = 'btn-hapus';
    btnHapus.textContent = 'Hapus';
    btnHapus.addEventListener('click', () => deleteTamu(t.id, t.nama));
    actionTd.appendChild(btnHapus);
  }

  tr.appendChild(actionTd);
  return tr;
}

// ---- Modal pindah grup (pilih arah + grup acuan) ----

const modalMove = document.getElementById('modal-move');
const moveGroupLabel = document.getElementById('move-group-label');
const moveDirectionSelect = document.getElementById('move-direction');
const moveTargetSelect = document.getElementById('move-target');
let moveGroupContext = null;

function openMoveModal(groupName) {
  moveGroupContext = groupName;
  moveGroupLabel.textContent = groupName;

  const list = allTamu.filter(t => !t.is_deleted);
  const { sortedGroups } = groupRows(list);
  const otherGroups = sortedGroups.map(([name]) => name).filter(name => name !== groupName);

  moveTargetSelect.innerHTML = otherGroups
    .map(name => `<option value="${name.replace(/"/g, '&quot;')}">${name}</option>`)
    .join('');
  moveDirectionSelect.value = 'before';

  modalMove.classList.remove('hidden');
}

function closeMoveModal() {
  modalMove.classList.add('hidden');
  moveGroupContext = null;
}

document.getElementById('move-batal').addEventListener('click', closeMoveModal);
modalMove.addEventListener('click', (e) => {
  if (e.target === modalMove) closeMoveModal();
});

document.getElementById('move-submit').addEventListener('click', async () => {
  const direction = moveDirectionSelect.value;
  const target = moveTargetSelect.value;
  const groupName = moveGroupContext;
  if (!target) {
    closeMoveModal();
    return;
  }
  closeMoveModal();
  await moveGroupTo(groupName, direction, target);
});

async function moveGroupTo(groupName, direction, targetGroupName) {
  const list = allTamu.filter(t => !t.is_deleted);
  const { sortedGroups } = groupRows(list);

  const orderedNames = sortedGroups.map(([name]) => name);
  const fromIndex = orderedNames.indexOf(groupName);
  if (fromIndex === -1) return;
  orderedNames.splice(fromIndex, 1);

  const targetIndex = orderedNames.indexOf(targetGroupName);
  if (targetIndex === -1) return;
  const insertIndex = direction === 'before' ? targetIndex : targetIndex + 1;
  orderedNames.splice(insertIndex, 0, groupName);

  const results = await Promise.all(
    orderedNames.map((name, i) =>
      supabaseClient.from('tamu').update({ group_order: (i + 1) * 10 }).eq('group_tamu', name)
    )
  );

  const failed = results.find(r => r.error);
  if (failed) {
    await showAlert('Gagal memindahkan grup: ' + failed.error.message);
  }
}

function startGroupEdit(td, oldGroupName) {
  if (td.querySelector('input')) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = oldGroupName;

  td.textContent = '';
  td.appendChild(input);
  input.focus();
  input.select();

  const finish = async () => {
    const newValue = input.value.trim();
    if (!newValue || newValue === oldGroupName) {
      td.textContent = oldGroupName;
      return;
    }

    const { error } = await supabaseClient
      .from('tamu')
      .update({ group_tamu: newValue })
      .eq('group_tamu', oldGroupName);

    if (error) {
      await showAlert('Gagal mengubah nama grup: ' + error.message);
      td.textContent = oldGroupName;
      return;
    }

    td.textContent = newValue;
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') td.textContent = oldGroupName;
  });
}

function makeEditableCell(row, field, isDihapus, inputType) {
  const td = document.createElement('td');
  const value = row[field] == null ? '' : row[field];
  td.textContent = value;

  if (isDihapus) {
    return td;
  }

  td.className = 'editable';
  td.addEventListener('click', () => startEdit(td, row, field, inputType));
  return td;
}

function startEdit(td, row, field, inputType) {
  if (td.querySelector('input')) return;

  const currentValue = row[field] == null ? '' : row[field];
  const input = document.createElement('input');
  input.type = inputType === 'number' ? 'number' : 'text';
  input.value = currentValue;
  if (inputType === 'number') input.min = '1';

  td.textContent = '';
  td.appendChild(input);
  input.focus();
  input.select();

  const finish = () => saveEdit(td, row, field, input, inputType);
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      td.textContent = currentValue;
    }
  });
}

async function saveEdit(td, row, field, input, inputType) {
  let newValue = input.value.trim();
  if (inputType === 'number') {
    newValue = parseInt(newValue, 10) || 1;
  }

  const oldValue = row[field] == null ? '' : row[field];
  if (newValue === oldValue || (inputType !== 'number' && newValue === '' && oldValue === '')) {
    td.textContent = oldValue;
    return;
  }

  const { error } = await supabaseClient
    .from('tamu')
    .update({ [field]: inputType === 'number' ? newValue : (newValue || null) })
    .eq('id', row.id);

  if (error) {
    await showAlert('Gagal menyimpan perubahan: ' + error.message);
    td.textContent = oldValue;
    return;
  }

  row[field] = inputType === 'number' ? newValue : (newValue || null);
  td.textContent = row[field] == null ? '' : row[field];
}

// ---- Tambah tamu (FAB + modal) ----

const modalTambah = document.getElementById('modal-tambah');

function openModal() {
  modalTambah.classList.remove('hidden');
  document.getElementById('add-nama').focus();
}

function closeModal() {
  modalTambah.classList.add('hidden');
  document.getElementById('add-group').value = '';
  document.getElementById('add-nama').value = '';
  document.getElementById('add-jumlah').value = '1';
}

fabTambah.addEventListener('click', openModal);
document.getElementById('btn-batal').addEventListener('click', closeModal);
modalTambah.addEventListener('click', (e) => {
  if (e.target === modalTambah) closeModal();
});

document.getElementById('btn-tambah').addEventListener('click', addTamu);

async function addTamu() {
  const group = document.getElementById('add-group').value.trim();
  const nama = document.getElementById('add-nama').value.trim();
  const jumlah = parseInt(document.getElementById('add-jumlah').value, 10) || 1;

  if (!nama) {
    await showAlert('Nama tamu wajib diisi');
    return;
  }

  let groupOrder = null;
  if (group) {
    const existingMember = allTamu.find(t => t.group_tamu === group);
    if (existingMember) {
      groupOrder = existingMember.group_order;
    } else {
      const maxOrder = allTamu.reduce((max, t) => (t.group_order != null && t.group_order > max ? t.group_order : max), 0);
      groupOrder = maxOrder + 10;
    }
  }

  const { error } = await supabaseClient.from('tamu').insert({
    group_tamu: group || null,
    nama,
    jumlah,
    group_order: groupOrder,
  });

  if (error) {
    await showAlert('Gagal menambah tamu: ' + error.message);
    return;
  }

  closeModal();
}

// ---- Hapus & pulihkan ----

async function deleteTamu(id, nama) {
  const ok = await showConfirm(`Hapus "${nama}" dari list? Masih bisa dipulihkan dari tab Dihapus.`, 'Hapus');
  if (!ok) return;

  const { error } = await supabaseClient
    .from('tamu')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) await showAlert('Gagal menghapus: ' + error.message);
}

async function restoreTamu(id) {
  const { error } = await supabaseClient
    .from('tamu')
    .update({ is_deleted: false, deleted_at: null })
    .eq('id', id);

  if (error) await showAlert('Gagal memulihkan: ' + error.message);
}

async function deletePermanent(id, nama) {
  const ok = await showConfirm(`Hapus permanen "${nama}"? Data ini TIDAK BISA dikembalikan lagi.`, 'Hapus Permanen', true);
  if (!ok) return;

  const { error } = await supabaseClient
    .from('tamu')
    .delete()
    .eq('id', id);

  if (error) await showAlert('Gagal menghapus permanen: ' + error.message);
}

// ---- Tab switching ----

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    fabTambah.classList.toggle('hidden', btn.dataset.tab !== 'list');
  });
});

// ---- Realtime sync ----

supabaseClient
  .channel('tamu-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tamu' }, () => {
    fetchTamu();
  })
  .subscribe();

// ---- Init ----

fetchTamu();
