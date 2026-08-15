const STORAGE_KEY = 'yunrong-quotation-v1';
const COMMON_ITEMS_KEY = 'yunrong-common-items-v1';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const state = { tax: false };

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' });
const money = value => `NT$ ${Math.round(Number(value) || 0).toLocaleString('zh-TW')}`;
const emptyItem = () => ({ name: '', qty: '', unit: '', price: '', amount: '', mode: 'auto' });

function getCommonItems() {
  try { return JSON.parse(localStorage.getItem(COMMON_ITEMS_KEY)) || []; } catch (_) { return []; }
}

function fillCommonSelect(select) {
  const current = select.value;
  select.innerHTML = '<option value="">常用品項快速帶入…</option>';
  getCommonItems().slice(0, 20).forEach(item => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = item.name;
    select.append(option);
  });
  select.value = current;
}

function rememberCurrentItems() {
  const catalog = getCommonItems();
  $$('#itemsBody tr').forEach(row => {
    const name = $('.item-name', row).value.trim();
    if (!name) return;
    const existing = catalog.find(item => item.name === name);
    const details = {
      name, unit: $('.item-unit', row).value,
      price: $('.item-price', row).value, amount: $('.item-amount', row).value,
      mode: $('.calc-mode', row).value,
      uses: (existing?.uses || 0) + 1, updatedAt: Date.now()
    };
    if (existing) Object.assign(existing, details); else catalog.push(details);
  });
  catalog.sort((a, b) => (b.uses - a.uses) || (b.updatedAt - a.updatedAt));
  localStorage.setItem(COMMON_ITEMS_KEY, JSON.stringify(catalog.slice(0, 50)));
  $$('.common-item').forEach(fillCommonSelect);
}

function renderCommonItems() {
  const list = $('#commonItemsList');
  const items = getCommonItems();
  list.innerHTML = '';
  if (!items.length) {
    list.innerHTML = '<div class="common-empty">目前還沒有常用品項</div>';
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'common-list-row';
    row.innerHTML = `<span></span><button type="button" aria-label="刪除品項">刪除</button>`;
    $('span', row).textContent = item.name;
    $('button', row).addEventListener('click', () => {
      if (!confirm(`確定要從常用品項刪除「${item.name}」嗎？`)) return;
      localStorage.setItem(COMMON_ITEMS_KEY, JSON.stringify(getCommonItems().filter(entry => entry.name !== item.name)));
      $$('.common-item').forEach(fillCommonSelect);
      renderCommonItems();
    });
    list.append(row);
  });
}

function addItem(data = emptyItem()) {
  const row = $('#itemTemplate').content.firstElementChild.cloneNode(true);
  $('.item-name', row).value = data.name || '';
  $('.item-qty', row).value = data.qty ?? '';
  $('.item-unit', row).value = data.unit || '';
  $('.item-price', row).value = data.price ?? '';
  $('.item-amount', row).value = data.amount ?? '';
  $('.calc-mode', row).value = data.mode || 'auto';
  fillCommonSelect($('.common-item', row));
  $('#itemsBody').append(row);
  applyMode(row);
  renumber();
}

function applyMode(row) {
  const direct = $('.calc-mode', row).value === 'direct';
  // 直接計價仍保留數量（例如 88.5 坪），只略過單價的乘算。
  $('.item-qty', row).disabled = false;
  $('.item-price', row).disabled = direct;
  $('.item-amount', row).disabled = !direct;
  if (!direct) calculateRow(row);
}

function calculateRow(row) {
  if ($('.calc-mode', row).value === 'auto') {
    const qty = Number($('.item-qty', row).value) || 0;
    const price = Number($('.item-price', row).value) || 0;
    $('.item-amount', row).value = qty && price ? Math.round(qty * price * 100) / 100 : '';
  }
  calculateTotals();
}

function calculateTotals() {
  const subtotal = $$('.item-amount').reduce((sum, el) => sum + (Number(el.value) || 0), 0);
  const tax = state.tax ? Math.round(subtotal * .05) : 0;
  $('#taxAmount').textContent = money(tax);
  $('#taxRow').style.display = state.tax ? 'flex' : 'none';
  $('#grandTotal').textContent = money(subtotal + tax);
  $('#taxLabel').textContent = state.tax ? '已稅' : '未稅';
}

function updateNotesState() {
  $('.bottom-grid').classList.toggle('notes-empty', !$('#notes').value.trim());
}

