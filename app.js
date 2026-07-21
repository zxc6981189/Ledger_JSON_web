/**
 * Expense Tracker - Telegram Mini App
 * Application Logic & Calculator State Machine
 */

// --- Constants & State ---
const DEFAULT_CATEGORIES = [
  { id: 'food', name: '食物', emoji: '🍱', isDefault: true },
  { id: 'transport', name: '交通', emoji: '🚗', isDefault: true },
  { id: 'shopping', name: '購物', emoji: '🛍️', isDefault: true },
  { id: 'sports', name: '運動', emoji: '🏃', isDefault: true },
  { id: 'rent', name: '租屋', emoji: '🏠', isDefault: true },
  { id: 'travel', name: '旅遊', emoji: '✈️', isDefault: true }
];

let categories = [];
let selectedCategoryId = null;
let expenseItems = []; // Session items ledger state

// Calculator State
let calcExpression = '';
let calcResult = '0';
let lastInputWasOperator = false;

// New Category Modal State
let selectedModalEmoji = '🍔';

// --- DOM Elements ---
const elDate = document.getElementById('expense-date');
const elCategoryGrid = document.getElementById('category-grid');
const elAmount = document.getElementById('expense-amount');
const elDesc = document.getElementById('expense-desc');
const elJsonOutput = document.getElementById('json-output');
const elPreviewCard = document.getElementById('preview-card');
const elPreviewStatus = document.getElementById('preview-status');
const elToastContainer = document.getElementById('toast-container');

// Ledger Elements
const btnAddItem = document.getElementById('btn-add-item');
const btnClearLedger = document.getElementById('btn-clear-ledger');
const elLedgerSection = document.getElementById('ledger-section');
const elLedgerList = document.getElementById('ledger-list');
const elLedgerCount = document.getElementById('ledger-count');
const elLedgerTotal = document.getElementById('ledger-total');

// Buttons & Modals
const btnAddCategory = document.getElementById('btn-add-category');
const btnResetCategories = document.getElementById('btn-reset-categories');
const btnOpenCalc = document.getElementById('btn-open-calc');
const btnGenerateJson = document.getElementById('btn-generate-json');

// Calculator Elements
const elCalcOverlay = document.getElementById('calc-overlay');
const elCalcBackdrop = document.getElementById('calc-backdrop');
const elCalcClose = document.getElementById('btn-close-calc');
const elCalcExpression = document.getElementById('calc-expression');
const elCalcResult = document.getElementById('calc-result');

// Modal Elements
const elCategoryModal = document.getElementById('category-modal');
const elBtnCloseModal = document.getElementById('btn-close-modal');
const elBtnCancelCategory = document.getElementById('btn-cancel-category');
const elBtnSaveCategory = document.getElementById('btn-save-category');
const elNewCategoryName = document.getElementById('new-category-name');
const elEmojiSelector = document.getElementById('emoji-selector');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initDate();
  initTelegramMiniApp();
  loadCategories();
  renderCategories();
  initCalculatorEvents();
  initModalEvents();
  
  // Amount field click triggers calculator
  if (elAmount) elAmount.addEventListener('click', openCalculator);
  if (btnOpenCalc) {
    btnOpenCalc.addEventListener('click', (e) => {
      e.stopPropagation();
      openCalculator();
    });
  }
  
  // Reset categories action
  if (btnResetCategories) btnResetCategories.addEventListener('click', resetCategories);
  
  // Add item action
  if (btnAddItem) btnAddItem.addEventListener('click', addItem);
  
  // Clear ledger action
  if (btnClearLedger) btnClearLedger.addEventListener('click', clearLedger);
  
  // Submit action
  if (btnGenerateJson) btnGenerateJson.addEventListener('click', generateAndCopyJSON);
  
  // Initial draw of ledger
  renderLedger();
});

// Set default date to today in local timezone
function initDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  elDate.value = `${year}-${month}-${day}`;
}

// Telegram Mini App API Integration (Safe check)
function initTelegramMiniApp() {
  if (window.Telegram && window.Telegram.WebApp) {
    const webapp = window.Telegram.WebApp;
    webapp.ready();
    webapp.expand(); // Expand mini app to full height
    
    // Adapt theme colors if Telegram provides them
    if (webapp.colorScheme === 'light') {
      document.body.classList.add('telegram-light');
    }
    
    // Listen to theme changes
    webapp.onEvent('themeChanged', () => {
      if (webapp.colorScheme === 'light') {
        document.body.classList.add('telegram-light');
      } else {
        document.body.classList.remove('telegram-light');
      }
    });
  }
}

