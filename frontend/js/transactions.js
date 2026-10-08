/**
 * FinSight Transactions Explorer Logic
 * Full CRUD, Indian Rupee (₹) formatting, category filters, and pagination.
 */

import { api } from './api.js';
import { formatCurrency, formatDate, showToast, setupAppShell } from './common.js';

let currentPage = 1;
let currentLimit = 15;
let currentSort = 'date_desc';
let currentFormTxType = 'expense';

document.addEventListener('DOMContentLoaded', async () => {
  await setupAppShell();
  parseUrlParams();
  setupFilterControls();
  setupAddTransactionModal();
  setupResetDemoButton();
  await loadTransactions();
});

function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const categoryParam = params.get('category');
  if (categoryParam) {
    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) categorySelect.value = categoryParam;
  }
}

function setupFilterControls() {
  const searchInput = document.getElementById('search-input');
  const categorySelect = document.getElementById('filter-category');
  const typeSelect = document.getElementById('filter-type');
  const sortSelect = document.getElementById('sort-select');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  let searchTimeout = null;
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        loadTransactions();
      }, 300);
    });
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      currentPage = 1;
      loadTransactions();
    });
  }

  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      currentPage = 1;
      loadTransactions();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentSort = e.target.value;
      currentPage = 1;
      loadTransactions();
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadTransactions();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentPage++;
      loadTransactions();
    });
  }

  const btnExport = document.getElementById('btn-export-csv');
  if (btnExport) {
    btnExport.addEventListener('click', () => {
      window.location.href = '/api/reports/export/csv';
    });
  }
}

function setupResetDemoButton() {
  const btnReset = document.getElementById('btn-reset-demo');
  if (!btnReset) return;

  btnReset.addEventListener('click', async () => {
    btnReset.disabled = true;
    btnReset.innerHTML = 'Resetting to Indian Sample Data...';

    try {
      await api.transactions.resetDemo();
      showToast('16 Indian Banking transactions (₹) loaded!', 'success');
      currentPage = 1;
      await loadTransactions();
    } catch (err) {
      console.error('Reset error:', err);
      showToast('Failed to reset demo data.', 'error');
    } finally {
      btnReset.disabled = false;
      btnReset.innerHTML = `
        <svg class="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Reset to Indian Sample Data (₹)</span>
      `;
    }
  });
}

function setupAddTransactionModal() {
  const modal = document.getElementById('modal-add-transaction');
  const btnOpen = document.getElementById('btn-open-add-tx');
  const btnClose = document.getElementById('modal-add-tx-close');
  const btnCancel = document.getElementById('modal-add-tx-cancel');
  const form = document.getElementById('form-add-tx');
  const typeExpenseBtn = document.getElementById('form-tx-type-expense');
  const typeIncomeBtn = document.getElementById('form-tx-type-income');
  const dateInput = document.getElementById('form-tx-date');

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().substring(0, 10);
      }
      if (modal) modal.classList.remove('hidden');
    });
  }

  const closeModal = () => {
    if (modal) modal.classList.add('hidden');
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (typeExpenseBtn && typeIncomeBtn) {
    typeExpenseBtn.addEventListener('click', () => {
      currentFormTxType = 'expense';
      typeExpenseBtn.className = 'flex-1 py-2 rounded-xl bg-white text-slate-900 shadow-xs cursor-pointer text-center font-bold';
      typeIncomeBtn.className = 'flex-1 py-2 rounded-xl text-slate-500 hover:text-slate-900 cursor-pointer text-center font-medium';
    });

    typeIncomeBtn.addEventListener('click', () => {
      currentFormTxType = 'income';
      typeIncomeBtn.className = 'flex-1 py-2 rounded-xl bg-white text-emerald-800 shadow-xs cursor-pointer text-center font-bold';
      typeExpenseBtn.className = 'flex-1 py-2 rounded-xl text-slate-500 hover:text-slate-900 cursor-pointer text-center font-medium';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amountVal = parseFloat(document.getElementById('form-tx-amount')?.value || '0');
      const merchantVal = document.getElementById('form-tx-merchant')?.value || '';
      const dateVal = document.getElementById('form-tx-date')?.value || new Date().toISOString().substring(0, 10);
      const categoryVal = document.getElementById('form-tx-category')?.value || 'Other';
      const descVal = document.getElementById('form-tx-description')?.value || merchantVal;

      if (!amountVal || amountVal <= 0) {
        showToast('Please enter a valid amount in ₹', 'error');
        return;
      }

      const submitBtn = document.getElementById('modal-add-tx-submit');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }

      try {
        await api.transactions.create({
          amount: amountVal,
          merchant: merchantVal,
          description: descVal,
          transaction_date: dateVal,
          transaction_type: currentFormTxType,
          category: categoryVal,
        });

        showToast(`Transaction of ${formatCurrency(amountVal)} recorded!`, 'success');
        closeModal();
        form.reset();
        await loadTransactions();
      } catch (err) {
        console.error('Failed to create transaction:', err);
        showToast(err.message || 'Failed to record transaction.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save Transaction';
        }
      }
    });
  }
}

