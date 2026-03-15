// Sparring booking — frontend logic

(function () {
  'use strict';

  let selectedSlotId = null;
  let selectedSlotLabel = '';

  const slotsLoading = document.getElementById('slots-loading');
  const slotsEmpty   = document.getElementById('slots-empty');
  const slotsError   = document.getElementById('slots-error');
  const slotsGrid    = document.getElementById('slots-grid');
  const bookingSection = document.getElementById('booking-section');
  const confirmSection = document.getElementById('confirmation-section');
  const selectedSlotDisplay = document.getElementById('selected-slot-display');
  const slotIdInput = document.getElementById('slot-id');
  const form = document.getElementById('booking-form');
  const formError = document.getElementById('form-error');
  const submitBtn = document.getElementById('submit-booking');

  // ── Load slots ──────────────────────────────────────────────
  async function loadSlots() {
    try {
      const res = await fetch('/api/slots');
      if (!res.ok) throw new Error('Server error');
      const slots = await res.json();

      slotsLoading.style.display = 'none';

      if (slots.length === 0) {
        slotsEmpty.style.display = 'block';
        return;
      }

      slotsGrid.style.display = 'grid';
      slotsGrid.innerHTML = '';

      slots.forEach(slot => {
        const card = document.createElement('div');
        card.className = 'slot-card';
        card.dataset.id = slot.id;

        const dateStr = formatDate(slot.date);
        const durationStr = slot.duration_minutes === 60 ? '1 hour' : `${slot.duration_minutes} min`;

        card.innerHTML = `
          <div class="slot-date">${dateStr}</div>
          <div class="slot-time">${slot.time}</div>
          <div class="slot-duration">${durationStr}</div>
          ${slot.notes ? `<div class="slot-notes">${escapeHtml(slot.notes)}</div>` : ''}
        `;

        card.addEventListener('click', () => selectSlot(slot.id, dateStr, slot.time, durationStr));
        slotsGrid.appendChild(card);
      });

    } catch (err) {
      slotsLoading.style.display = 'none';
      slotsError.style.display = 'block';
    }
  }

  // ── Select a slot ───────────────────────────────────────────
  function selectSlot(id, dateStr, time, duration) {
    selectedSlotId = id;
    selectedSlotLabel = `${dateStr}  |  ${time}  |  ${duration}`;

    // Highlight the card
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
    const card = document.querySelector(`.slot-card[data-id="${id}"]`);
    if (card) card.classList.add('selected');

    slotIdInput.value = id;
    selectedSlotDisplay.textContent = `Selected: ${selectedSlotLabel}`;

    bookingSection.style.display = 'block';
    bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formError.style.display = 'none';
  }

  // ── Cancel booking ──────────────────────────────────────────
  document.getElementById('cancel-booking').addEventListener('click', () => {
    selectedSlotId = null;
    document.querySelectorAll('.slot-card').forEach(c => c.classList.remove('selected'));
    bookingSection.style.display = 'none';
    document.getElementById('slots').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Submit booking ──────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.style.display = 'none';

    const name  = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();

    if (!name || !email) {
      showFormError('Name and email are required.');
      return;
    }
    if (!validateEmail(email)) {
      showFormError('Please enter a valid email address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Booking...';

    const payload = {
      slot_id: parseInt(slotIdInput.value, 10),
      name,
      email,
      phone:            document.getElementById('phone').value.trim() || undefined,
      experience_level: document.getElementById('experience').value || undefined,
      message:          document.getElementById('message').value.trim() || undefined,
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Booking failed');
      }

      // Show confirmation
      bookingSection.style.display = 'none';
      slotsGrid.style.display = 'none';
      document.querySelector('.slots-intro').style.display = 'none';
      confirmSection.style.display = 'block';
      document.getElementById('confirmation-text').textContent =
        `${name}, your session on ${selectedSlotLabel} is confirmed.`;
      confirmSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      showFormError(err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm booking';
    }
  });

  // ── Helpers ─────────────────────────────────────────────────
  function showFormError(msg) {
    formError.textContent = msg;
    formError.style.display = 'block';
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function formatDate(dateStr) {
    // dateStr is YYYY-MM-DD
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Init ─────────────────────────────────────────────────────
  loadSlots();

}());
