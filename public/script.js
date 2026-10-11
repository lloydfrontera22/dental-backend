document.addEventListener('DOMContentLoaded', () => {
  /* ==================== COMPACT LOGIN-CARD CAROUSEL ==================== */
  const carousel = document.getElementById('hero-carousel');
  const slides = [...document.querySelectorAll('.hero-slide')];
  const dotsWrap = document.getElementById('dots');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let current = 0;
  let timer = null;
  const AUTO_DELAY = 5000;

  slides.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `carousel-dot${index === 0 ? ' is-active' : ''}`;
    dot.setAttribute('aria-label', `Show image ${index + 1}`);
    dot.addEventListener('click', () => goTo(index));
    dotsWrap.appendChild(dot);
  });

  const dots = [...dotsWrap.children];

  function render() {
    slides.forEach((slide, index) => {
      const active = index === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-active', index === current);
      dot.setAttribute('aria-current', index === current ? 'true' : 'false');
    });
  }

  function goTo(index, restartTimer = true) {
    current = (index + slides.length) % slides.length;
    render();
    if (restartTimer) restart();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  function restart() {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(next, AUTO_DELAY);
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', restart);
  carousel.addEventListener('focusin', () => clearInterval(timer));
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) restart();
  });

  let touchStartX = 0;
  let touchStartY = 0;

  carousel.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    clearInterval(timer);
  }, { passive: true });

  carousel.addEventListener('touchend', event => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next() : prev();
    } else {
      restart();
    }
  }, { passive: true });

  render();
  restart();

  /* ==================== PASSWORD VISIBILITY ==================== */
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('password');

  toggleBtn.addEventListener('click', () => {
    const hidden = passwordInput.type === 'password';
    passwordInput.type = hidden ? 'text' : 'password';
    toggleBtn.querySelector('.eye-open').style.display = hidden ? 'none' : 'block';
    toggleBtn.querySelector('.eye-closed').style.display = hidden ? 'block' : 'none';
    toggleBtn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
  });

  /* ==================== LOGIN FORM + BACKEND ==================== */
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordField = passwordInput.closest('.field');
  const emailField = emailInput.closest('.field');
  const emailError = document.getElementById('email-error');
  const passwordError = document.getElementById('password-error');
  const submitBtn = document.getElementById('submit-btn');
  const submitLabel = document.getElementById('submit-label');
  const status = document.getElementById('form-status');
  const rememberInput = document.getElementById('remember');
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function setError(field, errorEl, message) {
    field.classList.toggle('has-error', Boolean(message));
    errorEl.textContent = message || '';
  }

  function validateEmail() {
    const value = emailInput.value.trim();
    if (!value) {
      setError(emailField, emailError, 'Work email is required');
      return false;
    }
    if (!emailPattern.test(value)) {
      setError(emailField, emailError, 'Enter a valid work email address');
      return false;
    }
    setError(emailField, emailError, '');
    return true;
  }

  function validatePassword() {
    const value = passwordInput.value;
    if (!value) {
      setError(passwordField, passwordError, 'Password is required');
      return false;
    }
    if (value.length < 8) {
      setError(passwordField, passwordError, 'Password must be at least 8 characters');
      return false;
    }
    setError(passwordField, passwordError, '');
    return true;
  }

  function setStatus(message, type = '') {
    status.textContent = message || '';
    status.className = `form-status${type ? ` ${type}` : ''}`;
  }

  emailInput.addEventListener('blur', validateEmail);
  passwordInput.addEventListener('blur', validatePassword);
  emailInput.addEventListener('input', () => {
    setStatus('');
    if (emailField.classList.contains('has-error')) validateEmail();
  });
  passwordInput.addEventListener('input', () => {
    setStatus('');
    if (passwordField.classList.contains('has-error')) validatePassword();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    setStatus('');

    const emailOk = validateEmail();
    const passwordOk = validatePassword();
    if (!emailOk || !passwordOk) return;

    submitBtn.disabled = true;
    submitLabel.textContent = 'Signing in…';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
          remember: rememberInput.checked
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Unable to sign in. Please try again.');
      }

      setStatus(`Welcome, ${data.user.name}. Redirecting…`, 'success');
      passwordInput.value = '';
      setError(passwordField, passwordError, '');
      window.location.href = data.user.clinicId ? 'admin/dashboard.html' : 'admin/onboarding.html';
    } catch (error) {
      setStatus(error.message || 'Unable to connect to the server.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitLabel.textContent = 'Sign in to portal';
    }
  });

  document.getElementById('forgot-link').addEventListener('click', event => {
    event.preventDefault();
    setStatus('Password recovery should be connected to your hospital administrator workflow.');
  });

  document.getElementById('register-link').addEventListener('click', event => {
    event.preventDefault();
    setStatus('Please contact your hospital administrator for portal access.');
  });

  document.getElementById('google-btn').addEventListener('click', () => {
    setStatus('Google Workspace OAuth is not configured in this project yet.');
  });
});
