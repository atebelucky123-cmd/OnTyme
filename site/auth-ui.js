// Shared header auth state — include on every page that has an #authSlot element.
import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from './firebase.js';

async function render(user) {
  // The driver never sees the customer-facing site — bounce straight to the console.
  if (user && !location.pathname.endsWith('dashboard.html')) {
    try {
      const configSnap = await getDoc(doc(db, 'config', 'app'));
      if (configSnap.exists() && configSnap.data().driverUid === user.uid) {
        window.location.href = 'dashboard.html';
        return;
      }
    } catch (err) {
      console.error(err);
    }
  }

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