// --- Categories Management ---
function loadCategories() {
  const storedVersion = localStorage.getItem('categories_version');
  const CURRENT_VERSION = 'v3_new_default_list';
  
  if (storedVersion !== CURRENT_VERSION) {
    categories = DEFAULT_CATEGORIES.map(cat => ({ ...cat }));
    saveCategoriesToStorage();
    localStorage.setItem('categories_version', CURRENT_VERSION);
  } else {
    const stored = localStorage.getItem('expense_categories');
    if (stored) {
      try {
        categories = JSON.parse(stored);
      } catch (e) {
        categories = DEFAULT_CATEGORIES.map(cat => ({ ...cat }));
      }
    } else {
      categories = DEFAULT_CATEGORIES.map(cat => ({ ...cat }));
      saveCategoriesToStorage();
    }
  }
  
  // Set default selection to the first item
  if (categories.length > 0) {
    selectedCategoryId = categories[0].id;
  }
}

function saveCategoriesToStorage() {
  localStorage.setItem('expense_categories', JSON.stringify(categories));
}

function renderCategories() {
  elCategoryGrid.innerHTML = '';
  
  categories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = `category-chip ${selectedCategoryId === cat.id ? 'active' : ''}`;
    chip.setAttribute('data-id', cat.id);
    
    chip.innerHTML = `
      <span class="chip-emoji">${cat.emoji}</span>
      <span class="chip-name">${cat.name}</span>
    `;
    
    // Add delete button for categories
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chip-delete-btn';
    deleteBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    deleteBtn.title = '刪除此項目';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCategory(cat.id);
    });
    chip.appendChild(deleteBtn);
    
    chip.addEventListener('click', () => {
      selectCategory(cat.id);
    });
    
    elCategoryGrid.appendChild(chip);
  });
}

function selectCategory(id) {
  selectedCategoryId = id;
  // Update UI selection state
  document.querySelectorAll('.category-chip').forEach(chip => {
    if (chip.getAttribute('data-id') === id) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  updateJSONPreview();
}

function deleteCategory(id) {
  categories = categories.filter(cat => cat.id !== id);
  saveCategoriesToStorage();
  
  // If deleted category was selected, fallback to the first default one
  if (selectedCategoryId === id) {
    selectedCategoryId = categories[0]?.id || null;
  }
  
  renderCategories();
  updateJSONPreview();
  showToast('項目已刪除', 'success');
}

function resetCategories() {
  const urlParams = new URLSearchParams(window.location.search);
  const isTest = urlParams.get('test') === 'true';
  
  if (isTest || confirm('確定要將花費項目重置為預設設定嗎？（這將會清除您新增的所有自訂項目）')) {
    categories = DEFAULT_CATEGORIES.map(cat => ({ ...cat }));
    saveCategoriesToStorage();
    
    if (categories.length > 0) {
      selectedCategoryId = categories[0].id;
    } else {
      selectedCategoryId = null;
    }
    
    renderCategories();
    updateJSONPreview();
    showToast('項目已重置為預設設定', 'success');
  }
}

// --- Calculator State & Operations ---
function openCalculator() {
  // Reset calculator layout state with current amount if numeric
  const currentVal = elAmount.value;
  if (currentVal && !isNaN(currentVal) && parseFloat(currentVal) > 0) {
    calcResult = currentVal;
    calcExpression = '';
  } else {
    calcResult = '0';
    calcExpression = '';
  }
  
  updateCalcDisplay();
  elCalcOverlay.classList.add('open');
  document.body.style.overflow = 'hidden'; // Lock background scroll
}

function closeCalculator() {
  const calculated = runCalculation();
  if (!isNaN(calculated) && calculated > 0) {
    elAmount.value = calculated;
    updateJSONPreview();
  }
  
  elCalcOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

function initCalculatorEvents() {
  elCalcClose.addEventListener('click', closeCalculator);
  elCalcBackdrop.addEventListener('click', closeCalculator);
  
  // Handle keypad inputs
  document.querySelectorAll('.calc-btn').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-key');
      handleCalculatorInput(key, button.innerText);
    });
  });
}

