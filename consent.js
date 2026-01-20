/*
 * consent.js – Handles the multi‑step consent form for Zenon
 *
 * This script orchestrates the three steps of the digital consent form:
 *  1. Collect parent/guardian details (name and mobile number)
 *  2. Collect information about one or more children (name and date of birth)
 *  3. Display a consent agreement, capture an electronic signature and
 *     submit the data to the backend API for storage and PDF generation.
 *
 * The mobile number acts as the primary key for each customer. When the
 * parent provides their mobile number we attempt to fetch any existing
 * consent data and prepopulate the child fields. Once the consent form
 * has been signed and submitted the user is redirected to a completion
 * page which displays a QR code containing their mobile number.
 */

// Wait for DOM to be ready before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
  // DOM elements for steps
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');

  // Form fields
  const parentNameInput = document.getElementById('parentName');
  const mobileNumberInput = document.getElementById('mobileNumber');
  const parentNameError = document.getElementById('parentNameError');
  const mobileNumberError = document.getElementById('mobileNumberError');
  const childrenContainer = document.getElementById('childrenContainer');
  const parentNameSection = document.getElementById('parentNameSection');

  // Sanitize mobile input: allow only digits and limit to 10 characters
  mobileNumberInput.addEventListener('input', () => {
    mobileNumberInput.value = mobileNumberInput.value.replace(/\D/g, '').slice(0, 10);
    // 🔄 clear any prefills while typing a new number
    isExistingCustomer = false;
    parentNameInput.readOnly = false;
    parentNameInput.value = '';
    childrenContainer.innerHTML = '';
  });

  // Buttons
  const nextToDetailsBtn = document.getElementById('nextToDetails');
  const addChildBtn = document.getElementById('addChild');
  const backToMobileBtn = document.getElementById('backToMobile');
  const nextToConsentBtn = document.getElementById('nextToConsent');
  const backToDetailsBtn = document.getElementById('backToDetails');
  const finishBtn = document.getElementById('finishBtn');
  const clearSignatureBtn = document.getElementById('clearSignature');

  // Consent text container
  const consentTextDiv = document.getElementById('consentText');

  // Signature pad setup
  const canvas = document.getElementById('signatureCanvas');
  const signaturePad = new SignaturePad(canvas, {
    penColor: '#2563eb',
    backgroundColor: '#fff'
  });

  // We no longer use a global childCount. The number shown on each child group
  // is calculated based on its position within the children container.

  // Track whether the mobile number corresponds to an existing customer
  let isExistingCustomer = false;

  // Precompute the maximum selectable date for children (2 years ago from today)
  const todayDate = new Date();
  const twoYearsAgoDate = new Date(todayDate.getFullYear() - 2, todayDate.getMonth(), todayDate.getDate());

  /**
   * Initialize a flatpickr date picker on the given input element.
   * @param {HTMLInputElement} input The date input element
   * @param {string|undefined} defaultValue Optional default date value (yyyy-mm-dd)
   */
  function setupDatePicker(input, defaultValue) {
    const options = {
      dateFormat: 'Y-m-d',
      maxDate: twoYearsAgoDate,
      defaultDate: defaultValue || undefined
    };
    flatpickr(input, options);
  }

  /**
   * Display the given step and hide the others
   * @param {number} stepIndex which step to show: 1, 2 or 3
   */
  function showStep(stepIndex) {
    step1.classList.remove('active');
    step2.classList.remove('active');
    step3.classList.remove('active');
    if (stepIndex === 1) {
      step1.classList.add('active');
    } else if (stepIndex === 2) {
      step2.classList.add('active');
    } else if (stepIndex === 3) {
      step3.classList.add('active');
    }
  }

  /**
   * Validate the parent details form
   * @returns {boolean} true if valid, false otherwise
   */
  /**
   * Validate the mobile number in step1
   */
  function validateMobile() {
    const mobile = mobileNumberInput.value.trim();
    mobileNumberError.style.display = 'none';
    const mobileRegex = /^[6-9][0-9]{9}$/;
    if (!mobileRegex.test(mobile)) {
      mobileNumberError.textContent =
        'Please enter a valid 10‑digit Indian mobile number starting with 6–9.';
      mobileNumberError.style.display = 'block';
      return false;
    }
    return true;
  }

  /**
   * Validate the parent name in step2 when required
   */
  function validateParentNameIfNeeded() {
    parentNameError.style.display = 'none';
    if (isExistingCustomer) {
      // For existing customers we already have the name; no need to validate
      return true;
    }
    const name = parentNameInput.value.trim();
    if (!name) {
      parentNameError.textContent = 'Please enter your name.';
      parentNameError.style.display = 'block';
      return false;
    }
    return true;
  }

  /**
   * Clear all child input fields in the childrenContainer
   */
  function clearChildren() {
    childrenContainer.innerHTML = '';
  }

  /**
   * Create a new child input group with name and DOB fields
   * Optionally prepopulate the values
   * @param {Object} child optional object containing legalName/legalname, displayName/displayname, and dob (ISO string or yyyy-mm-dd)
   */
  function addChildGroup(child = {}) {
    const groupIndex = childrenContainer.querySelectorAll('.child-group').length + 1;
    const group = document.createElement('div');
    group.className = 'child-group';
    group.dataset.index = groupIndex;

    // --- Header: Child N ---
    const header = document.createElement('div');
    header.className = 'child-header';
    header.textContent = `Child ${groupIndex}`;
    group.appendChild(header);

    // --- Legal Name ---
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Legal Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.required = true;

    // ✅ Populate legal name value and placeholder
    const legalName = child.legalName || child.legalname || child.name || '';
    nameInput.value = legalName;
    nameInput.placeholder = legalName || "Child's legal full name";

    nameInput.id = `childName${groupIndex}`;

    // --- Display Name (Nick Name) ---
    const displayNameLabel = document.createElement('label');
    displayNameLabel.textContent = 'Display Name';
    const displayNameInput = document.createElement('input');
    displayNameInput.type = 'text';
    displayNameInput.required = false;

    // ✅ Populate display name value and placeholder
    const displayName = child.displayName || child.displayname || child.displayName || child.nick_name || child.nickname || '';
    displayNameInput.value = displayName;
    displayNameInput.placeholder = displayName || "Child's nickname or preferred name";

    displayNameInput.id = `childDisplayName${groupIndex}`;



    // --- Date of Birth ---
    const dobLabel = document.createElement('label');
    dobLabel.textContent = 'Date of Birth';

    // // Hint under/near DOB label
    // const dobHint = document.createElement('div');
    // dobHint.textContent = "Get a free pass on your child's birthday!";
    // dobHint.style.fontSize = '0.85rem';
    // dobHint.style.color = '#6b7280';
    // dobHint.style.margin = '4px 0 6px';

    const dobInput = document.createElement('input');
    dobInput.type = 'text';
    dobInput.required = true;
    dobInput.id = `childDOB${groupIndex}`;
    dobInput.readOnly = true; // use calendar
    dobInput.placeholder = 'dd/mm/yyyy';

    // Prepopulate date if provided
    let prepopDate;
    if (child.dob) {
      if (/\d{4}-\d{2}-\d{2}/.test(child.dob)) {
        prepopDate = child.dob;
      } else if (/\d{2}\/\d{2}\/\d{4}/.test(child.dob)) {
        const [dd, mm, yyyy] = child.dob.split('/');
        prepopDate = `${yyyy}-${mm}-${dd}`;
      }
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.style.backgroundColor = '#ef4444';
    removeBtn.style.marginTop = '0.5rem';
    removeBtn.addEventListener('click', () => {
      childrenContainer.removeChild(group);
      reindexChildren();
    });

    // Append in the new order
    group.appendChild(nameLabel);
    group.appendChild(nameInput);
    group.appendChild(displayNameLabel);
    group.appendChild(displayNameInput);
    group.appendChild(dobLabel);
    group.appendChild(dobHint);   // hint sits just below the DOB label
    group.appendChild(dobInput);
    group.appendChild(removeBtn);
    childrenContainer.appendChild(group);

    setupDatePicker(dobInput, prepopDate);

    // First child can't be removed
    removeBtn.style.display = groupIndex === 1 ? 'none' : '';
  }

  /**
   * Gather all child data from the childrenContainer
   * @returns {Array<{legalname:string,displayname:string,dob:string}>}
   */
  function getChildData() {
    const data = [];
    const groups = childrenContainer.querySelectorAll('.child-group');
    groups.forEach(group => {
      const nameInput = group.querySelector("input[id^='childName']");
      const displayNameInput = group.querySelector("input[id^='childDisplayName']");
      const dobInput = group.querySelector("input[id^='childDOB']");
      data.push({ 
        legalname: nameInput.value.trim(), 
        displayname: displayNameInput.value.trim(),
        dob: dobInput.value 
      });
    });
    return data;
  }

  /**
   * Validate children fields
   * @returns {boolean}
   */
  function validateChildren() {
    const groups = childrenContainer.querySelectorAll('.child-group');
    let valid = true;
    // Remove any existing error spans inside children groups
    childrenContainer.querySelectorAll('.child-error').forEach(el => el.remove());
    if (groups.length === 0) {
      // If no children added, automatically add one empty group and flag as invalid
      addChildGroup();
      valid = false;
      // Show an error below the container
      const error = document.createElement('div');
      error.className = 'error child-error';
      error.textContent = 'Please add at least one child.';
      childrenContainer.appendChild(error);
      return false;
    }
    groups.forEach(group => {
      const nameInput = group.querySelector("input[id^='childName']");
      const dobInput = group.querySelector("input[id^='childDOB']");
      // Clear any existing error for this group
      // Only check fields if not previously appended; we remove above
      if (!nameInput.value.trim() || !dobInput.value) {
        valid = false;
        const err = document.createElement('span');
        err.className = 'error child-error';
        err.textContent = 'Please enter legal name and date of birth.';
        group.appendChild(err);
      } else {
        // Validate date is at least two years before today
        const today = new Date();
        const twoYearsAgo = new Date(today.getFullYear() - 2, today.getMonth(), today.getDate());
        const dobDate = new Date(dobInput.value);
        if (isNaN(dobDate.getTime())) {
          valid = false;
          const err = document.createElement('span');
          err.className = 'error child-error';
          err.textContent = 'Please select a valid date.';
          group.appendChild(err);
        } else if (dobDate > twoYearsAgo) {
          valid = false;
          const err = document.createElement('span');
          err.className = 'error child-error';
          err.textContent = 'Child must be at least 2 years old.';
          group.appendChild(err);
        }
      }
    });
    return valid;
  }

  /**
   * Compose the consent text inserting parent and child names
   * @param {string} parentName
   * @param {Array<{name:string,dob:string}>} children
   */
  function composeConsentText(parentName, children) {
    const childNames = children.map(c => {
      const legalName = c.legalname || c.name;
      const displayName = c.displayname;
      return displayName ? `${legalName} (${displayName})` : legalName;
    }).join(', ');
    // Generic consent statement – this should be replaced with actual legal text
    return `I, ${parentName}, as the parent/guardian of ${childNames}, hereby give consent for my child/children to participate in activities at LePlay – Little Engineers Playground, operated by FOREVER KID LLP. I acknowledge that participation involves inherent risks and agree that I will not hold the company liable for any injury or loss incurred while my child/children are on the premises. By signing below, I confirm that the information provided is accurate and that I have read and understood this consent form.`;
  }

  /**
   * Reindex child groups after addition or removal so that labels and IDs
   * remain sequential. Also hides the remove button on the first group.
   */
  function reindexChildren() {
    const groups = childrenContainer.querySelectorAll('.child-group');
    groups.forEach((group, i) => {
      const n = i + 1;
      group.dataset.index = n;

      // Update the section header
      const header = group.querySelector('.child-header');
      if (header) header.textContent = `Child ${n}`;

      // Keep labels generic; just ensure input IDs stay sequential
      const nameInput = group.querySelector("input[id^='childName']");
      const displayNameInput = group.querySelector("input[id^='childDisplayName']");
      const dobInput = group.querySelector("input[id^='childDOB']");
      if (nameInput) nameInput.id = `childName${n}`;
      if (displayNameInput) displayNameInput.id = `childDisplayName${n}`;
      if (dobInput) dobInput.id = `childDOB${n}`;

      // First child cannot be removed
      const removeBtn = group.querySelector('button[type="button"]');
      if (removeBtn) removeBtn.style.display = n === 1 ? 'none' : '';
    });
  }

  /**
   * Populate the form with existing data (if any) retrieved from the backend
   * @param {Object} data
   */
  function populateExistingData(data) {
    if (!data) return;
    console.log('Populating existing data:', data); // Debug log
    if (data.parentName) {
      parentNameInput.value = data.parentName;
    }
    if (Array.isArray(data.children)) {
      clearChildren();
      data.children.forEach((child, index) => {
        console.log(`Child ${index + 1} data:`, child); // Debug log
        addChildGroup(child);
      });
    }
  }

  /**
   * Fetch existing consent data for the given mobile number and prefill the form
   * @param {string} mobile
   */
  async function fetchExistingConsent(mobile) {
    try {
      const response = await fetch(`https://www.littleengineersplayground.com/api/consent?mobile=${encodeURIComponent(mobile)}`);

      if (!response.ok) return;

      const json = await response.json();
      if (json && json.exists) {
        isExistingCustomer = true;
        populateExistingData(json.data || json); // ✅ supports both wrapped and direct
      } else {
        isExistingCustomer = false;
      }

    } catch (err) {
      console.error('Error fetching existing consent:', err);
      isExistingCustomer = false;
    }
  }

  // Event: Next from mobile number to details
  nextToDetailsBtn.addEventListener('click', async () => {
    if (!validateMobile()) return;

    // 🔄 hard reset of previous state
    isExistingCustomer = false;
    parentNameInput.readOnly = false;
    parentNameInput.value = '';
    childrenContainer.innerHTML = '';

    const mobile = mobileNumberInput.value.trim();

    // fetch and prefill if exists
    await fetchExistingConsent(mobile);

    // always show name
    parentNameSection.style.display = 'block';
    parentNameInput.readOnly = isExistingCustomer;

    // ensure at least one child group
    if (childrenContainer.children.length === 0) addChildGroup();

    showStep(2);
  });

  // Event: Add child
  addChildBtn.addEventListener('click', () => {
    addChildGroup();
  });

  // Event: Back to mobile number entry
  backToMobileBtn.addEventListener('click', () => {
    // 🔄 clear form state so a new mobile starts fresh
    isExistingCustomer = false;
    parentNameInput.readOnly = false;
    parentNameInput.value = '';
    childrenContainer.innerHTML = '';
    showStep(1);
  });

  // Event: Next to consent (signature)
  nextToConsentBtn.addEventListener('click', () => {
    // Validate parent name if required
    if (!validateParentNameIfNeeded()) return;
    if (!validateChildren()) return;
    const parentName = isExistingCustomer ? parentNameInput.value.trim() : parentNameInput.value.trim();
    const children = getChildData();
    const consent = composeConsentText(parentName, children);
    consentTextDiv.textContent = consent;
    showStep(3);
    // Adjust canvas dimensions to match container size. Without this the
    // signature pad may behave unexpectedly on mobile devices.
    resizeCanvas();
  });

  // Event: Back to details from consent
  backToDetailsBtn.addEventListener('click', () => {
    showStep(2);
  });

  // Event: Clear signature canvas
  clearSignatureBtn.addEventListener('click', () => {
    signaturePad.clear();
  });

  /**
   * Resize the signature canvas to fill its container and scale content
   */
  function resizeCanvas() {
    // Save current data
    const data = signaturePad.toData();
    // Set canvas width/height to container's clientWidth/clientHeight
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d').scale(ratio, ratio);
    signaturePad.clear();
    signaturePad.fromData(data);
  }

  // Resize the canvas when window resized
  window.addEventListener('resize', resizeCanvas);

  // Event: Submit consent form and signature
  finishBtn.addEventListener('click', async () => {
    // Validate signature
    if (signaturePad.isEmpty()) {
      alert('Please provide your signature before finishing.');
      return;
    }
    
    // Get mobile number from the input field
    const mobileInput = document.getElementById('mobileNumber');
    const mobile = mobileInput ? mobileInput.value.trim() : '';
    console.log('Mobile input element:', mobileInput); // Debug log
    console.log('Mobile number from input:', mobile); // Debug log
    
    if (!mobile) {
      alert('Mobile number is missing. Please go back and enter your mobile number.');
      return;
    }
    
    // Collect data
    const parentName = parentNameInput.value.trim();
    const children = getChildData();
    const signatureDataUrl = signaturePad.toDataURL('image/png');
    
    console.log('Form data:', { parentName, mobile, children }); // Debug log
    
    // Construct payload
    const payload = {
      parentName,
      mobile,
      children,
      signature: signatureDataUrl
    };
    try {
      finishBtn.disabled = true;
      finishBtn.textContent = 'Submitting…';
      
      console.log('Submitting to:', 'https://www.littleengineersplayground.com/api/consent'); // Debug log
      console.log('Payload:', JSON.stringify(payload, null, 2)); // Debug log
      
      const response = await fetch('https://www.littleengineersplayground.com/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', response.status); // Debug log
      console.log('Response ok:', response.ok); // Debug log
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Backend error response:', errorText); // Debug log
        throw new Error(`Failed to submit consent: ${response.status} - ${errorText}`);
      }
      
      // Expect JSON response { success: true }
      const result = await response.json();
      console.log('Backend response:', result); // Debug log
      console.log('Redirecting with mobile:', mobile); // Debug log
      
      if (result && result.success) {
        // Redirect to completion page with mobile parameter
        // Use .html extension for Vercel compatibility
        const redirectUrl = `complete.html?mobile=${encodeURIComponent(mobile)}`;
        console.log('Redirect URL:', redirectUrl); // Debug log
        window.location.href = redirectUrl;
      } else {
        console.error('Backend returned success=false:', result);
        
        // Handle specific error messages
        if (result.message && result.message.includes('already submitted')) {
          alert(`⚠️ Form Already Submitted Today\n\nThis mobile number has already submitted a consent form today. \n\nIf you need to add more children, please:\n• Contact the facility staff, or\n• Try again tomorrow, or\n• Use a different mobile number\n\nNote: You can register multiple children in a single form submission.`);
        } else {
          alert(`Submission failed: ${result.message || 'Unknown error. Please try again.'}`);
        }
      }
    } catch (err) {
      console.error('Error submitting consent:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      alert(`An error occurred while submitting your consent: ${err.message}. Please try again later.`);
    } finally {
      finishBtn.disabled = false;
      finishBtn.textContent = 'Finish';
    }
  });
});
// Cache bust: 11/05/2025 13:16:11
