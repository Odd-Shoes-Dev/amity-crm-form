// ---- Configuration ----
// Update this if the form is ever hosted on a different domain than the CRM API.
const API_URL = '/api/leads.php';

// Minimum seconds a human is expected to take before submitting.
// Bots that auto-fill and submit instantly will be rejected silently.
const MIN_SUBMIT_SECONDS = 3;

const formLoadTime = Date.now();

// The API requires source_type but the form no longer asks clients how they
// heard about us (kept out for simplicity), so every form-submitted lead is
// sent with a fixed value.
const DEFAULT_SOURCE_TYPE = 'other';

// The form no longer asks for gender either. Default to "Other" rather than
// the API's own default of "Male", so it reads as unset/unknown and can be
// corrected later instead of silently mislabeling clients.
const DEFAULT_GENDER = 'Other';

const form = document.getElementById('lead-form');
const submitBtn = document.getElementById('submit-btn');
const formAlert = document.getElementById('form-alert');
const successMessage = document.getElementById('success-message');
const successText = document.getElementById('success-text');

const phoneInput = document.getElementById('phone');
const phoneStatus = document.getElementById('phone-status');

let phoneCheckTimer = null;

function showAlert(message) {
    formAlert.textContent = message;
    formAlert.hidden = false;
}

function hideAlert() {
    formAlert.hidden = true;
    formAlert.textContent = '';
}

// Check phone number against the CRM as the user leaves the field
phoneInput.addEventListener('blur', () => {
    const phone = phoneInput.value.trim();
    phoneStatus.className = 'field-status';
    phoneStatus.textContent = '';

    if (!phone) return;

    clearTimeout(phoneCheckTimer);
    phoneCheckTimer = setTimeout(() => checkPhone(phone), 250);
});

async function checkPhone(phone) {
    phoneStatus.className = 'field-status checking';
    phoneStatus.textContent = 'Checking phone number...';

    try {
        const response = await fetch(`${API_URL}?check_phone=${encodeURIComponent(phone)}`);
        const data = await response.json();

        if (data.success && data.data && data.data.exists) {
            phoneStatus.className = 'field-status exists';
            phoneStatus.textContent = 'This phone number is already registered with us.';
        } else {
            phoneStatus.className = 'field-status ok';
            phoneStatus.textContent = '';
        }
    } catch (err) {
        // If the check fails, don't block the user — just clear the status.
        phoneStatus.className = 'field-status';
        phoneStatus.textContent = '';
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideAlert();

    // Honeypot check: if the hidden field has any value, silently drop the submission.
    const honeypot = document.getElementById('website').value;
    if (honeypot) {
        return;
    }

    // Time-trap check: reject submissions that happen implausibly fast.
    const elapsedSeconds = (Date.now() - formLoadTime) / 1000;
    if (elapsedSeconds < MIN_SUBMIT_SECONDS) {
        return;
    }

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const payload = {
        full_name: document.getElementById('full_name').value.trim(),
        phone: phoneInput.value.trim(),
        gender: DEFAULT_GENDER,
        source_type: DEFAULT_SOURCE_TYPE,
        visit_reason: document.getElementById('visit_reason').value.trim(),
        general_info: document.getElementById('general_info').value.trim()
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success) {
            const isExisting = data.data && data.data.is_existing;
            successText.textContent = isExisting
                ? 'Looks like we already have your details on file. Thank you, our team will still follow up.'
                : 'Your details have been received. A member of our team will reach out to you shortly.';
            form.hidden = true;
            successMessage.hidden = false;
        } else {
            showAlert(data.message || 'Something went wrong. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    } catch (err) {
        showAlert('Unable to reach the server. Please check your connection and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
});