function renumber() { $$('#itemsBody tr').forEach((row, i) => $('.item-no', row).textContent = i + 1); }

function getData() {
  return {
    clientName: $('#clientName').value, clientAddress: $('#clientAddress').value,
    quoteDate: $('#quoteDate').value, notes: $('#notes').value,
    tax: state.tax,
    items: $$('#itemsBody tr').map(row => ({
      name: $('.item-name', row).value,
      qty: $('.item-qty', row).value, unit: $('.item-unit', row).value,
      price: $('.item-price', row).value, amount: $('.item-amount', row).value,
      mode: $('.calc-mode', row).value
    }))
  };
}

let saveTimer;
function save() {
  $('#saveState').innerHTML = '<i></i> 儲存中…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
    $('#saveState').innerHTML = '<i></i> 已自動儲存';
  }, 250);
}

function load() {
  let data;
  try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (_) {}
  $('#quoteDate').value = data?.quoteDate || today();
  $('#clientName').value = data?.clientName || '';
  $('#clientAddress').value = data?.clientAddress || '';
  $('#notes').value = data?.notes || '';
  state.tax = !!data?.tax;
  (data?.items?.length ? data.items : [emptyItem(), emptyItem(), emptyItem()]).forEach(addItem);
  calculateTotals();
  updateNotesState();
}

$('#addItemBtn').addEventListener('click', () => { addItem(); save(); });
$('#itemsBody').addEventListener('input', event => {
  const row = event.target.closest('tr');
  if (row) calculateRow(row);
  save();
});
$('#itemsBody').addEventListener('change', event => {
  const row = event.target.closest('tr');
  if (event.target.classList.contains('calc-mode')) applyMode(row);
  if (event.target.classList.contains('common-item') && event.target.value) {
    const item = getCommonItems().find(entry => entry.name === event.target.value);
    if (item) {
      $('.item-name', row).value = item.name;
      $('.item-unit', row).value = item.unit || '';
      $('.calc-mode', row).value = item.mode || 'auto';
      $('.item-price', row).value = item.price || '';
      $('.item-amount', row).value = item.mode === 'direct' ? (item.amount || '') : '';
      applyMode(row);
    }
  }
  save();
});
$('#itemsBody').addEventListener('click', event => {
  if (event.target.classList.contains('manage-common')) {
    renderCommonItems();
    $('#commonItemsDialog').showModal();
    return;
  }
  if (!event.target.classList.contains('remove-btn')) return;
  if ($$('#itemsBody tr').length === 1) {
    const row = event.target.closest('tr');
    $$('input, textarea', row).forEach(el => el.value = '');
    $('.calc-mode', row).value = 'auto'; applyMode(row);
  } else event.target.closest('tr').remove();
  renumber(); calculateTotals(); save();
});

['clientName','clientAddress','quoteDate','notes'].forEach(id => $(`#${id}`).addEventListener('input', () => {
  if (id === 'notes') updateNotesState();
  save();
}));
$('#exportBtn').addEventListener('click', () => $('#taxDialog').showModal());
$('#taxDialog').addEventListener('close', () => {
  if (!['taxed','untaxed'].includes($('#taxDialog').returnValue)) return;
  state.tax = $('#taxDialog').returnValue === 'taxed';
  calculateTotals();
  updateNotesState();
  rememberCurrentItems();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getData()));
  const client = $('#clientName').value.trim() || '客戶';
  document.title = `${client}_估價單_${$('#quoteDate').value || today()}`;
  setTimeout(() => window.print(), 120);
});
window.addEventListener('afterprint', () => { document.title = '允榮油漆工程行｜估價單'; });
$('.common-dialog-done').addEventListener('click', () => $('#commonItemsDialog').close());
$('.common-dialog-close').addEventListener('click', () => $('#commonItemsDialog').close());
$('#clearBtn').addEventListener('click', () => {
  if (!confirm('確定要清除所有已輸入的估價單內容嗎？此動作無法復原。')) return;
  localStorage.removeItem(STORAGE_KEY);
  $('#clientName').value = ''; $('#clientAddress').value = ''; $('#quoteDate').value = today();
  $('#notes').value = ''; state.tax = false;
  $('#itemsBody').innerHTML = ''; [1,2,3].forEach(() => addItem());
  calculateTotals(); updateNotesState(); save();
});

load();
