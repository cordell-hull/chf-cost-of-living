import { generatePDF, generateFilename, downloadPDF } from './lib/pdf.js';
import { APP_VERSION } from './config/version.js';
import { saveDraft, loadDraft, clearDraft } from './lib/storage.js';

// ========================================
// Application State
// ========================================

const report = {
  school: {
    city: '',
    state: '',
    name: '',
    address: '',
    contactName: '',
    email: '',
    phone: ''
  },
  healthInsurance: {
    schoolOffers: null,
    monthlyCostToTeacher: 0,
    monthlyPremiumEstimate: 0,
    j2DependentCost: 0,
    j2Offered: true
  },
  food: {
    weeklyEstimate: 0,
    items: [
      { label: 'Basic lunch menu (business district)', amount: 0 },
      { label: 'Combo meal (fast food)', amount: 0 },
      { label: '500g boneless chicken breast', amount: 0 },
      { label: '1 liter whole milk', amount: 0 },
      { label: '12 eggs, large', amount: 0 },
      { label: '1 kg tomatoes', amount: 0 },
      { label: '500g local cheese', amount: 0 },
      { label: '1 kg apples', amount: 0 },
      { label: '1 kg potatoes', amount: 0 },
      { label: '2 liters Coca-Cola', amount: 0 },
      { label: 'Bread for 2 people for 1 day', amount: 0 }
    ]
  },
  taxes: {
    federalPercent: '',
    statePercent: '',
    noStateTax: false,
    educationEvaluation: 0,
    educationEvalNotNeeded: false,
    unionFees: 0,
    noUnionFees: false
  },
  housing: {
    hostFamily: null,
    studioInexpensive: 0,
    studioNearSchool: 0,
    oneBedInexpensive: 0,
    oneBedNearSchool: 0,
    twoBedInexpensive: 0,
    twoBedNearSchool: 0,
    cellphone: 0,
    internet: 0,
    electricity: 0
  },
  transportation: {
    singleRide: 0,
    monthlyPass: 0,
    leaseCost: 0,
    usedCarCost: 0,
    newCarDeal: '',
    gasPerWeek: 0
  },
  entertainment: {
    movieTicket: 0,
    baseball: 0,
    baseballNA: false,
    football: 0,
    footballNA: false,
    basketball: 0,
    basketballNA: false,
    otherName: '',
    otherCost: 0,
    otherNA: false
  }
};

let currentStep = 1;
const TOTAL_STEPS = 8;

const DRAFT_KEY = 'chf-cost-of-living';
const SHARED_SCHOOL_KEY = 'chf-school-info';
const AUTOSAVE_INTERVAL_MS = 30000;

const DEFAULT_FOOD_LABELS = report.food.items.map(i => i.label);

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois',
  'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts',
  'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota',
  'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina',
  'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming'
];

// ========================================
// Draft Auto-save
// ========================================

function _buildDraftData() {
  syncFormToState();
  return {
    school: { ...report.school },
    healthInsurance: { ...report.healthInsurance },
    food: {
      weeklyEstimate: report.food.weeklyEstimate,
      items: report.food.items.map(i => ({ ...i }))
    },
    taxes: { ...report.taxes },
    housing: { ...report.housing },
    transportation: { ...report.transportation },
    entertainment: { ...report.entertainment }
  };
}

function _saveCurrentDraft() {
  saveDraft(DRAFT_KEY, _buildDraftData());
  try {
    const existing = JSON.parse(localStorage.getItem(SHARED_SCHOOL_KEY) || '{}');
    existing.schoolName = report.school.name || existing.schoolName || '';
    localStorage.setItem(SHARED_SCHOOL_KEY, JSON.stringify(existing));
  } catch {}
}

