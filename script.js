// ---- Configuration ----
// Update this if the form is ever hosted on a different domain than the CRM API.
const API_URL = '/api/leads.php';

// Minimum seconds a human is expected to take before submitting.
// Bots that auto-fill and submit instantly will be rejected silently.
const MIN_SUBMIT_SECONDS = 3;

const formLoadTime = Date.now();

// Maps the friendly on-screen source options to the API's accepted source_type values.
// Anything not "referral", "broker", "radio", "walk_in" or "other" is treated as social media,
// with the specific platform recorded in general_info since the API has no per-platform field.
const SOURCE_MAP = {
    x: { source_type: 'social_media', label: 'X (Twitter)' },
    tiktok: { source_type: 'social_media', label: 'TikTok' },
    instagram: { source_type: 'social_media', label: 'Instagram' },
    youtube: { source_type: 'social_media', label: 'YouTube' },
    radio: { source_type: 'radio', label: 'Radio' },
    referral: { source_type: 'referral', label: 'Referral' },
    broker: { source_type: 'broker', label: 'Broker' },
    walk_in: { source_type: 'walk_in', label: 'Walk-in' },
    other: { source_type: 'other', label: 'Other' }
};

const form = document.getElementById('lead-form');
const submitBtn = document.getElementById('submit-btn');
const formAlert = document.getElementById('form-alert');
const successMessage = document.getElementById('success-message');

const sourceChoice = document.getElementById('source_choice');
const referralFields = document.getElementById('referral-fields');
const referralPhoneField = document.getElementById('referral-phone-field');
const referralNameInput = document.getElementById('source_referral_name');

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

// Show/hide referral-specific fields based on the selected source
sourceChoice.addEventListener('change', () => {
    const isReferralType = sourceChoice.value === 'referral' || sourceChoice.value === 'broker';
    referralFields.hidden = !isReferralType;
    referralPhoneField.hidden = !isReferralType;
    referralNameInput.required = isReferralType;
    if (!isReferralType) {
        referralNameInput.value = '';
        document.getElementById('source_referral_phone').value = '';
    }
});

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

    const sourceValue = sourceChoice.value;
    const sourceInfo = SOURCE_MAP[sourceValue];

    if (!sourceInfo) {
        showAlert('Please select how you heard about us.');
        return;
    }

    const isReferralType = sourceValue === 'referral' || sourceValue === 'broker';
    if (isReferralType && !referralNameInput.value.trim()) {
        showAlert('Please provide the referral/broker name.');
        referralNameInput.focus();
        return;
    }

    let generalInfo = document.getElementById('general_info').value.trim();
    if (!isReferralType) {
        const sourceNote = `Heard about us via: ${sourceInfo.label}`;
        generalInfo = generalInfo ? `${sourceNote}\n${generalInfo}` : sourceNote;
    }

    const payload = {
        full_name: document.getElementById('full_name').value.trim(),
        phone: phoneInput.value.trim(),
        gender: document.getElementById('gender').value,
        address: document.getElementById('address').value.trim(),
        source_type: sourceInfo.source_type,
        visit_reason: document.getElementById('visit_reason').value.trim(),
        general_info: generalInfo
    };

    if (isReferralType) {
        payload.source_referral_name = referralNameInput.value.trim();
        payload.source_referral_phone = document.getElementById('source_referral_phone').value.trim();
    }

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
