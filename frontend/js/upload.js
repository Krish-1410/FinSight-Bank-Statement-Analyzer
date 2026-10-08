/**
 * FinSight Bank Statement Upload & Management Logic
 * Supports scoped single-statement analysis, instant statement deletion without blocked dialogs,
 * clearing old statements, and automatic redirection to active file analysis.
 */

import { api } from './api.js';
import { formatCurrency, formatDate, showToast, setupAppShell } from './common.js';

let selectedFile = null;

document.addEventListener('DOMContentLoaded', async () => {
  await setupAppShell();
  setupDropZone();
  setupSampleActions();
  setupClearAllAction();
  setupTableEventDelegation();
  await loadUploadedStatements();
});

function setupDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('csv-file-input');
  const btnBrowse = document.getElementById('btn-browse-file');
  const filePreview = document.getElementById('file-preview-card');
  const btnUpload = document.getElementById('btn-analyze-upload');

  if (!dropZone || !fileInput) return;

  btnBrowse?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', (e) => {
    // Only trigger if not clicking a child button
    if (e.target !== btnBrowse && !btnBrowse?.contains(e.target)) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Drag and drop events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-[#0F5B41]', 'bg-emerald-50/40');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-[#0F5B41]', 'bg-emerald-50/40');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files[0]) {
      handleFileSelected(dt.files[0]);
    }
  });

  // Analyze button click
  if (btnUpload) {
    btnUpload.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!selectedFile) {
        showToast('Please select a CSV file first.', 'error');
        return;
      }
      await uploadFile(selectedFile);
    });
  }

  // Remove selected file
  const btnRemove = document.getElementById('btn-remove-selected');
  if (btnRemove) {
    btnRemove.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectedFile = null;
      fileInput.value = '';
      if (filePreview) filePreview.classList.add('hidden');
      if (btnUpload) {
        btnUpload.disabled = true;
        btnUpload.classList.add('opacity-50', 'cursor-not-allowed');
      }
    });
  }
}

function handleFileSelected(file) {
  if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'application/vnd.ms-excel') {
    showToast('Please upload a standard .csv bank statement file.', 'error');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast('File size exceeds the 10MB limit.', 'error');
    return;
  }

  selectedFile = file;

  const filePreview = document.getElementById('file-preview-card');
  const fileNameEl = document.getElementById('selected-file-name');
  const fileSizeEl = document.getElementById('selected-file-size');
  const btnUpload = document.getElementById('btn-analyze-upload');

  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = formatBytes(file.size);
  if (filePreview) filePreview.classList.remove('hidden');
  if (btnUpload) {
    btnUpload.disabled = false;
    btnUpload.classList.remove('opacity-50', 'cursor-not-allowed');
  }
}