function _restoreDraft(draft) {
  const d = draft.data;

  Object.assign(report.school, d.school || {});
  Object.assign(report.healthInsurance, d.healthInsurance || {});
  if (d.food) {
    report.food.weeklyEstimate = d.food.weeklyEstimate || 0;
    if (d.food.items) report.food.items = d.food.items;
  }
  Object.assign(report.taxes, d.taxes || {});
  Object.assign(report.housing, d.housing || {});
  Object.assign(report.transportation, d.transportation || {});
  Object.assign(report.entertainment, d.entertainment || {});

  // Restore Step 1
  document.getElementById('city').value = report.school.city;
  document.getElementById('state').value = report.school.state;
  document.getElementById('schoolName').value = report.school.name;
  document.getElementById('schoolAddress').value = report.school.address;
  document.getElementById('contactName').value = report.school.contactName;
  document.getElementById('contactEmail').value = report.school.email;
  document.getElementById('contactPhone').value = report.school.phone;

  // Restore Step 2
  if (report.healthInsurance.schoolOffers !== null) {
    _setToggle('schoolOffersInsurance', report.healthInsurance.schoolOffers ? 'yes' : 'no');
  }
  document.getElementById('insuranceMonthlyCost').value = formatCurrency(report.healthInsurance.monthlyCostToTeacher);
  document.getElementById('insurancePremiumEstimate').value = formatCurrency(report.healthInsurance.monthlyPremiumEstimate);
  _setToggle('j2DependentToggle', report.healthInsurance.j2Offered ? 'offered' : 'not-offered');
  document.getElementById('j2DependentCost').value = formatCurrency(report.healthInsurance.j2DependentCost);

  // Restore Step 3
  document.getElementById('weeklyEstimate').value = formatCurrency(report.food.weeklyEstimate);
  renderFoodItems();

  // Restore Step 4
  document.getElementById('federalTax').value = report.taxes.federalPercent;
  _setToggle('stateTaxToggle', report.taxes.noStateTax ? 'no-tax' : 'has-tax');
  document.getElementById('stateTax').value = report.taxes.statePercent;
  _setToggle('eduEvalToggle', report.taxes.educationEvalNotNeeded ? 'not-needed' : 'needed');
  document.getElementById('eduEvalAmount').value = formatCurrency(report.taxes.educationEvaluation);
  _setToggle('unionFeesToggle', report.taxes.noUnionFees ? 'no-fees' : 'has-fees');
  document.getElementById('unionFeesAmount').value = formatCurrency(report.taxes.unionFees);

  // Restore Step 5
  if (report.housing.hostFamily !== null) {
    _setToggle('hostFamilyToggle', report.housing.hostFamily ? 'yes' : 'no');
  }
  document.getElementById('studioInexpensive').value = formatCurrency(report.housing.studioInexpensive);
  document.getElementById('studioNearSchool').value = formatCurrency(report.housing.studioNearSchool);
  document.getElementById('oneBedInexpensive').value = formatCurrency(report.housing.oneBedInexpensive);
  document.getElementById('oneBedNearSchool').value = formatCurrency(report.housing.oneBedNearSchool);
  document.getElementById('twoBedInexpensive').value = formatCurrency(report.housing.twoBedInexpensive);
  document.getElementById('twoBedNearSchool').value = formatCurrency(report.housing.twoBedNearSchool);
  document.getElementById('cellphone').value = formatCurrency(report.housing.cellphone);
  document.getElementById('internet').value = formatCurrency(report.housing.internet);
  document.getElementById('electricity').value = formatCurrency(report.housing.electricity);

  // Restore Step 6
  document.getElementById('singleRide').value = formatCurrency(report.transportation.singleRide);
  document.getElementById('monthlyPass').value = formatCurrency(report.transportation.monthlyPass);
  document.getElementById('leaseCost').value = formatCurrency(report.transportation.leaseCost);
  document.getElementById('usedCarCost').value = formatCurrency(report.transportation.usedCarCost);
  document.getElementById('newCarDeal').value = report.transportation.newCarDeal;
  document.getElementById('gasPerWeek').value = formatCurrency(report.transportation.gasPerWeek);

  // Restore Step 7
  document.getElementById('movieTicket').value = formatCurrency(report.entertainment.movieTicket);
  _setToggle('baseballToggle', report.entertainment.baseballNA ? 'na' : 'available');
  document.getElementById('baseballCost').value = formatCurrency(report.entertainment.baseball);
  _setToggle('footballToggle', report.entertainment.footballNA ? 'na' : 'available');
  document.getElementById('footballCost').value = formatCurrency(report.entertainment.football);
  _setToggle('basketballToggle', report.entertainment.basketballNA ? 'na' : 'available');
  document.getElementById('basketballCost').value = formatCurrency(report.entertainment.basketball);
  _setToggle('otherSportToggle', report.entertainment.otherNA ? 'na' : 'available');
  document.getElementById('otherSportName').value = report.entertainment.otherName;
  document.getElementById('otherSportCost').value = formatCurrency(report.entertainment.otherCost);

  updateHeaderDisplay();
  currentStep = 1;
  updateWizardUI();
}

function _formatRelativeDate(isoString) {
  const saved = new Date(isoString);
  const diffMs = Date.now() - saved.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

function initDraftRestore() {
  const draft = loadDraft(DRAFT_KEY);
  if (!draft) return;

  const banner = document.getElementById('draftBanner');
  document.getElementById('draftDate').textContent = _formatRelativeDate(draft.savedAt);
  banner.style.display = 'flex';

  document.getElementById('draftResumeBtn').addEventListener('click', () => {
    banner.style.display = 'none';
    _restoreDraft(draft);
  });

  document.getElementById('draftDiscardBtn').addEventListener('click', () => {
    banner.style.display = 'none';
    clearDraft(DRAFT_KEY);
  });
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  initStateDropdown();
  initNavigationButtons();
  initFoodSection();
  initToggleGroups();
  initSchoolNameListener();
  initCurrencyInputs();
  document.getElementById('generatePdfBtn').addEventListener('click', generateReport);

  renderFoodItems();

  document.getElementById('appVersion').textContent = `v${APP_VERSION}`;

  initDraftRestore();
  _loadSharedSchoolName();
  setInterval(_saveCurrentDraft, AUTOSAVE_INTERVAL_MS);
});

