/* ============================================================
   wear.TAM — Account Page Logic
============================================================ */

'use strict'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentUser = null

/* ─── INIT ────────────────────────────────────────────── */
async function initAccountPage() {
  const hash = window.location.hash

  // If there's an auth hash (email confirm / password reset link),
  // wait for Supabase to process it before checking session
  if (hash.includes('access_token') || hash.includes('type=recovery')) {
    // Give Supabase up to 3 seconds to parse the hash into a session
    await new Promise(resolve => setTimeout(resolve, 1500))
    // Clear the hash so it doesn't interfere
    history.replaceState(null, '', window.location.pathname)
  }

  const { data: { session }, error } = await db.auth.getSession()

  if (error || !session?.user) {
    window.location.href = '/'
    return false
  }

  currentUser = session.user
  showAccountContent()
  loadProfile()
  loadMeasurements()
  loadOrders()
  updateNavUser()
  return true
}

function showAccountContent() {
  document.getElementById('accountLoading')?.classList.add('hidden')
  document.getElementById('accountContent')?.classList.remove('hidden')

  const email = currentUser.email || ''
  document.getElementById('accountUserEmail').textContent = email

  // Handle auth state changes (e.g. logout from another tab)
  db.auth.onAuthStateChange((_event, session) => {
    if (!session) window.location.href = '/'
  })
}

function updateNavUser() {
  const btn   = document.getElementById('authNavBtn')
  const label = document.getElementById('authNavLabel')
  if (!btn) return
  const name = currentUser.user_metadata?.full_name?.split(' ')[0] || 'Account'
  if (label) label.textContent = 'Hi, ' + name
  btn.setAttribute('data-state', 'signed-in')
  btn.classList.add('signed-in')
}

/* ─── TABS ────────────────────────────────────────────── */
function initTabs() {
  const navItems = document.querySelectorAll('.account-nav-item[data-tab]')
  const tabs     = document.querySelectorAll('.account-tab')

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'))
      tabs.forEach(t => t.classList.add('hidden'))

      item.classList.add('active')
      document.getElementById('tab' + capitalise(item.dataset.tab))?.classList.remove('hidden')
    })
  })
}

/* ─── PROFILE PHOTO ───────────────────────────────────── */
async function initAvatarUpload() {
  const input   = document.getElementById('avatarInput')
  const preview = document.getElementById('avatarPreview')
  const icon    = document.getElementById('avatarIcon')

  // Load existing avatar
  const avatarUrl = currentUser.user_metadata?.avatar_url
  if (avatarUrl) {
    preview.src = avatarUrl
    preview.style.display = 'block'
    if (icon) icon.style.display = 'none'
  }

  input?.addEventListener('change', async e => {
    const file = e.target.files[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB.')
      return
    }

    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = ev => {
      preview.src = ev.target.result
      preview.style.display = 'block'
      if (icon) icon.style.display = 'none'
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    try {
      const ext      = file.name.split('.').pop()
      const filePath = `avatars/${currentUser.id}.${ext}`

      const { error: uploadError } = await db.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = db.storage.from('avatars').getPublicUrl(filePath)
      const publicUrl = data.publicUrl

      // Save URL to user metadata
      await db.auth.updateUser({ data: { avatar_url: publicUrl } })
      showToast('Profile photo updated ✓')
    } catch (err) {
      showToast('Could not upload photo. Please try again.')
    }
  })
}


async function loadProfile() {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single()

  const name = data?.full_name || currentUser.user_metadata?.full_name || ''

  document.getElementById('accountUserName').textContent = name || 'My Account'
  document.getElementById('profileFullName').value   = name
  document.getElementById('profileEmail').value      = currentUser.email || ''
  document.getElementById('profilePhone').value      = data?.phone || ''
  document.getElementById('profileAddress').value    = data?.delivery_address || ''
}

function initProfileForm() {
  const form = document.getElementById('profileForm')
  if (!form) return

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const btn = form.querySelector('button[type="submit"]')
    setLoading(btn, true)
    clearMsg('profileMsg')

    const fullName = document.getElementById('profileFullName').value.trim()
    const phone    = document.getElementById('profilePhone').value.trim()
    const address  = document.getElementById('profileAddress').value.trim()

    try {
      // Update Supabase Auth metadata
      await db.auth.updateUser({ data: { full_name: fullName } })

      // Upsert profile table
      const { error } = await db.from('profiles').upsert({
        id: currentUser.id,
        full_name: fullName,
        phone,
        delivery_address: address
      })

      if (error) throw error

      document.getElementById('accountUserName').textContent = fullName || 'My Account'
      showMsg('profileMsg', 'Profile updated successfully.', 'success')
    } catch (err) {
      showMsg('profileMsg', 'Could not save profile. Please try again.', 'error')
    } finally {
      setLoading(btn, false)
    }
  })
}