async function uploadFile(file) {
  const btnUpload = document.getElementById('btn-analyze-upload');
  const uploadProgress = document.getElementById('upload-progress-container');
  const resultCard = document.getElementById('analysis-result-card');
  const clearPreviousCheck = document.getElementById('check-clear-previous');
  const clearPrevious = clearPreviousCheck ? clearPreviousCheck.checked : true;

  if (btnUpload) {
    btnUpload.disabled = true;
    btnUpload.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      Analyzing Transactions...
    `;
  }

  if (uploadProgress) uploadProgress.classList.remove('hidden');

  try {
    const res = await api.statements.upload(file, clearPrevious);
    showToast('Bank statement processed and analyzed successfully!', 'success');

    // Display result summary card
    if (resultCard && res.data) {
      renderUploadResult(res.data);
      resultCard.classList.remove('hidden');
      resultCard.scrollIntoView({ behavior: 'smooth' });
    }

    // Refresh history table
    await loadUploadedStatements();
  } catch (err) {
    console.error('Statement upload error:', err);
    showToast(err.message || 'Failed to process CSV file.', 'error');
  } finally {
    if (btnUpload) {
      btnUpload.disabled = false;
      btnUpload.innerHTML = 'Analyze Transactions';
    }
    if (uploadProgress) uploadProgress.classList.add('hidden');
  }
}

function renderUploadResult(data) {
  const { statement, summary } = data;
  const countEl = document.getElementById('result-tx-count');
  const dateRangeEl = document.getElementById('result-date-range');
  const incomeEl = document.getElementById('result-total-income');
  const spendEl = document.getElementById('result-total-spend');
  const netEl = document.getElementById('result-net-flow');

  if (countEl) countEl.textContent = (statement.transactionCount || 0).toLocaleString();
  if (dateRangeEl) dateRangeEl.textContent = `${formatDate(statement.dateFrom)} to ${formatDate(statement.dateTo)}`;
  if (incomeEl) incomeEl.textContent = formatCurrency(summary.totalIncome);
  if (spendEl) spendEl.textContent = formatCurrency(summary.totalSpending);
  if (netEl) {
    netEl.textContent = (summary.netCashFlow >= 0 ? '+' : '') + formatCurrency(summary.netCashFlow);
    netEl.className = summary.netCashFlow >= 0 ? 'text-base font-extrabold text-emerald-700 mt-0.5 tabular-nums' : 'text-base font-extrabold text-rose-600 mt-0.5 tabular-nums';
  }

  // Set destination URL to focus exclusively on this uploaded statement
  const openDashBtn = document.querySelector('#analysis-result-card a[href*="dashboard"]');
  if (openDashBtn && statement?.id) {
    openDashBtn.href = `/dashboard.html?statementId=${statement.id}`;
  }
}

async function loadUploadedStatements() {
  const tbody = document.getElementById('statements-history-tbody');
  if (!tbody) return;

  try {
    const res = await api.statements.getAll();
    const statements = res.data?.statements || [];

    if (statements.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-8 text-center text-xs text-slate-400">
            No bank statements in history. Upload a new CSV statement to analyze.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = statements.map((s, idx) => {
      const isLatest = idx === 0;
      return `
        <tr class="hover:bg-slate-50/80 border-b border-slate-100 transition-colors" id="stmt-row-${s.id}">
          <td class="py-3 px-4">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-bold text-slate-900">${s.original_filename}</span>
              ${isLatest ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-[#0F5B41] border border-emerald-200">Active / Analyzed</span>' : ''}
            </div>
            <div class="text-[11px] text-slate-400 mt-0.5">${formatBytes(s.file_size)}</div>
          </td>
          <td class="py-3 px-4 text-xs font-semibold text-slate-700 tabular-nums">${(s.transaction_count || 0).toLocaleString()} transactions</td>
          <td class="py-3 px-4 text-xs text-slate-500 tabular-nums">${formatDate(s.date_from)} – ${formatDate(s.date_to)}</td>
          <td class="py-3 px-4 text-xs text-slate-400 tabular-nums">${formatDate(s.uploaded_at)}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap space-x-2">
            <button
              type="button"
              data-id="${s.id}"
              data-name="${s.original_filename}"
              class="btn-delete-statement inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-xs text-rose-700 font-bold border border-rose-200 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Delete this statement and remove from calculations"
            >
              <svg class="w-3.5 h-3.5 text-rose-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span class="pointer-events-none">Delete</span>
            </button>
            <a
              href="/dashboard.html?statementId=${s.id}"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[#0F5B41] font-bold text-xs border border-emerald-200 shadow-2xs transition-all"
              title="View analysis scoped strictly to this statement"
            >
              <span>Analyze File →</span>
            </a>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Failed to load statement history:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-xs text-rose-500">Failed to load statement history. Refresh to try again.</td></tr>`;
  }
}

/**
 * Robust event delegation on tbody: handles clicks reliably even if DOM is modified!
 * Avoids window.confirm because AI Studio iframe suppresses standard modal dialogs!
 */
function setupTableEventDelegation() {
  const tbody = document.getElementById('statements-history-tbody');
  if (!tbody) return;

  tbody.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete-statement');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.dataset.id;
    const name = btn.dataset.name || 'Statement';
    if (!id) return;

    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin w-3.5 h-3.5 text-rose-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Deleting...</span>
    `;

    try {
      await api.statements.delete(id);
      showToast(`Deleted ${name} and removed from calculations.`, 'success');
      await loadUploadedStatements();
    } catch (err) {
      console.error('Delete statement error:', err);
      showToast(err.message || 'Failed to delete statement.', 'error');
      btn.disabled = false;
      btn.innerHTML = `
        <svg class="w-3.5 h-3.5 text-rose-600 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span class="pointer-events-none">Delete</span>
      `;
    }
  });
}

function setupClearAllAction() {
  const btnClearAll = document.getElementById('btn-clear-all-statements');
  if (!btnClearAll) return;

  btnClearAll.addEventListener('click', async (e) => {
    e.preventDefault();
    btnClearAll.disabled = true;
    btnClearAll.innerHTML = `
      <svg class="animate-spin w-3.5 h-3.5 text-rose-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
      <span>Clearing all statements...</span>
    `;

    try {
      await api.statements.clearAll();
      showToast('All previous statements and transactions cleared successfully.', 'success');
      await loadUploadedStatements();
    } catch (err) {
      console.error('Clear all error:', err);
      showToast(err.message || 'Failed to clear statements.', 'error');
    } finally {
      btnClearAll.disabled = false;
      btnClearAll.innerHTML = `
        <svg class="w-3.5 h-3.5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <span>Clear All Old Statements</span>
      `;
    }
  });
}

function setupSampleActions() {
  const btnDemo = document.getElementById('btn-upload-demo');
  if (btnDemo) {
    btnDemo.addEventListener('click', async (e) => {
      e.preventDefault();
      btnDemo.disabled = true;
      btnDemo.innerHTML = 'Importing demo statement...';
      try {
        await api.statements.loadDemo(true); // clear previous so demo is not mixed with uploads
        showToast('Sample Indian bank statement imported successfully!', 'success');
        await loadUploadedStatements();
        window.location.href = '/dashboard.html';
      } catch (err) {
        showToast(err.message || 'Failed to load demo statement.', 'error');
      } finally {
        btnDemo.disabled = false;
        btnDemo.innerHTML = 'Import Sample Bank Statement';
      }
    });
  }
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