function _loadSharedSchoolName() {
  if (report.school.name) return;
  try {
    const shared = JSON.parse(localStorage.getItem(SHARED_SCHOOL_KEY));
    if (shared && shared.schoolName) {
      report.school.name = shared.schoolName;
      document.getElementById('schoolName').value = shared.schoolName;
      updateHeaderDisplay();
    }
  } catch {}
}

function initCurrencyInputs() {
  document.querySelectorAll('.input-with-prefix input[type="text"][inputmode="decimal"]')
    .forEach(input => input.addEventListener('blur', _onCurrencyBlur));
}

// ========================================
// Header Display
// ========================================

function updateHeaderDisplay() {
  const nameHeader = document.getElementById('schoolNameHeader');
  nameHeader.textContent = report.school.name || '';
}

function initSchoolNameListener() {
  const input = document.getElementById('schoolName');
  input.addEventListener('input', () => {
    report.school.name = input.value.trim();
    updateHeaderDisplay();
  });
}

// ========================================
// State Dropdown
// ========================================

function initStateDropdown() {
  const select = document.getElementById('state');
  select.innerHTML = '<option value="">Select state...</option>' +
    US_STATES.map(s => `<option value="${s}">${s}</option>`).join('');
}

// ========================================
// Toggle Groups
// ========================================

function initToggleGroups() {
  document.querySelectorAll('.toggle-group').forEach(group => {
    const buttons = group.querySelectorAll('.toggle-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        _activateToggle(group, btn);
        _updateConditionalFields();
      });
    });
  });
  _updateConditionalFields();
}

function _activateToggle(group, activeBtn) {
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.remove('active-yes', 'active-no');
  });

  const value = activeBtn.dataset.value;
  const isPositive = ['yes', 'offered', 'has-tax', 'needed', 'has-fees', 'available'].includes(value);
  activeBtn.classList.add(isPositive ? 'active-yes' : 'active-no');
  group.classList.remove('toggle-error');
}

function _setToggle(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  const btn = group.querySelector(`[data-value="${value}"]`);
  if (btn) {
    _activateToggle(group, btn);
    _updateConditionalFields();
  }
}

function _getToggleValue(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return null;
  const active = group.querySelector('.active-yes, .active-no');
  return active ? active.dataset.value : null;
}

function _updateConditionalFields() {
  const mappings = [
    ['schoolOffersInsurance', 'insuranceCostField', 'yes'],
    ['j2DependentToggle', 'j2CostField', 'offered'],
    ['stateTaxToggle', 'stateTaxField', 'has-tax'],
    ['eduEvalToggle', 'eduEvalField', 'needed'],
    ['unionFeesToggle', 'unionFeesField', 'has-fees'],
    ['baseballToggle', 'baseballField', 'available'],
    ['footballToggle', 'footballField', 'available'],
    ['basketballToggle', 'basketballField', 'available'],
    ['otherSportToggle', 'otherSportField', 'available']
  ];

  for (const [toggleId, fieldId, showValue] of mappings) {
    const val = _getToggleValue(toggleId);
    const field = document.getElementById(fieldId);
    if (field) {
      field.classList.toggle('visible', val === showValue);
    }
  }
}

// ========================================
// Food Section
// ========================================

function initFoodSection() {
  const addBtn = document.getElementById('addFoodBtn');
  const newLabelInput = document.getElementById('newFoodLabel');

  addBtn.addEventListener('click', () => {
    const label = newLabelInput.value.trim();
    if (!label) return;

    const exists = report.food.items.some(
      i => i.label.toLowerCase() === label.toLowerCase()
    );
    if (exists) {
      alert('This item already exists.');
      return;
    }

    report.food.items.push({ label, amount: 0, custom: true });
    renderFoodItems();
    newLabelInput.value = '';
  });

  newLabelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBtn.click();
    }
  });
}

function renderFoodItems() {
  const container = document.getElementById('foodItemsContainer');
  container.innerHTML = '';

  report.food.items.forEach((item, index) => {
    const isCustom = !DEFAULT_FOOD_LABELS.includes(item.label);
    const row = document.createElement('div');
    row.className = `cost-item-row${isCustom ? ' custom' : ''}`;
    row.innerHTML = `
      <label>${escapeHtml(item.label)}</label>
      <div class="input-with-prefix">
        <span class="prefix">$</span>
        <input type="text" inputmode="decimal" value="${item.amount ? formatCurrency(item.amount) : ''}"
               class="food-item-input" data-index="${index}">
      </div>
      ${isCustom ? '<button type="button" class="btn-icon-only btn-remove-item" title="Remove">✕</button>' : ''}
    `;

    const input = row.querySelector('.food-item-input');
    input.addEventListener('input', () => {
      report.food.items[index].amount = parseCurrency(input.value);
    });
    input.addEventListener('blur', _onCurrencyBlur);

    if (isCustom) {
      row.querySelector('.btn-remove-item').addEventListener('click', () => {
        report.food.items.splice(index, 1);
        renderFoodItems();
      });
    }

    container.appendChild(row);
  });
}