function handleCalculatorInput(key, label) {
  if (!key) return;
  
  // Number inputs
  if (buttonIsNum(key)) {
    if (calcResult === '0' && key !== '.') {
      calcResult = key;
    } else if (key === '.' && calcResult.includes('.')) {
      // Ignore multiple decimals in current number segment
      return;
    } else {
      calcResult += key;
    }
    lastInputWasOperator = false;
  } 
  // Operator inputs
  else if (key === '+' || key === '-' || key === '*' || key === '/') {
    // If expression is empty and result is non-zero, chain it
    if (calcExpression === '' && calcResult !== '0') {
      calcExpression = `${calcResult} ${label} `;
      calcResult = '0';
    } 
    // If last input was operator, replace it
    else if (lastInputWasOperator) {
      calcExpression = calcExpression.substring(0, calcExpression.length - 3) + ` ${label} `;
    } 
    // Append operator and push result to expression
    else {
      calcExpression += `${calcResult} ${label} `;
      calcResult = '0';
    }
    lastInputWasOperator = true;
  } 
  // Clear function
  else if (key === 'clear') {
    calcExpression = '';
    calcResult = '0';
    lastInputWasOperator = false;
  } 
  // Backspace function
  else if (key === 'backspace') {
    if (calcResult.length > 1) {
      calcResult = calcResult.substring(0, calcResult.length - 1);
    } else {
      calcResult = '0';
    }
    lastInputWasOperator = false;
  } 
  // Equal / Confirm function
  else if (key === 'equal') {
    const finalVal = runCalculation();
    if (isNaN(finalVal) || finalVal < 0) {
      showToast('無效的計算金額', 'error');
      return;
    }
    
    // Save to main input and close
    elAmount.value = finalVal;
    closeCalculator();
    updateJSONPreview();
    showToast(`金額已設定為 $${finalVal}`, 'success');
    return;
  }
  
  updateCalcDisplay();
}

function buttonIsNum(key) {
  return !isNaN(key) || key === '.';
}

function updateCalcDisplay() {
  // Convert operators for nice display formatting
  const displayExpr = calcExpression
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/-/g, ' − ');
    
  elCalcExpression.innerText = displayExpr;
  elCalcResult.innerText = calcResult;
}

function runCalculation() {
  let fullExpression = calcExpression + calcResult;
  
  // Sanitize expression characters
  let parsedExpr = fullExpression
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/&times;/g, '*')
    .replace(/&divide;/g, '/')
    .replace(/&minus;/g, '-');
  
  // Safe math parsing: only allow digits, arithmetic symbols, decimals, and spaces
  if (!/^[0-9.+\-*/\s]+$/.test(parsedExpr)) {
    return NaN;
  }
  
  try {
    // Basic calculation execution
    const evaluated = new Function(`return (${parsedExpr})`)();
    if (typeof evaluated === 'number' && isFinite(evaluated)) {
      // Round to 2 decimal places max
      return Math.round(evaluated * 100) / 100;
    }
  } catch (err) {
    return NaN;
  }
  return NaN;
}

// --- Custom Category Modal Dialog ---
function initModalEvents() {
  btnAddCategory.addEventListener('click', () => {
    elNewCategoryName.value = '';
    selectedModalEmoji = '🍔';
    // Reset emoji states in modal selector
    document.querySelectorAll('.emoji-option').forEach(opt => {
      if (opt.getAttribute('data-emoji') === '🍔') {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
    
    elCategoryModal.classList.add('open');
    elNewCategoryName.focus();
  });
  
  const closeModal = () => {
    elCategoryModal.classList.remove('open');
  };
  
  elBtnCloseModal.addEventListener('click', closeModal);
  elBtnCancelCategory.addEventListener('click', closeModal);
  
  // Emoji select click
  elEmojiSelector.querySelectorAll('.emoji-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedModalEmoji = opt.getAttribute('data-emoji');
    });
  });
  
  // Save Category
  elBtnSaveCategory.addEventListener('click', () => {
    const name = elNewCategoryName.value.trim();
    if (!name) {
      showToast('請輸入項目名稱', 'error');
      return;
    }
    
    const newId = 'custom_' + Date.now();
    const newCategory = {
      id: newId,
      name: name,
      emoji: selectedModalEmoji,
      isDefault: false
    };
    
    categories.push(newCategory);
    saveCategoriesToStorage();
    selectedCategoryId = newId;
    
    renderCategories();
    closeModal();
    updateJSONPreview();
    showToast(`項目「${name}」新增成功`, 'success');
  });
}

// --- Ledger List Management ---
function addItem() {
  const amountVal = parseFloat(elAmount.value) || 0;
  const descVal = elDesc.value.trim();
  
  if (amountVal <= 0) {
    showToast('請輸入大於 0 的金額', 'error');
    openCalculator();
    return;
  }
  
  if (!selectedCategoryId) {
    showToast('請選擇一個項目分類', 'error');
    return;
  }
  
  const selectedCat = categories.find(cat => cat.id === selectedCategoryId);
  const categoryStr = selectedCat ? `${selectedCat.name} ${selectedCat.emoji}` : '未分類';
  
  const newItem = {
    category: categoryStr,
    amount: amountVal,
    description: descVal
  };
  
  expenseItems.push(newItem);
  
  // Reset input fields
  elAmount.value = '';
  elDesc.value = '';
  
  // Render ledger and update preview
  renderLedger();
  updateJSONPreview();
  showToast('已加入明細', 'success');
  
  // Trigger small haptic tick if in Telegram
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
    window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
  }
}