function initPasswordForm() {
  const form = document.getElementById('passwordForm')
  if (!form) return

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const btn      = form.querySelector('button[type="submit"]')
    const newPass  = document.getElementById('newPassword').value
    const confirm  = document.getElementById('confirmPassword').value

    if (!newPass) return

    if (newPass !== confirm) {
      showMsg('passwordMsg', 'Passwords do not match.', 'error')
      return
    }

    if (newPass.length < 6) {
      showMsg('passwordMsg', 'Password must be at least 6 characters.', 'error')
      return
    }

    setLoading(btn, true)
    clearMsg('passwordMsg')

    try {
      const { error } = await db.auth.updateUser({ password: newPass })
      if (error) throw error
      showMsg('passwordMsg', 'Password updated successfully.', 'success')
      form.reset()
    } catch (err) {
      showMsg('passwordMsg', 'Could not update password. Please try again.', 'error')
    } finally {
      setLoading(btn, false)
    }
  })
}

/* ─── MEASUREMENTS ────────────────────────────────────── */
async function loadMeasurements() {
  const { data, error } = await db
    .from('measurements')
    .select('*')
    .eq('user_id', currentUser.id)
    .single()

  if (error || !data) return

  const map = {
    aBust: 'bust', aWaist: 'waist', aHips: 'hips',
    aHeight: 'height', aShoulder: 'shoulder_width',
    aSleeve: 'sleeve_length', aThigh: 'thigh',
    aInseam: 'inseam', aBackLength: 'back_length', aNeck: 'neck'
  }

  Object.entries(map).forEach(([elId, field]) => {
    const el = document.getElementById(elId)
    if (el && data[field]) el.value = data[field]
  })
}

function initMeasurementsForm() {
  const form = document.getElementById('accountMeasurementsForm')
  if (!form) return

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const btn = form.querySelector('button[type="submit"]')
    setLoading(btn, true)
    clearMsg('measurementsMsg')

    const payload = {
      user_id:        currentUser.id,
      bust:           parseFloatOrNull('aBust'),
      waist:          parseFloatOrNull('aWaist'),
      hips:           parseFloatOrNull('aHips'),
      height:         parseFloatOrNull('aHeight'),
      shoulder_width: parseFloatOrNull('aShoulder'),
      sleeve_length:  parseFloatOrNull('aSleeve'),
      thigh:          parseFloatOrNull('aThigh'),
      inseam:         parseFloatOrNull('aInseam'),
      back_length:    parseFloatOrNull('aBackLength'),
      neck:           parseFloatOrNull('aNeck'),
      updated_at:     new Date().toISOString()
    }

    try {
      const { error } = await db
        .from('measurements')
        .upsert(payload, { onConflict: 'user_id' })

      if (error) throw error
      showMsg('measurementsMsg', 'Measurements saved successfully.', 'success')
    } catch (err) {
      showMsg('measurementsMsg', 'Could not save measurements. Please try again.', 'error')
    } finally {
      setLoading(btn, false)
    }
  })
}

/* ─── ORDERS ──────────────────────────────────────────── */
// NOTE: Order status is managed by the TAM vendor directly in the Supabase
// dashboard (orders.status field: pending/confirmed/shipped/delivered/cancelled)
// until a dedicated admin panel exists. The orders tab polls every 60s so a
// status update is reflected without a page reload.
async function loadOrders() {
  const { data, error } = await db
    .from('orders')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })

  const list  = document.getElementById('ordersList')
  const empty = document.getElementById('ordersEmpty')

  // Clear any previously rendered cards (keep the empty-state placeholder)
  // so the 60s auto-refresh doesn't stack duplicate cards.
  list?.querySelectorAll('.order-card').forEach(c => c.remove())

  if (error || !data || data.length === 0) {
    if (empty) empty.style.display = ''
    return
  }

  if (empty) empty.style.display = 'none'

  data.forEach(order => {
    const card = document.createElement('div')
    card.className = 'order-card'

    // Items list with quantities and sizes
    let itemsHtml
    if (Array.isArray(order.items) && order.items.length) {
      itemsHtml = order.items.map(i => {
        const name  = escapeHtml(i.name || 'TAM Product')
        const qty   = i.qty || 1
        const size  = i.size ? escapeHtml(String(i.size)) : ''
        return `<div class="order-item-line">
          <span class="order-item-name">${name}</span>
          <span class="order-item-meta">×${qty}${size ? ' · Size: ' + size : ''}</span>
        </div>`
      }).join('')
    } else {
      itemsHtml = '<div class="order-item-line"><span class="order-item-name">Order items</span></div>'
    }

    const date    = new Date(order.created_at).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
    const shortId = String(order.id).split('-')[0].toUpperCase()
    const status  = escapeHtml(order.status || 'pending')
    const waText  = encodeURIComponent(`Hi TAM, I have a question about order #${shortId}`)
    const waLink  = `https://wa.me/2348143631189?text=${waText}`

    card.innerHTML = `
      <div class="order-card-header">
        <span class="order-id">Order #${escapeHtml(shortId)}</span>
        <span class="order-date">${escapeHtml(date)}</span>
        <span class="order-status ${status}">${status}</span>
      </div>
      <div class="order-items-list">${itemsHtml}</div>
      <p class="order-total">Total: ₦${Number(order.total).toLocaleString('en-NG')}</p>
      <a class="order-whatsapp" href="${waLink}" target="_blank" rel="noopener">
        <i class="fab fa-whatsapp"></i> Questions about this order? Chat with us
      </a>
    `
    list.appendChild(card)
  })
}