// ========================================
// Form Sync
// ========================================

function syncFormToState() {
  // Step 1: School
  report.school.city = document.getElementById('city').value.trim();
  report.school.state = document.getElementById('state').value;
  report.school.name = document.getElementById('schoolName').value.trim();
  report.school.address = document.getElementById('schoolAddress').value.trim();
  report.school.contactName = document.getElementById('contactName').value.trim();
  report.school.email = document.getElementById('contactEmail').value.trim();
  report.school.phone = document.getElementById('contactPhone').value.trim();

  // Step 2: Health Insurance
  const insToggle = _getToggleValue('schoolOffersInsurance');
  report.healthInsurance.schoolOffers = insToggle === 'yes' ? true : insToggle === 'no' ? false : null;
  report.healthInsurance.monthlyCostToTeacher = parseCurrency(document.getElementById('insuranceMonthlyCost').value);
  report.healthInsurance.monthlyPremiumEstimate = parseCurrency(document.getElementById('insurancePremiumEstimate').value);
  report.healthInsurance.j2Offered = _getToggleValue('j2DependentToggle') === 'offered';
  report.healthInsurance.j2DependentCost = parseCurrency(document.getElementById('j2DependentCost').value);

  // Step 3: Food
  report.food.weeklyEstimate = parseCurrency(document.getElementById('weeklyEstimate').value);

  // Step 4: Taxes
  report.taxes.federalPercent = document.getElementById('federalTax').value.trim();
  report.taxes.noStateTax = _getToggleValue('stateTaxToggle') === 'no-tax';
  report.taxes.statePercent = document.getElementById('stateTax').value.trim();
  report.taxes.educationEvalNotNeeded = _getToggleValue('eduEvalToggle') === 'not-needed';
  report.taxes.educationEvaluation = parseCurrency(document.getElementById('eduEvalAmount').value);
  report.taxes.noUnionFees = _getToggleValue('unionFeesToggle') === 'no-fees';
  report.taxes.unionFees = parseCurrency(document.getElementById('unionFeesAmount').value);

  // Step 5: Housing
  const hostToggle = _getToggleValue('hostFamilyToggle');
  report.housing.hostFamily = hostToggle === 'yes' ? true : hostToggle === 'no' ? false : null;
  report.housing.studioInexpensive = parseCurrency(document.getElementById('studioInexpensive').value);
  report.housing.studioNearSchool = parseCurrency(document.getElementById('studioNearSchool').value);
  report.housing.oneBedInexpensive = parseCurrency(document.getElementById('oneBedInexpensive').value);
  report.housing.oneBedNearSchool = parseCurrency(document.getElementById('oneBedNearSchool').value);
  report.housing.twoBedInexpensive = parseCurrency(document.getElementById('twoBedInexpensive').value);
  report.housing.twoBedNearSchool = parseCurrency(document.getElementById('twoBedNearSchool').value);
  report.housing.cellphone = parseCurrency(document.getElementById('cellphone').value);
  report.housing.internet = parseCurrency(document.getElementById('internet').value);
  report.housing.electricity = parseCurrency(document.getElementById('electricity').value);

  // Step 6: Transportation
  report.transportation.singleRide = parseCurrency(document.getElementById('singleRide').value);
  report.transportation.monthlyPass = parseCurrency(document.getElementById('monthlyPass').value);
  report.transportation.leaseCost = parseCurrency(document.getElementById('leaseCost').value);
  report.transportation.usedCarCost = parseCurrency(document.getElementById('usedCarCost').value);
  report.transportation.newCarDeal = document.getElementById('newCarDeal').value.trim();
  report.transportation.gasPerWeek = parseCurrency(document.getElementById('gasPerWeek').value);

  // Step 7: Entertainment
  report.entertainment.movieTicket = parseCurrency(document.getElementById('movieTicket').value);
  report.entertainment.baseballNA = _getToggleValue('baseballToggle') === 'na';
  report.entertainment.baseball = parseCurrency(document.getElementById('baseballCost').value);
  report.entertainment.footballNA = _getToggleValue('footballToggle') === 'na';
  report.entertainment.football = parseCurrency(document.getElementById('footballCost').value);
  report.entertainment.basketballNA = _getToggleValue('basketballToggle') === 'na';
  report.entertainment.basketball = parseCurrency(document.getElementById('basketballCost').value);
  report.entertainment.otherNA = _getToggleValue('otherSportToggle') === 'na';
  report.entertainment.otherName = document.getElementById('otherSportName').value.trim();
  report.entertainment.otherCost = parseCurrency(document.getElementById('otherSportCost').value);
}

// ========================================
// Wizard Navigation
// ========================================

function initNavigationButtons() {
  document.getElementById('prevBtn').addEventListener('click', goToPreviousStep);
  document.getElementById('nextBtn').addEventListener('click', goToNextStep);
  updateNavigationButtons();
}

function goToPreviousStep() {
  if (currentStep > 1) {
    _saveCurrentDraft();
    currentStep--;
    updateWizardUI();
  }
}

