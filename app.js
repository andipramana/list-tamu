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
const summary = document.getElementById('summary');

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
  summary.textContent = `${list.length} baris tamu - ${totalOrang} orang`;

  renderRows(bodyList, list, false);
  renderRows(bodyDihapus, dihapus, true);
}

function renderRows(tbody, rows, isDihapus) {
  tbody.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    tr.className = 'empty-row';
    tr.innerHTML = `<td colspan="5">${isDihapus ? 'Belum ada tamu yang dihapus' : 'Belum ada tamu'}</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const t of rows) {
    const tr = document.createElement('tr');

    tr.appendChild(makeEditableCell(t, 'group_tamu', isDihapus));
    tr.appendChild(makeEditableCell(t, 'nama', isDihapus));
    tr.appendChild(makeEditableCell(t, 'kategori', isDihapus));
    tr.appendChild(makeEditableCell(t, 'jumlah', isDihapus, 'number'));

    const actionTd = document.createElement('td');
    const btn = document.createElement('button');
    if (isDihapus) {
      btn.className = 'btn-pulihkan';
      btn.textContent = 'Pulihkan';
      btn.addEventListener('click', () => restoreTamu(t.id));
    } else {
      btn.className = 'btn-hapus';
      btn.textContent = 'Hapus';
      btn.addEventListener('click', () => deleteTamu(t.id, t.nama));
    }
    actionTd.appendChild(btn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  }
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
    alert('Gagal menyimpan perubahan: ' + error.message);
    td.textContent = oldValue;
    return;
  }

  row[field] = inputType === 'number' ? newValue : (newValue || null);
  td.textContent = row[field] == null ? '' : row[field];
}

// ---- Tambah tamu ----

document.getElementById('btn-tambah').addEventListener('click', addTamu);

async function addTamu() {
  const group = document.getElementById('add-group').value.trim();
  const nama = document.getElementById('add-nama').value.trim();
  const kategori = document.getElementById('add-kategori').value.trim();
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

  document.getElementById('add-group').value = '';
  document.getElementById('add-nama').value = '';
  document.getElementById('add-kategori').value = '';
  document.getElementById('add-jumlah').value = '1';
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

// ---- Tab switching ----

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
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