function renderLedger() {
  elLedgerList.innerHTML = '';
  
  if (expenseItems.length === 0) {
    elLedgerSection.style.display = 'none';
    btnGenerateJson.disabled = true;
    updateJSONPreview();
    return;
  }
  
  elLedgerSection.style.display = 'block';
  btnGenerateJson.disabled = false;
  
  let totalSum = 0;
  
  expenseItems.forEach((item, index) => {
    totalSum += item.amount;
    
    // Extract emoji and name
    const emojiMatch = item.category.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji}/u);
    const emoji = emojiMatch ? emojiMatch[0] : '📝';
    const name = item.category.replace(emoji, '').trim();
    
    const row = document.createElement('div');
    row.className = 'ledger-item';
    row.innerHTML = `
      <div class="ledger-item-info">
        <span class="ledger-item-emoji">${emoji}</span>
        <div class="ledger-item-details">
          <span class="ledger-item-name">${name}</span>
          ${item.description ? `<span class="ledger-item-desc">${item.description}</span>` : ''}
        </div>
      </div>
      <div class="ledger-item-actions">
        <span class="ledger-item-amount">$${item.amount}</span>
        <button type="button" class="ledger-item-delete" onclick="deleteLedgerItem(${index})">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
    elLedgerList.appendChild(row);
  });
  
  elLedgerCount.innerText = expenseItems.length;
  elLedgerTotal.innerText = `$${totalSum}`;
}

// Attach to window so it is accessible from inline onclick attribute
function deleteLedgerItem(index) {
  const removed = expenseItems.splice(index, 1);
  renderLedger();
  updateJSONPreview();
  showToast(`已刪除「${removed[0].category.split(' ')[0]}」花費項目`, 'success');
}
window.deleteLedgerItem = deleteLedgerItem;

function clearLedger() {
  if (expenseItems.length === 0) return;
  
  if (confirm('確定要清空今天已加入的所有明細嗎？')) {
    expenseItems = [];
    renderLedger();
    updateJSONPreview();
    showToast('明細已清空', 'success');
  }
}

// --- JSON Compilation and Clipboard Copy ---
function getFormData() {
  const dateVal = elDate.value;
  const totalVal = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  
  return {
    date: dateVal,
    items: expenseItems,
    total: totalVal
  };
}

function updateJSONPreview() {
  const data = getFormData();
  elJsonOutput.innerText = JSON.stringify(data, null, 2);
  
  // Reset visual copy status label
  elPreviewStatus.innerText = '未複製';
  elPreviewStatus.classList.remove('copied');
}

// Add simple listeners on fields to live-update preview
elDate.addEventListener('change', updateJSONPreview);
elAmount.addEventListener('input', updateJSONPreview);
elDesc.addEventListener('input', updateJSONPreview);

function generateAndCopyJSON() {
  if (expenseItems.length === 0) {
    showToast('請先新增花費項目到明細中！', 'error');
    return;
  }
  
  const data = getFormData();
  const jsonStr = JSON.stringify(data, null, 2);
  
  // Clipboard copy API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(jsonStr)
      .then(() => {
        handleCopySuccess(jsonStr);
      })
      .catch(err => {
        fallbackCopyText(jsonStr);
      });
  } else {
    fallbackCopyText(jsonStr);
  }
}

function handleCopySuccess(jsonStr) {
  // Update Preview UI state
  elJsonOutput.innerText = jsonStr;
  elPreviewStatus.innerText = '已複製';
  elPreviewStatus.classList.add('copied');
  
  showToast('JSON 已成功複製到剪貼簿！', 'success');
  
  // If in Telegram Mini App, provide haptic feedback if available and close/notify
  if (window.Telegram && window.Telegram.WebApp) {
    const webapp = window.Telegram.WebApp;
    if (webapp.HapticFeedback) {
      webapp.HapticFeedback.notificationOccurred('success');
    }
  }
}

function fallbackCopyText(text) {
  // Fallback for older browsers or nested webviews
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed'; // prevent scrolling
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    const successful = document.execCommand('copy');
    if (successful) {
      handleCopySuccess(text);
    } else {
      showToast('複製失敗，請手動複製', 'error');
    }
  } catch (err) {
    showToast('瀏覽器不支援自動複製', 'error');
  }
  
  document.body.removeChild(textArea);
}

// --- Toast Manager ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : ''}`;
  
  const icon = type === 'error' 
    ? '<i class="fa-solid fa-circle-exclamation"></i>' 
    : '<i class="fa-solid fa-circle-check"></i>';
    
  toast.innerHTML = `${icon} <span>${message}</span>`;
  elToastContainer.appendChild(toast);
  
  // Auto remove after animation completes (2.5s)
  setTimeout(() => {
    toast.remove();
  }, 2500);
}
