/**
 * FinSight Insights & Recurring Payments Logic
 */

import { api } from './api.js';
import { formatCurrency, formatDate, showToast, setupAppShell } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
  await setupAppShell();
  await loadInsightsData();
});

async function loadInsightsData() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const statementId = urlParams.get('statementId') || undefined;
    const reqParam = statementId ? { statementId } : {};

    const [insightsRes, recurringRes, categoriesRes] = await Promise.all([
      api.insights.getAll(reqParam),
      api.insights.getRecurring(reqParam),
      api.dashboard.getCategories(reqParam),
    ]);

    const insights = insightsRes.data?.insights || [];
    const recurring = recurringRes.data?.recurringPayments || [];
    const totalRecurringMonthly = recurringRes.data?.totalMonthlyCost || 0;
    const categories = categoriesRes.data?.categories || [];

    renderInsightsList(insights);
    renderRecurringPayments(recurring, totalRecurringMonthly);
    renderCategoryBreakdownList(categories);
  } catch (err) {
    console.error('Failed to load insights:', err);
    showToast('Failed to load financial insights.', 'error');
  }
}

function renderInsightsList(insights) {
  const container = document.getElementById('insights-cards-container');
  if (!container) return;

  if (insights.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Upload bank statements to discover spending patterns and insights.</div>';
    return;
  }

  container.innerHTML = insights.map((text, i) => `
    <div class="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-soft flex items-start gap-4">
      <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div>
        <h4 class="text-xs font-semibold text-slate-900 mb-1">Key Observation</h4>
        <p class="text-xs text-slate-600 leading-relaxed">${text}</p>
      </div>
    </div>
  `).join('');
}

function renderRecurringPayments(recurring, totalMonthly) {
  const tbody = document.getElementById('recurring-payments-tbody');
  const totalEl = document.getElementById('recurring-total-monthly');
  const countEl = document.getElementById('recurring-count-badge');

  if (totalEl) totalEl.textContent = formatCurrency(totalMonthly);
  if (countEl) countEl.textContent = `${recurring.length} identified`;

  if (!tbody) return;

  if (recurring.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-xs text-slate-400">No repeating payment patterns detected yet.</td></tr>';
    return;
  }

  tbody.innerHTML = recurring.map(item => `
    <tr class="hover:bg-slate-50/70 border-b border-slate-100 transition-colors">
      <td class="py-3.5 px-4">
        <div class="text-xs font-semibold text-slate-900">${item.merchant}</div>
        <div class="text-[11px] text-emerald-700 font-medium">Likely recurring</div>
      </td>
      <td class="py-3.5 px-4 text-xs text-slate-600">${item.category}</td>
      <td class="py-3.5 px-4 text-xs text-slate-500 capitalize">${item.frequency}</td>
      <td class="py-3.5 px-4 text-xs tabular-nums text-slate-700">${formatCurrency(item.average_amount)}</td>
      <td class="py-3.5 px-4 text-right text-xs font-semibold tabular-nums text-slate-900">${formatCurrency(item.estimated_monthly_cost)}</td>
    </tr>
  `).join('');
}

function renderCategoryBreakdownList(categories) {
  const container = document.getElementById('category-deep-dive-container');
  if (!container) return;

  if (categories.length === 0) {
    container.innerHTML = '<div class="text-xs text-slate-400">No categories to display.</div>';
    return;
  }

  container.innerHTML = categories.map(cat => `
    <div class="p-4 rounded-xl bg-white border border-slate-200/80 shadow-soft">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-slate-900">${cat.category}</span>
        <span class="text-xs font-bold text-slate-900 tabular-nums">${formatCurrency(cat.amount)}</span>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-2">
        <div class="bg-emerald-600 h-1.5 rounded-full" style="width: ${cat.percentage}%"></div>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500">
        <span>${cat.transactionCount} transactions</span>
        <span>${cat.percentage}% of total spend</span>
      </div>
    </div>
  `).join('');
}