function goToNextStep() {
  if (!validateCurrentStep()) return;

  _saveCurrentDraft();

  if (currentStep < TOTAL_STEPS) {
    currentStep++;
    updateWizardUI();

    if (currentStep === TOTAL_STEPS) {
      renderReview();
    }
  }
}

function updateWizardUI() {
  document.querySelectorAll('.wizard-step').forEach((step, index) => {
    step.classList.toggle('active', index + 1 === currentStep);
  });

  document.querySelectorAll('.progress-step').forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');
    if (stepNum === currentStep) step.classList.add('active');
    else if (stepNum < currentStep) step.classList.add('completed');
  });

  updateNavigationButtons();
  document.querySelector('.wizard-content').scrollIntoView({ behavior: 'smooth' });
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';

  if (currentStep === TOTAL_STEPS) {
    nextBtn.style.visibility = 'hidden';
  } else {
    nextBtn.style.visibility = 'visible';
    nextBtn.textContent = currentStep === TOTAL_STEPS - 1 ? 'Review →' : 'Next →';
  }
}

// ========================================
// Validation
// ========================================

function validateCurrentStep() {
  syncFormToState();
  switch (currentStep) {
    case 1: return validateSchoolInfo();
    case 2: return validateInsurance();
    case 3: return validateFood();
    case 4: return validateTaxes();
    case 5: return validateHousing();
    case 6: return validateTransport();
    case 7: return validateEntertainment();
    default: return true;
  }
}

function _requireText(fieldId, errorId, msg) {
  const val = document.getElementById(fieldId).value.trim();
  if (!val) { showError(errorId, msg); return false; }
  clearError(errorId);
  return true;
}

function _requireCurrency(fieldId, errorId, msg) {
  const val = parseCurrency(document.getElementById(fieldId).value);
  if (!val || val <= 0) { showError(errorId, msg); return false; }
  clearError(errorId);
  return true;
}

function _requireToggle(toggleId, errorId, msg) {
  const val = _getToggleValue(toggleId);
  const group = document.getElementById(toggleId);
  if (!val) {
    showError(errorId, msg);
    if (group) group.classList.add('toggle-error');
    return false;
  }
  clearError(errorId);
  if (group) group.classList.remove('toggle-error');
  return true;
}

function validateSchoolInfo() {
  let valid = true;
  if (!_requireText('city', 'cityError', 'City is required.')) valid = false;
  if (!_requireText('state', 'stateError', 'State is required.')) valid = false;
  if (!_requireText('schoolName', 'schoolNameError', 'School name is required.')) valid = false;
  if (!_requireText('schoolAddress', 'schoolAddressError', 'School address is required.')) valid = false;
  if (!_requireText('contactName', 'contactNameError', 'Contact name is required.')) valid = false;
  if (!_requireText('contactEmail', 'contactEmailError', 'Email is required.')) valid = false;
  if (!_requireText('contactPhone', 'contactPhoneError', 'Phone number is required.')) valid = false;
  return valid;
}

function validateInsurance() {
  let valid = true;
  if (!_requireToggle('schoolOffersInsurance', 'insuranceToggleError', 'Please select Yes or No.')) {
    valid = false;
  } else if (report.healthInsurance.schoolOffers) {
    if (!_requireCurrency('insuranceMonthlyCost', 'insuranceCostError', 'Monthly cost is required.')) valid = false;
  }

  if (!_requireCurrency('insurancePremiumEstimate', 'premiumEstimateError', 'Premium estimate is required.')) valid = false;

  if (report.healthInsurance.j2Offered) {
    if (!_requireCurrency('j2DependentCost', 'j2CostError', 'Dependent cost is required.')) valid = false;
  }
  return valid;
}

function validateFood() {
  if (!report.food.weeklyEstimate || report.food.weeklyEstimate <= 0) {
    showError('weeklyEstimateError', 'Weekly estimate is required.');
    return false;
  }
  clearError('weeklyEstimateError');
  return true;
}

function validateTaxes() {
  let valid = true;
  if (!_requireText('federalTax', 'federalTaxError', 'Federal tax % is required.')) valid = false;

  if (!report.taxes.noStateTax) {
    if (!_requireText('stateTax', 'stateTaxError', 'State tax % is required.')) valid = false;
  }

  if (!report.taxes.educationEvalNotNeeded) {
    if (!_requireCurrency('eduEvalAmount', 'eduEvalError', 'Evaluation amount is required.')) valid = false;
  }

  if (!report.taxes.noUnionFees) {
    if (!_requireCurrency('unionFeesAmount', 'unionFeesError', 'Union fees amount is required.')) valid = false;
  }
  return valid;
}