async function loadTransactions() {
  const search = document.getElementById('search-input')?.value || '';
  const category = document.getElementById('filter-category')?.value || 'All';
  const type = document.getElementById('filter-type')?.value || '';

  const params = {
    page: currentPage,
    limit: currentLimit,
    sort: currentSort,
  };

  if (search) params.search = search;
  if (category && category !== 'All') params.category = category;
  if (type) params.type = type;

  const urlParams = new URLSearchParams(window.location.search);
  const statementId = urlParams.get('statementId');
  if (statementId) {
    params.statementId = statementId;
  }

  try {
    const res = await api.transactions.getAll(params);
    const { transactions, pagination } = res.data;

    renderTable(transactions);
    updatePagination(pagination);
  } catch (err) {
    console.error('Failed to load transactions:', err);
    showToast('Failed to load transactions list.', 'error');
  }
}

function renderTable(transactions) {
  const tbody = document.getElementById('transactions-tbody');
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center text-slate-400">
          <p class="text-sm font-bold text-slate-700 mb-1">No transactions found</p>
          <p class="text-xs text-slate-500">Try adjusting your filters or click "+ Add Transaction" to create one.</p>
        </td>
      </tr>
    `;
    return;
  }

  const merchantColors = [
    { bg: 'bg-emerald-100 text-emerald-800' },
    { bg: 'bg-blue-100 text-blue-700' },
    { bg: 'bg-amber-100 text-amber-800' },
    { bg: 'bg-purple-100 text-purple-700' },
    { bg: 'bg-rose-100 text-rose-700' },
  ];

  tbody.innerHTML = transactions.map((tx, idx) => {
    const color = merchantColors[idx % merchantColors.length];
    const initial = (tx.merchant || 'M').charAt(0).toUpperCase();
    const amountVal = Number(tx.amount) || 0;
    const isIncome = tx.transaction_type === 'income';
    const sign = isIncome ? '+' : '-';
    const formattedAmount = `${sign}${formatCurrency(amountVal)}`;

    return `
      <tr class="hover:bg-slate-50/80 transition-colors">
        <td class="py-3 px-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full ${color.bg} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              ${initial}
            </div>
            <div>
              <div class="font-bold text-xs text-slate-900">${tx.merchant}</div>
              <div class="text-[10px] text-slate-400 truncate max-w-xs">${tx.description}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
          ${formatDate(tx.transaction_date)}
        </td>
        <td class="py-3 px-3 text-xs">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
            ${tx.category}
          </span>
        </td>
        <td class="py-3 px-3 text-xs">
          <div class="inline-flex items-center gap-1.5 ${isIncome ? 'text-emerald-700' : 'text-slate-700'} font-medium">
            <span class="w-1.5 h-1.5 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
            <span>${isIncome ? 'Settled Credit' : 'Processed'}</span>
          </div>
        </td>
        <td class="py-3 px-3 text-right text-xs font-bold ${isIncome ? 'text-emerald-700' : 'text-slate-900'} tabular-nums whitespace-nowrap">
          ${formattedAmount}
        </td>
        <td class="py-3 px-3 text-right text-xs">
          <button
            data-id="${tx.id}"
            class="btn-delete-tx text-slate-400 hover:text-rose-600 transition-colors p-1 cursor-pointer rounded-lg hover:bg-rose-50"
            title="Delete this transaction"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach delete handlers (No window.confirm in iframe)
  tbody.querySelectorAll('.btn-delete-tx').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (!id) return;
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await api.transactions.delete(id);
        showToast('Transaction deleted.', 'success');
        await loadTransactions();
      } catch (err) {
        console.error('Delete error:', err);
        showToast('Failed to delete transaction.', 'error');
        btn.disabled = false;
        btn.innerHTML = `
          <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        `;
      }
    });
  });
}

function updatePagination(pagination) {
  const countEl = document.getElementById('pagination-count-label');
  const pageLabel = document.getElementById('pagination-page-label');
  const btnPrev = document.getElementById('btn-prev-page');
  const btnNext = document.getElementById('btn-next-page');

  if (countEl) {
    countEl.textContent = `Showing ${(pagination.currentPage - 1) * pagination.limit + (pagination.totalCount > 0 ? 1 : 0)} - ${Math.min(pagination.currentPage * pagination.limit, pagination.totalCount)} of ${pagination.totalCount} transactions`;
  }

  if (pageLabel) {
    pageLabel.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages || 1}`;
  }

  if (btnPrev) {
    btnPrev.disabled = pagination.currentPage <= 1;
  }

  if (btnNext) {
    btnNext.disabled = pagination.currentPage >= pagination.totalPages;
  }
}
