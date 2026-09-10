// Shared header auth state — include on every page that has an #authSlot element.
import { auth, onAuthStateChanged, signOut } from './firebase.js';

function render(user) {
  const slots = document.querySelectorAll('[data-auth-slot]');
  slots.forEach((slot) => {
    if (user) {
      slot.innerHTML =
        '<span style="font-size:14px;color:var(--cocoa-500);margin-right:12px">' + (user.email || 'Signed in') + '</span>' +
        '<button type="button" class="btn btn-secondary" data-sign-out style="padding:9px 16px;font-size:14px">Sign out</button>';
    } else {
      slot.innerHTML = '<a href="login.html">Sign in</a>';
    }
  });

  document.querySelectorAll('[data-sign-out]').forEach((btn) => {
    btn.addEventListener('click', function () {
      signOut(auth).then(function () {
        window.location.href = 'index.html';
      });
    });
  });

  document.dispatchEvent(new CustomEvent('ontyme-auth-ready', { detail: { user } }));
}

onAuthStateChanged(auth, render);