function validateHousing() {
  let valid = true;
  if (!_requireToggle('hostFamilyToggle', 'hostFamilyError', 'Please select Yes or No.')) valid = false;

  const apartmentFields = [
    'studioInexpensive', 'studioNearSchool', 'oneBedInexpensive',
    'oneBedNearSchool', 'twoBedInexpensive', 'twoBedNearSchool'
  ];
  let allApartmentsFilled = true;
  for (const id of apartmentFields) {
    if (parseCurrency(document.getElementById(id).value) <= 0) {
      allApartmentsFilled = false;
    }
  }
  if (!allApartmentsFilled) {
    showError('apartmentError', 'All apartment costs are required.');
    valid = false;
  } else {
    clearError('apartmentError');
  }

  const utilityFields = ['cellphone', 'internet', 'electricity'];
  let allUtilitiesFilled = true;
  for (const id of utilityFields) {
    if (parseCurrency(document.getElementById(id).value) <= 0) {
      allUtilitiesFilled = false;
    }
  }
  if (!allUtilitiesFilled) {
    showError('utilityError', 'All utility costs are required.');
    valid = false;
  } else {
    clearError('utilityError');
  }

  return valid;
}

function validateTransport() {
  let valid = true;
  const publicFields = ['singleRide', 'monthlyPass'];
  let publicOk = true;
  for (const id of publicFields) {
    if (parseCurrency(document.getElementById(id).value) <= 0) publicOk = false;
  }
  if (!publicOk) {
    showError('publicTransportError', 'All public transport costs are required.');
    valid = false;
  } else {
    clearError('publicTransportError');
  }

  const autoFields = ['leaseCost', 'usedCarCost', 'gasPerWeek'];
  let autoOk = true;
  for (const id of autoFields) {
    if (parseCurrency(document.getElementById(id).value) <= 0) autoOk = false;
  }
  if (!document.getElementById('newCarDeal').value.trim()) autoOk = false;
  if (!autoOk) {
    showError('autoError', 'All automobile cost fields are required.');
    valid = false;
  } else {
    clearError('autoError');
  }

  return valid;
}

function validateEntertainment() {
  let valid = true;

  if (!_requireCurrency('movieTicket', 'movieTicketError', 'Movie ticket cost is required.')) valid = false;

  const sports = [
    { toggle: 'baseballToggle', field: 'baseballCost', errorId: 'baseballToggle' },
    { toggle: 'footballToggle', field: 'footballCost', errorId: 'footballToggle' },
    { toggle: 'basketballToggle', field: 'basketballCost', errorId: 'basketballToggle' },
    { toggle: 'otherSportToggle', field: 'otherSportCost', errorId: 'otherSportToggle' }
  ];

  for (const { toggle, field } of sports) {
    const val = _getToggleValue(toggle);
    const group = document.getElementById(toggle);
    if (!val) {
      if (group) group.classList.add('toggle-error');
      valid = false;
    } else {
      if (group) group.classList.remove('toggle-error');
      if (val === 'available' && parseCurrency(document.getElementById(field).value) <= 0) {
        valid = false;
      }
    }
  }

  if (!valid && parseCurrency(document.getElementById('movieTicket').value) > 0) {
    showError('movieTicketError', 'Select Available or N/A for each sport. Fill in cost if available.');
  }

  return valid;
}

// ========================================
// Review
// ========================================

