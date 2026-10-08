/**
 * FinSight Shared Utilities & UI Helpers
 */

import { api } from './api.js';

export function formatCurrency(amount, compact = false) {
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
  if (compact) {
    const abs = Math.abs(num);
    if (abs >= 10000000) {
      return (num < 0 ? '-₹' : '₹') + (abs / 10000000).toFixed(2) + ' Cr';
    }
    if (abs >= 100000) {
      return (num < 0 ? '-₹' : '₹') + (abs / 100000).toFixed(2) + ' L';
    }
    if (abs >= 1000) {
      return (num < 0 ? '-₹' : '₹') + (abs / 1000).toFixed(1) + 'k';
    }
  }
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));
  return (num < 0 ? '-₹' : '₹') + formatted;
}

export function formatINR(amount, compact = false) {
  return formatCurrency(amount, compact);
}


export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function showToast(message, type = 'info') {
  // Remove any existing toast
  const existing = document.getElementById('finsight-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'finsight-toast';
  toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-card toast-animate flex items-center gap-3 text-sm font-medium border';

  let bgClass = 'bg-white text-slate-900 border-slate-200';
  let iconHtml = `
    <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `;

  if (type === 'success') {
    bgClass = 'bg-emerald-900 text-white border-emerald-800';
    iconHtml = `
      <svg class="w-4 h-4 text-emerald-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    `;
  } else if (type === 'error') {
    bgClass = 'bg-rose-900 text-white border-rose-800';
    iconHtml = `
      <svg class="w-4 h-4 text-rose-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    `;
  }

  toast.className += ` ${bgClass}`;
  toast.innerHTML = `
    ${iconHtml}
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -10px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

export async function setupAppShell() {
  const user = api.getUser();
  
  // Set user badges across dashboard/layout
  if (user) {
    const firstName = (user.name || user.email || 'Sujon').split(' ')[0];
    document.querySelectorAll('.user-name-display').forEach(el => {
      el.textContent = firstName;
    });
    document.querySelectorAll('.user-email-display').forEach(el => {
      el.textContent = user.email;
    });
    document.querySelectorAll('.user-avatar-initial').forEach(el => {
      const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
      el.textContent = initial;
    });
  }

  // Logout triggers
  document.querySelectorAll('.btn-logout').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      await api.auth.logout();
    });
  });

  // Mobile sidebar toggle
  const sidebar = document.getElementById('dashboard-sidebar');
  const openBtn = document.getElementById('btn-open-sidebar');
  const closeBtn = document.getElementById('btn-close-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (openBtn && sidebar) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.remove('-translate-x-full');
      if (backdrop) backdrop.classList.remove('hidden');
    });
  }

  if (closeBtn && sidebar) {
    closeBtn.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      if (backdrop) backdrop.classList.add('hidden');
    });
  }

  if (backdrop && sidebar) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    });
  }

  // Quick verify auth in background
  try {
    const res = await api.auth.me();
    if (res.data?.user) {
      api.setUser(res.data.user);
    }
  } catch (e) {
    // If not authenticated and on a protected page, api.js will redirect
  }
}
