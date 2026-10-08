/**
 * FinSight Authentication Page Logic
 * Handles both Sign In and Registration with seamless tab switching
 * and instant 1-click demo access.
 */

import { api } from './api.js';
import { showToast } from './common.js';

document.addEventListener('DOMContentLoaded', () => {
  setupTabSwitching();
  setupLoginForm();
  setupRegisterForm();
  setupInstantDemoButtons();
  setupQuickFill();
});

function setupTabSwitching() {
  const tabSignIn = document.getElementById('tab-signin');
  const tabRegister = document.getElementById('tab-register');
  const loginSection = document.getElementById('section-login');
  const registerSection = document.getElementById('section-register');
  const formError = document.getElementById('form-error');

  function switchToSignIn() {
    if (formError) formError.classList.add('hidden');
    if (tabSignIn && tabRegister) {
      tabSignIn.className = 'flex-1 py-2 text-xs font-bold rounded-full bg-[#0F5B41] text-white shadow-xs transition-all';
      tabRegister.className = 'flex-1 py-2 text-xs font-semibold rounded-full text-slate-500 hover:text-slate-900 transition-colors';
    }
    if (loginSection) loginSection.classList.remove('hidden');
    if (registerSection) registerSection.classList.add('hidden');
  }

  function switchToRegister() {
    if (formError) formError.classList.add('hidden');
    if (tabSignIn && tabRegister) {
      tabRegister.className = 'flex-1 py-2 text-xs font-bold rounded-full bg-[#0F5B41] text-white shadow-xs transition-all';
      tabSignIn.className = 'flex-1 py-2 text-xs font-semibold rounded-full text-slate-500 hover:text-slate-900 transition-colors';
    }
    if (registerSection) registerSection.classList.remove('hidden');
    if (loginSection) loginSection.classList.add('hidden');
  }

  if (tabSignIn) tabSignIn.addEventListener('click', switchToSignIn);
  if (tabRegister) tabRegister.addEventListener('click', switchToRegister);

  // Switch if URL hash is #register or page is register.html
  if (window.location.pathname.includes('register') || window.location.hash === '#register') {
    switchToRegister();
  }
}

function setupInstantDemoButtons() {
  const demoButtons = document.querySelectorAll('.btn-instant-demo');
  demoButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Connecting to demo session...
      `;

      try {
        await api.auth.demoLogin();
        showToast('Signed in as Demo User (Sujon Alex)', 'success');
        window.location.href = '/dashboard.html';
      } catch (err) {
        showToast(err.message || 'Demo login failed.', 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  });
}

function setupQuickFill() {
  const btnFill = document.getElementById('btn-demo-fill');
  if (btnFill) {
    btnFill.addEventListener('click', () => {
      const emailInput = document.getElementById('login-email') || document.getElementById('email');
      const passwordInput = document.getElementById('login-password') || document.getElementById('password');
      if (emailInput && passwordInput) {
        emailInput.value = 'demo@finsight.app';
        passwordInput.value = 'password123';
        showToast('Filled demo credentials', 'info');
      }
    });
  }
}

function setupLoginForm() {
  const loginForm = document.getElementById('login-form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('login-email') || document.getElementById('email');
    const passwordInput = document.getElementById('login-password') || document.getElementById('password');
    const submitBtn = document.getElementById('btn-login-submit') || document.getElementById('btn-submit');
    const errorDiv = document.getElementById('form-error');

    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if (!email || !password) {
      showError(errorDiv, 'Please enter both email and password.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Signing in...
      `;
    }

    try {
      await api.auth.login({ email, password });
      showToast('Signed in successfully', 'success');
      
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get('redirect') || '/dashboard.html';
      window.location.href = redirect;
    } catch (err) {
      showError(errorDiv, err.message || 'Invalid email or password.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign In';
      }
    }
  });
}

function setupRegisterForm() {
  const registerForm = document.getElementById('register-form');
  if (!registerForm) return;

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('register-name') || document.getElementById('name');
    const emailInput = document.getElementById('register-email') || document.getElementById('email');
    const passwordInput = document.getElementById('register-password') || document.getElementById('password');
    const confirmPasswordInput = document.getElementById('register-confirm-password') || document.getElementById('confirmPassword');
    const submitBtn = document.getElementById('btn-register-submit') || document.getElementById('btn-submit');
    const errorDiv = document.getElementById('form-error');

    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }

    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;

    // Front-end validations
    if (!name) {
      showError(errorDiv, 'Please enter your full name.');
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(errorDiv, 'Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      showError(errorDiv, 'Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      showError(errorDiv, 'Password confirmation does not match.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        Creating account...
      `;
    }

    try {
      await api.auth.register({ name, email, password, confirmPassword });
      showToast('Account created successfully! Welcome to FinSight.', 'success');
      window.location.href = '/dashboard.html';
    } catch (err) {
      showError(errorDiv, err.message || 'Failed to create account.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Create Account';
      }
    }
  });
}

function showError(errorDiv, msg) {
  if (errorDiv) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('hidden');
  } else {
    showToast(msg, 'error');
  }
}