/* ─── SIGN OUT ────────────────────────────────────────── */
function initSignOut() {
  document.getElementById('signOutBtn')?.addEventListener('click', async () => {
    try {
      await db.auth.signOut()
    } catch (err) {
      console.error('Sign out failed:', err)
    }
    // Redirect either way — onAuthStateChange also fires SIGNED_OUT
    window.location.href = '/'
  })
}

/* ─── HAMBURGER (mobile nav) ──────────────────────────── */
function initMobileNav() {
  const hamburger  = document.getElementById('hamburger')
  const mobileMenu = document.getElementById('mobileMenu')

  hamburger?.addEventListener('click', () => {
    const isOpen = mobileMenu?.classList.toggle('open')
    hamburger.classList.toggle('open', isOpen)
  })

  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu?.classList.remove('open')
      hamburger?.classList.remove('open')
    })
  })
}

/* ─── ACCOUNT NAV BUTTON (Fix E) ─────────────────────── */
function initAccountNav() {
  const btn = document.getElementById('authNavBtn')
  btn?.addEventListener('click', () => {
    // Already on the account page — return the user to the top
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
}

/* ─── DELETE ACCOUNT (Fix C) ─────────────────────────── */
function initDeleteAccount() {
  const confirmInput = document.getElementById('deleteConfirmText')
  const deleteBtn   = document.getElementById('deleteAccountBtn')
  if (!confirmInput || !deleteBtn) return

  // Enable the button only once the user has typed DELETE
  confirmInput.addEventListener('input', () => {
    deleteBtn.disabled = confirmInput.value.trim() !== 'DELETE'
  })

  deleteBtn.addEventListener('click', async () => {
    if (confirmInput.value.trim() !== 'DELETE') return
    deleteBtn.disabled = true
    deleteBtn.textContent = 'Deleting...'
    clearMsg('deleteAccountMsg')

    try {
      const { data: { session } } = await db.auth.getSession()
      const token = session?.access_token
      if (!token) {
        showMsg('deleteAccountMsg', 'Please sign in again, then retry.', 'error')
        deleteBtn.disabled = false
        deleteBtn.textContent = 'Delete My Account'
        return
      }

      const res = await fetch('/.netlify/functions/delete-account', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type':  'application/json'
        }
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Delete failed, please try again.')
      }

      // Deleted server-side — clear the local session and leave
      try { await db.auth.signOut() } catch (e) { /* user is already gone */ }
      showToast('Your account has been deleted.')
      window.location.href = '/'
    } catch (err) {
      showMsg('deleteAccountMsg', 'Could not delete account: ' + (err.message || 'please try again.'), 'error')
      deleteBtn.disabled = false
      deleteBtn.textContent = 'Delete My Account'
    }
  })
}

/* ─── HELPERS ─────────────────────────────────────────── */
function showMsg(id, text, type) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = text
  el.className = 'account-message ' + type
  el.classList.remove('hidden')
  setTimeout(() => el.classList.add('hidden'), 5000)
}

function clearMsg(id) {
  const el = document.getElementById(id)
  if (el) el.classList.add('hidden')
}

function setLoading(btn, loading) {
  if (!btn) return
  btn.disabled = loading
  btn.dataset.orig = btn.dataset.orig || btn.textContent
  btn.textContent = loading ? 'Saving...' : btn.dataset.orig
}

function parseFloatOrNull(id) {
  const val = document.getElementById(id)?.value
  return val ? parseFloat(val) : null
}

function capitalise(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(String(str)))
  return div.innerHTML
}

/* ─── TOAST ───────────────────────────────────────────── */
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast')
  if (!toast) return
  toast.textContent = message
  toast.classList.add('show')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => toast.classList.remove('show'), duration)
}

/* ─── BOOT ────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initAccountPage().then(shown => {
    if (!shown) return // redirected away, don't init UI
    initTabs()
    initAvatarUpload()
    initProfileForm()
    initPasswordForm()
    initMeasurementsForm()
    initSignOut()
    initMobileNav()
    initAccountNav()
    initDeleteAccount()
    // Auto-refresh orders every 60 seconds so status updates show without reload
    setInterval(loadOrders, 60000)
  }).catch(err => console.error('Account init error:', err))
})
