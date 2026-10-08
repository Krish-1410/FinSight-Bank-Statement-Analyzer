/**
 * FinSight User Profile & Settings Logic
 */

import { api } from './api.js';
import { formatDate, showToast, setupAppShell } from './common.js';

document.addEventListener('DOMContentLoaded', async () => {
  await setupAppShell();
  await loadProfile();
  setupPasswordChange();
});

async function loadProfile() {
  try {
    const res = await api.auth.me();
    const user = res.data?.user;
    if (user) {
      const nameEl = document.getElementById('profile-name');
      const emailEl = document.getElementById('profile-email');
      const joinedEl = document.getElementById('profile-joined-date');

      if (nameEl) nameEl.textContent = user.name;
      if (emailEl) emailEl.textContent = user.email;
      if (joinedEl) joinedEl.textContent = formatDate(user.created_at);
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

function setupPasswordChange() {
  const form = document.getElementById('password-change-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmNewPassword = document.getElementById('confirm-new-password').value;
    const btn = document.getElementById('btn-save-password');

    if (!currentPassword || !newPassword) {
      showToast('Please fill in all password fields.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Updating...';

    try {
      await api.auth.changePassword({ currentPassword, newPassword, confirmNewPassword });
      showToast('Password updated successfully!', 'success');
      form.reset();
    } catch (err) {
      showToast(err.message || 'Failed to update password.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  });
}
