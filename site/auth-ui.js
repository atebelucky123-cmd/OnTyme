// Shared header auth state — include on every page that has an #authSlot element.
import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from './firebase.js';

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

  // The driver never sees the customer-facing site — bounce straight to the
  // console once we confirm they're the driver. Runs after the render/dispatch
  // above (fire-and-forget) so a slow or failed check never blocks the page.
  // Matches both "/dashboard.html" and the clean-URL "/dashboard" that static
  // hosts (this local dev server, Vercel) serve it at — matching only the
  // ".html" form causes a redirect loop against a host that strips it.
  const onDashboard = /\/dashboard(\.html)?\/?$/.test(location.pathname);
  if (user && !onDashboard) {
    getDoc(doc(db, 'config', 'app')).then(function (configSnap) {
      if (configSnap.exists() && configSnap.data().driverUid === user.uid) {
        window.location.href = 'dashboard.html';
      }
    }).catch(function (err) {
      console.error(err);
    });
  }
}

onAuthStateChanged(auth, render);