function renderReview() {
  syncFormToState();
  const container = document.getElementById('reviewContainer');
  const r = report;
  const h = r.housing;
  const t = r.transportation;
  const e = r.entertainment;

  const foodItemsHtml = r.food.items
    .filter(i => i.amount > 0)
    .map(i => `
      <div class="review-field">
        <span class="review-label">${escapeHtml(i.label)}</span>
        <span class="review-value">$${formatCurrency(i.amount)}</span>
      </div>
    `).join('');

  const apartmentRows = [
    ['Studio (inexpensive area)', h.studioInexpensive],
    ['Studio (near school)', h.studioNearSchool],
    ['1-Bedroom (inexpensive area)', h.oneBedInexpensive],
    ['1-Bedroom (near school)', h.oneBedNearSchool],
    ['2-Bedroom (inexpensive area)', h.twoBedInexpensive],
    ['2-Bedroom (near school)', h.twoBedNearSchool]
  ].filter(([, v]) => v > 0)
   .map(([label, v]) => `<div class="review-field"><span class="review-label">${label}</span><span class="review-value">$${formatCurrency(v)}/mo</span></div>`)
   .join('');

  const sportsHtml = [
    ['Baseball', e.baseball, e.baseballNA],
    ['Football / Soccer', e.football, e.footballNA],
    ['Basketball', e.basketball, e.basketballNA],
    [e.otherName || 'Other', e.otherCost, e.otherNA]
  ].map(([name, cost, isNA]) => {
    if (isNA) return `<div class="review-field"><span class="review-label">${escapeHtml(name)}</span><span class="review-value" style="color:var(--color-error)">N/A</span></div>`;
    if (cost) return `<div class="review-field"><span class="review-label">${escapeHtml(name)}</span><span class="review-value">$${formatCurrency(cost)}</span></div>`;
    return '';
  }).filter(Boolean).join('');

  container.innerHTML = `
    <div class="review-section">
      <h3>School Information</h3>
      <div class="review-field"><span class="review-label">School</span><span class="review-value">${escapeHtml(r.school.name)}</span></div>
      <div class="review-field"><span class="review-label">Location</span><span class="review-value">${escapeHtml(r.school.city)}, ${escapeHtml(r.school.state)}</span></div>
      ${r.school.address ? `<div class="review-field"><span class="review-label">Address</span><span class="review-value">${escapeHtml(r.school.address)}</span></div>` : ''}
      ${r.school.contactName ? `<div class="review-field"><span class="review-label">Contact</span><span class="review-value">${escapeHtml(r.school.contactName)}</span></div>` : ''}
      ${r.school.email ? `<div class="review-field"><span class="review-label">Email</span><span class="review-value">${escapeHtml(r.school.email)}</span></div>` : ''}
      ${r.school.phone ? `<div class="review-field"><span class="review-label">Phone</span><span class="review-value">${escapeHtml(r.school.phone)}</span></div>` : ''}
    </div>

    <div class="review-section">
      <h3>Health Insurance</h3>
      <div class="review-field"><span class="review-label">School offers insurance</span><span class="review-value">${r.healthInsurance.schoolOffers === true ? '<span style="color:var(--color-success)">Yes</span>' : r.healthInsurance.schoolOffers === false ? '<span style="color:var(--color-error)">No</span>' : '—'}</span></div>
      ${r.healthInsurance.schoolOffers && r.healthInsurance.monthlyCostToTeacher ? `<div class="review-field"><span class="review-label">Monthly cost to teacher</span><span class="review-value">$${formatCurrency(r.healthInsurance.monthlyCostToTeacher)}</span></div>` : ''}
      ${r.healthInsurance.monthlyPremiumEstimate ? `<div class="review-field"><span class="review-label">Monthly premium estimate</span><span class="review-value">$${formatCurrency(r.healthInsurance.monthlyPremiumEstimate)}</span></div>` : ''}
      <div class="review-field"><span class="review-label">J-2 Dependent coverage</span><span class="review-value">${r.healthInsurance.j2Offered ? (r.healthInsurance.j2DependentCost ? `$${formatCurrency(r.healthInsurance.j2DependentCost)}/mo` : 'Offered') : '<span style="color:var(--color-error)">Not offered</span>'}</span></div>
    </div>

    <div class="review-section">
      <h3>Food Costs</h3>
      <div class="review-field"><span class="review-label"><strong>Weekly Estimate per Teacher</strong></span><span class="review-value"><strong>$${formatCurrency(r.food.weeklyEstimate)}</strong></span></div>
      ${foodItemsHtml}
    </div>

    <div class="review-section">
      <h3>Tax Deductions & Fees</h3>
      ${r.taxes.federalPercent ? `<div class="review-field"><span class="review-label">Federal tax</span><span class="review-value">${escapeHtml(r.taxes.federalPercent)}%</span></div>` : ''}
      ${r.taxes.noStateTax ? `<div class="review-field"><span class="review-label">State tax</span><span class="review-value" style="color:var(--color-error)">No state income tax</span></div>` : r.taxes.statePercent ? `<div class="review-field"><span class="review-label">State tax</span><span class="review-value">${escapeHtml(r.taxes.statePercent)}%</span></div>` : ''}
      ${!r.taxes.educationEvalNotNeeded && r.taxes.educationEvaluation ? `<div class="review-field"><span class="review-label">Education Evaluation</span><span class="review-value">$${formatCurrency(r.taxes.educationEvaluation)}</span></div>` : r.taxes.educationEvalNotNeeded ? `<div class="review-field"><span class="review-label">Education Evaluation</span><span class="review-value">Not needed</span></div>` : ''}
      ${!r.taxes.noUnionFees && r.taxes.unionFees ? `<div class="review-field"><span class="review-label">Union Fees</span><span class="review-value">$${formatCurrency(r.taxes.unionFees)}/mo</span></div>` : r.taxes.noUnionFees ? `<div class="review-field"><span class="review-label">Union Fees</span><span class="review-value">No union fees</span></div>` : ''}
    </div>

    <div class="review-section">
      <h3>Housing</h3>
      <div class="review-field"><span class="review-label">Host family</span><span class="review-value">${h.hostFamily === true ? '<span style="color:var(--color-success)">Possible to arrange</span>' : h.hostFamily === false ? '<span style="color:var(--color-error)">Not provided</span>' : '—'}</span></div>
      ${apartmentRows}
      ${h.cellphone ? `<div class="review-field"><span class="review-label">Cellphone</span><span class="review-value">$${formatCurrency(h.cellphone)}/mo</span></div>` : ''}
      ${h.internet ? `<div class="review-field"><span class="review-label">Internet</span><span class="review-value">$${formatCurrency(h.internet)}/mo</span></div>` : ''}
      ${h.electricity ? `<div class="review-field"><span class="review-label">Electricity</span><span class="review-value">$${formatCurrency(h.electricity)}/mo</span></div>` : ''}
    </div>

    <div class="review-section">
      <h3>Transportation</h3>
      ${t.singleRide ? `<div class="review-field"><span class="review-label">Single ride</span><span class="review-value">$${formatCurrency(t.singleRide)}</span></div>` : ''}
      ${t.monthlyPass ? `<div class="review-field"><span class="review-label">Monthly pass</span><span class="review-value">$${formatCurrency(t.monthlyPass)}/mo</span></div>` : ''}
      ${t.leaseCost ? `<div class="review-field"><span class="review-label">Car lease</span><span class="review-value">$${formatCurrency(t.leaseCost)}</span></div>` : ''}
      ${t.usedCarCost ? `<div class="review-field"><span class="review-label">Used car</span><span class="review-value">$${formatCurrency(t.usedCarCost)}</span></div>` : ''}
      ${t.newCarDeal ? `<div class="review-field"><span class="review-label">New car deal</span><span class="review-value">${escapeHtml(t.newCarDeal)}</span></div>` : ''}
      ${t.gasPerWeek ? `<div class="review-field"><span class="review-label">Gas per week</span><span class="review-value">$${formatCurrency(t.gasPerWeek)}/wk</span></div>` : ''}
    </div>

    <div class="review-section">
      <h3>Entertainment</h3>
      ${e.movieTicket ? `<div class="review-field"><span class="review-label">Movie ticket</span><span class="review-value">$${formatCurrency(e.movieTicket)}</span></div>` : ''}
      ${sportsHtml}
    </div>
  `;

}

