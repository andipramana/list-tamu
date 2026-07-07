// ---- Konfigurasi Supabase ----
// Ganti dua nilai di bawah dengan Project URL & anon public key dari dashboard Supabase kamu
// (Project Settings > API). Ini memang key publik, aman dipasang di client - keamanan diatur
// lewat Row Level Security policy di seed.sql, bukan lewat kerahasiaan key ini.
const SUPABASE_URL = 'https://rxqolwczphehbzrzmisa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4cW9sd2N6cGhlaGJ6cnptaXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MzE2MjQsImV4cCI6MjA5OTAwNzYyNH0.JJYxsEBDENo_zSME47wvDWtVsK_pzC_FoVBl7K6OT98';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const KATEGORI_OPTIONS = [
  'Keluarga Inti',
  'Keluarga Ema Cucun',
  'Keluarga Nini',
  'Teman Iyow',
  'Teman Mamah Bapa',
  'Lainnya',
];

let allTamu = [];

const bodyList = document.getElementById('body-list');
const bodyDihapus = document.getElementById('body-dihapus');
const countList = document.getElementById('count-list');
const countDihapus = document.getElementById('count-dihapus');
const statTamu = document.getElementById('stat-tamu');
const statOrang = document.getElementById('stat-orang');
const groupSuggestions = document.getElementById('group-suggestions');
const fabTambah = document.getElementById('fab-tambah');

// ---- Fetch & render ----

async function fetchTamu() {
  const { data, error } = await supabaseClient
    .from('tamu')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    alert('Gagal memuat data: ' + error.message);
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

// Kelompokkan baris berdasarkan group_tamu, urutan bucket = urutan kemunculan pertama.
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

  return { buckets, noGroup };
}

function renderRows(tbody, rows, isDihapus) {
  tbody.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = `<td colspan="4">${isDihapus ? 'Belum ada tamu yang dihapus' : 'Belum ada tamu'}</td>`;
    tbody.appendChild(tr);
    return;
  }

  const { buckets, noGroup } = groupRows(rows);

  for (const [groupName, groupItems] of buckets) {
    const headerTr = document.createElement('tr');
    headerTr.className = 'group-header';
    const headerTd = document.createElement('td');
    headerTd.colSpan = 4;
    headerTd.textContent = groupName;
    if (!isDihapus) {
      headerTd.classList.add('editable-group');
      headerTd.addEventListener('click', () => startGroupEdit(headerTd, groupName));
    }
    headerTr.appendChild(headerTd);
    tbody.appendChild(headerTr);

    for (const t of groupItems) {
      tbody.appendChild(makeGuestRow(t, isDihapus));
    }
  }

  for (const t of noGroup) {
    tbody.appendChild(makeGuestRow(t, isDihapus));
  }
}

function makeGuestRow(t, isDihapus) {
  const tr = document.createElement('tr');

  tr.appendChild(makeEditableCell(t, 'nama', isDihapus));
  tr.appendChild(makeEditableCell(t, 'kategori', isDihapus, 'select'));
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
      alert('Gagal mengubah nama grup: ' + error.message);
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
  if (td.querySelector('input, select')) return;

  const currentValue = row[field] == null ? '' : row[field];
  let input;

  if (inputType === 'select') {
    input = document.createElement('select');
    for (const opt of KATEGORI_OPTIONS) {
      const optionEl = document.createElement('option');
      optionEl.value = opt;
      optionEl.textContent = opt;
      if (opt === currentValue) optionEl.selected = true;
      input.appendChild(optionEl);
    }
  } else {
    input = document.createElement('input');
    input.type = inputType === 'number' ? 'number' : 'text';
    input.value = currentValue;
    if (inputType === 'number') input.min = '1';
  }

  td.textContent = '';
  td.appendChild(input);
  input.focus();
  if (inputType !== 'select') input.select();

  const finish = () => saveEdit(td, row, field, input, inputType);
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      td.textContent = currentValue;
    }
  });
  if (inputType === 'select') {
    input.addEventListener('change', finish);
  }
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
    alert('Gagal menyimpan perubahan: ' + error.message);
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
  document.getElementById('add-kategori').value = '';
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
  const kategori = document.getElementById('add-kategori').value;
  const jumlah = parseInt(document.getElementById('add-jumlah').value, 10) || 1;

  if (!nama) {
    alert('Nama tamu wajib diisi');
    return;
  }

  const { error } = await supabaseClient.from('tamu').insert({
    group_tamu: group || null,
    nama,
    kategori: kategori || null,
    jumlah,
  });

  if (error) {
    alert('Gagal menambah tamu: ' + error.message);
    return;
  }

  closeModal();
}

// ---- Hapus & pulihkan ----

async function deleteTamu(id, nama) {
  if (!confirm(`Hapus "${nama}" dari list? Masih bisa dipulihkan dari tab Dihapus.`)) return;

  const { error } = await supabaseClient
    .from('tamu')
    .update({ is_deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) alert('Gagal menghapus: ' + error.message);
}

async function restoreTamu(id) {
  const { error } = await supabaseClient
    .from('tamu')
    .update({ is_deleted: false, deleted_at: null })
    .eq('id', id);

  if (error) alert('Gagal memulihkan: ' + error.message);
}

async function deletePermanent(id, nama) {
  if (!confirm(`Hapus permanen "${nama}"? Data ini TIDAK BISA dikembalikan lagi.`)) return;

  const { error } = await supabaseClient
    .from('tamu')
    .delete()
    .eq('id', id);

  if (error) alert('Gagal menghapus permanen: ' + error.message);
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