// ========================================
// PDF Generation
// ========================================

async function generateReport() {
  const overlay = document.getElementById('generatingOverlay');
  const statusEl = document.getElementById('generatingStatus');

  overlay.style.display = 'flex';

  try {
    const pdfBytes = await generatePDF(report, (status) => {
      statusEl.textContent = status;
    });

    const filename = generateFilename(report.school.city, report.school.name);

    statusEl.textContent = 'Downloading...';
    downloadPDF(pdfBytes, filename);

    clearDraft(DRAFT_KEY);

    statusEl.textContent = 'Complete!';
    setTimeout(() => { overlay.style.display = 'none'; }, 1000);

  } catch (error) {
    console.error('PDF generation failed:', error);
    overlay.style.display = 'none';
    showErrorWithDebugDownload(error);
  }
}

// ========================================
// Error Handling
// ========================================

function showErrorWithDebugDownload(error) {
  const overlay = document.createElement('div');
  overlay.className = 'progress-overlay';
  overlay.style.display = 'flex';

  const modal = document.createElement('div');
  modal.className = 'progress-modal error-modal';
  modal.innerHTML = `
    <p class="error-modal-title">Failed to generate PDF</p>
    <p class="error-modal-message">${escapeHtml(error.message)}</p>
    <p class="error-modal-hint">Please download the debug file and share it so we can investigate.</p>
    <div class="error-modal-actions">
      <button type="button" class="btn-primary btn-download-debug">Download Debug Info</button>
      <button type="button" class="btn-secondary btn-close-error">Close</button>
    </div>
  `;

  modal.querySelector('.btn-download-debug').addEventListener('click', () => {
    downloadDebugInfo(error);
  });
  modal.querySelector('.btn-close-error').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function downloadDebugInfo(error) {
  const debugData = {
    appVersion: APP_VERSION,
    form: 'cost-of-living',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    error: { message: error.message, stack: error.stack },
    report: _buildDraftData()
  };
  const json = JSON.stringify(debugData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `debug_cost_of_living_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ========================================
// Utilities
// ========================================

function showError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
}

function clearError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = '';
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========================================
// Currency Parsing & Formatting
// ========================================

function parseCurrency(raw) {
  if (typeof raw === 'number') return raw;
  if (!raw || typeof raw !== 'string') return 0;

  const cleaned = raw.replace(/[^0-9.,]/g, '');
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, '');
  } else if (lastComma !== -1 && lastDot === -1) {
    const afterComma = cleaned.slice(lastComma + 1);
    if (afterComma.length === 3 && !cleaned.slice(0, lastComma).includes(',')) {
      normalized = cleaned.replace(',', '');
    } else {
      normalized = cleaned.replace(/,/g, '.');
    }
  } else if (lastDot !== -1 && lastComma === -1) {
    const afterDot = cleaned.slice(lastDot + 1);
    if (afterDot.length === 3 && !cleaned.slice(0, lastDot).includes('.')) {
      normalized = cleaned.replace('.', '');
    } else {
      normalized = cleaned;
    }
  } else {
    normalized = cleaned;
  }

  const result = parseFloat(normalized);
  return isNaN(result) ? 0 : result;
}

function formatCurrency(num) {
  if (!num && num !== 0) return '';
  if (num === 0) return '';

  const hasDecimals = num % 1 !== 0;
  return num.toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
}

function _onCurrencyBlur(e) {
  const input = e.target;
  const parsed = parseCurrency(input.value);
  if (parsed === 0 && input.value.trim() === '') return;
  input.value = formatCurrency(parsed);
}
