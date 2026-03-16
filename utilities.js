/* =========================================
   WealthLens — shared.js
   Storage, currency, common utilities
   ========================================= */

// ======= CURRENCY CONFIG =======
const CURRENCIES = {
  USD: { symbol: '$',    code: 'USD', locale: 'en-US',    decimals: 0 },
  EUR: { symbol: '€',    code: 'EUR', locale: 'de-DE',    decimals: 0 },
  GBP: { symbol: '£',    code: 'GBP', locale: 'en-GB',    decimals: 0 },
  INR: { symbol: '₹',    code: 'INR', locale: 'en-IN',    decimals: 0 },
  JPY: { symbol: '¥',    code: 'JPY', locale: 'ja-JP',    decimals: 0 },
  CAD: { symbol: 'C$',   code: 'CAD', locale: 'en-CA',    decimals: 0 },
  AUD: { symbol: 'A$',   code: 'AUD', locale: 'en-AU',    decimals: 0 },
  SGD: { symbol: 'S$',   code: 'SGD', locale: 'en-SG',    decimals: 0 },
  AED: { symbol: 'د.إ',  code: 'AED', locale: 'ar-AE',    decimals: 0 },
  CHF: { symbol: 'CHF',  code: 'CHF', locale: 'de-CH',    decimals: 0 },
  MXN: { symbol: 'MX$',  code: 'MXN', locale: 'es-MX',    decimals: 0 },
  BRL: { symbol: 'R$',   code: 'BRL', locale: 'pt-BR',    decimals: 0 },
  KRW: { symbol: '₩',    code: 'KRW', locale: 'ko-KR',    decimals: 0 },
  CNY: { symbol: '¥',    code: 'CNY', locale: 'zh-CN',    decimals: 0 },
  ZAR: { symbol: 'R',    code: 'ZAR', locale: 'en-ZA',    decimals: 0 },
  NGN: { symbol: '₦',    code: 'NGN', locale: 'en-NG',    decimals: 0 },
};

// Tax brackets by currency/country
const TAX_BRACKETS = {
  USD: { // US Federal Income Tax 2024 (single filer)
    name: 'US Federal (Single)',
    brackets: [
      { upTo: 11600,  rate: 0.10 },
      { upTo: 47150,  rate: 0.12 },
      { upTo: 100525, rate: 0.22 },
      { upTo: 191950, rate: 0.24 },
      { upTo: 243725, rate: 0.32 },
      { upTo: 609350, rate: 0.35 },
      { upTo: Infinity, rate: 0.37 },
    ],
    ssRate: 0.062, medicareRate: 0.0145, ssWageCap: 168600
  },
  GBP: { // UK 2024/25
    name: 'UK (England)',
    personalAllowance: 12570,
    brackets: [
      { upTo: 12570,  rate: 0 },
      { upTo: 50270,  rate: 0.20 },
      { upTo: 125140, rate: 0.40 },
      { upTo: Infinity, rate: 0.45 },
    ],
    ni: true
  },
  EUR: { // Germany approximate
    name: 'Germany (approx)',
    brackets: [
      { upTo: 11604,  rate: 0 },
      { upTo: 17005,  rate: 0.14 },
      { upTo: 66760,  rate: 0.24 },
      { upTo: 277826, rate: 0.42 },
      { upTo: Infinity, rate: 0.45 },
    ]
  },
  INR: { // India FY2024-25 (New Regime)
    name: 'India (New Tax Regime)',
    brackets: [
      { upTo: 300000,   rate: 0 },
      { upTo: 600000,   rate: 0.05 },
      { upTo: 900000,   rate: 0.10 },
      { upTo: 1200000,  rate: 0.15 },
      { upTo: 1500000,  rate: 0.20 },
      { upTo: Infinity, rate: 0.30 },
    ],
    surcharge: true
  },
  CAD: { // Canada federal 2024
    name: 'Canada Federal',
    brackets: [
      { upTo: 55867,   rate: 0.15 },
      { upTo: 111733,  rate: 0.205 },
      { upTo: 154906,  rate: 0.26 },
      { upTo: 220000,  rate: 0.29 },
      { upTo: Infinity,rate: 0.33 },
    ]
  },
  AUD: { // Australia 2024-25
    name: 'Australia 2024-25',
    brackets: [
      { upTo: 18200,    rate: 0 },
      { upTo: 45000,    rate: 0.19 },
      { upTo: 120000,   rate: 0.325 },
      { upTo: 180000,   rate: 0.37 },
      { upTo: Infinity, rate: 0.45 },
    ]
  },
};

// Fallback flat-rate for currencies without brackets
function getTaxBrackets(currency) {
  return TAX_BRACKETS[currency] || null;
}

// ======= TAX CALCULATION =======
function calcProgressiveTax(income, brackets) {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (income <= prev) break;
    const taxable = Math.min(income, b.upTo) - prev;
    tax += taxable * b.rate;
    prev = b.upTo;
  }
  return tax;
}

function calcTaxDetails(grossAnnual, currency) {
  const config = getTaxBrackets(currency);
  let incomeTax = 0, socialSecurity = 0, medicare = 0, nationalInsurance = 0;
  let effectiveRate = 0;

  if (config) {
    incomeTax = calcProgressiveTax(grossAnnual, config.brackets);
    if (config.ssRate) {
      const ssWages = Math.min(grossAnnual, config.ssWageCap || grossAnnual);
      socialSecurity = ssWages * config.ssRate;
      medicare = grossAnnual * config.medicareRate;
      if (grossAnnual > 200000) medicare += (grossAnnual - 200000) * 0.009; // additional Medicare
    }
    if (config.ni) {
      // UK NI Class 1 Employee: 8% on £12,570–£50,270, 2% above
      const niLow = 12570, niHigh = 50270;
      nationalInsurance = 0;
      if (grossAnnual > niLow) {
        nationalInsurance += Math.min(grossAnnual, niHigh) * 0.08 - niLow * 0.08;
        if (grossAnnual > niHigh) nationalInsurance += (grossAnnual - niHigh) * 0.02;
      }
    }
  } else {
    // Flat 25% estimate
    incomeTax = grossAnnual * 0.25;
  }

  const totalTax = incomeTax + socialSecurity + medicare + nationalInsurance;
  effectiveRate = grossAnnual > 0 ? (totalTax / grossAnnual) * 100 : 0;
  const marginalRate = config ? getMarginalRate(grossAnnual, config.brackets) : 25;

  return {
    grossAnnual, incomeTax, socialSecurity, medicare, nationalInsurance,
    totalTax, netAnnual: grossAnnual - totalTax,
    effectiveRate, marginalRate,
    config: config ? config.name : 'Flat estimate (25%)'
  };
}

function getMarginalRate(income, brackets) {
  for (let i = brackets.length - 1; i >= 0; i--) {
    if (income > (i > 0 ? brackets[i-1].upTo : 0)) return brackets[i].rate * 100;
  }
  return brackets[0].rate * 100;
}

// ======= CURRENCY FORMATTING =======
function formatCurrency(amount, currency) {
  const cfg = CURRENCIES[currency] || CURRENCIES.USD;
  try {
    return new Intl.NumberFormat(cfg.locale, {
      style: 'currency',
      currency: cfg.code,
      minimumFractionDigits: cfg.decimals,
      maximumFractionDigits: cfg.decimals,
    }).format(amount);
  } catch(e) {
    return cfg.symbol + Math.round(amount).toLocaleString();
  }
}

function formatNum(n, decimals=0) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function getCurrencySymbol(currency) {
  return (CURRENCIES[currency] || CURRENCIES.USD).symbol;
}

// ======= LOCALSTORAGE HELPERS =======
const LS_PREFIX = 'wl_';

function getSetting(key) {
  try { return localStorage.getItem(LS_PREFIX + key); } catch(e) { return null; }
}

function setSetting(key, val) {
  try { localStorage.setItem(LS_PREFIX + key, val); } catch(e) {}
}

function getJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch(e) { return fallback; }
}

function setJSON(key, val) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(val)); } catch(e) {}
}

function getAccounts() {
  return getJSON('accounts', []);
}

function saveAccounts(accounts) {
  setJSON('accounts', accounts);
}

function getExpenses() {
  return getJSON('expenses', []);
}

function saveExpenses(expenses) {
  setJSON('expenses', expenses);
}

function setSalaryData(data) {
  setJSON('salaryData', data);
  if (data.salary)  setSetting('salary',  data.salary);
  if (data.taxRate) setSetting('taxRate', data.taxRate);
}

function getSalaryData() {
  return getJSON('salaryData', {
    salary: 0, taxRate: 25, freq: 12,
    k401: 0, healthIns: 0, fsa: 0, hsa: 0, otherPretax: 0,
    postTaxDeduct: 0, overtimePay: 0, bonusPay: 0, sideIncome: 0
  });
}

function getBudgetData() {
  return getJSON('budgetData', {
    rule: '50-30-20',
    customBuckets: [
      { name:'Needs', pct:50, color:'#22c98a' },
      { name:'Wants', pct:30, color:'#60a5fa' },
      { name:'Savings', pct:20, color:'#c084fc' },
    ]
  });
}

function setBudgetData(data) {
  setJSON('budgetData', data);
  if (data.rule) setSetting('budgetRule', data.rule);
  if (data.savingsPct) setSetting('savingsPct', data.savingsPct);
}

// ======= CURRENCY CHANGE =======
function setCurrency(code) {
  setSetting('currency', code);
  const badge = document.getElementById('currency-badge');
  if (badge) badge.textContent = code;
  // reload page to refresh all numbers
  window.location.reload();
}

// ======= INIT CURRENCY SELECTORS =======
document.addEventListener('DOMContentLoaded', () => {
  const cur = getSetting('currency') || 'USD';
  const selectors = document.querySelectorAll('.currency-select, #globalCurrency');
  selectors.forEach(s => { if (s) s.value = cur; });
  const badge = document.getElementById('currency-badge');
  if (badge) badge.textContent = cur;
});

// ======= COMMON FINANCIAL CALCULATIONS =======

// Compound interest: FV = PV*(1+r/n)^(n*t) + PMT * [(1+r/n)^(n*t) - 1] / (r/n)
function calcFutureValue(pv, annualRate, years, monthlyContrib = 0) {
  if (annualRate === 0) return pv + monthlyContrib * 12 * years;
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const fv = pv * Math.pow(1 + r, n) + monthlyContrib * (Math.pow(1 + r, n) - 1) / r;
  return fv;
}

// Loan payment: PMT = P * r * (1+r)^n / [(1+r)^n - 1]
function calcLoanPayment(principal, annualRate, years) {
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 100 / 12;
  const n = years * 12;
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

// Loan amortization — returns array of { month, payment, principal, interest, balance }
function calcAmortization(principal, annualRate, years) {
  const payment = calcLoanPayment(principal, annualRate, years);
  const r = annualRate / 100 / 12;
  let balance = principal;
  const schedule = [];
  for (let m = 1; m <= years * 12; m++) {
    const interest = balance * r;
    const principalPaid = payment - interest;
    balance -= principalPaid;
    schedule.push({ month: m, payment, principal: principalPaid, interest, balance: Math.max(0, balance) });
  }
  return schedule;
}

// FIRE number: 25× annual expenses (4% rule)
function calcFIRENumber(monthlyExpenses) {
  return monthlyExpenses * 12 * 25;
}

// Years to FIRE
function calcYearsToFIRE(currentSavings, monthlyContrib, annualReturn, fireNumber) {
  if (currentSavings >= fireNumber) return 0;
  const r = annualReturn / 100 / 12;
  let bal = currentSavings;
  for (let m = 0; m <= 600; m++) {
    if (bal >= fireNumber) return m / 12;
    bal = bal * (1 + r) + monthlyContrib;
  }
  return null; // > 50 years
}

// Net worth by age rule: net worth should equal annual_salary × ((age - 25) / 10)
function netWorthByAgeTarget(salary, age) {
  return salary * Math.max(0, (age - 25) / 10);
}

// Debt payoff — avalanche (highest interest first) or snowball (lowest balance first)
function calcDebtPayoff(debts, monthlyPayment, method = 'avalanche') {
  let ds = debts.map(d => ({ ...d }));
  const sorted = method === 'avalanche'
    ? [...ds].sort((a,b) => b.rate - a.rate)
    : [...ds].sort((a,b) => a.balance - b.balance);

  let months = 0;
  let totalInterest = 0;
  const balances = ds.map(d => d.balance);

  for (let m = 0; m < 600; m++) {
    if (sorted.every(d => d.balance <= 0)) break;
    // Min payments on all
    let remaining = monthlyPayment;
    sorted.forEach(d => {
      if (d.balance <= 0) return;
      const interest = d.balance * (d.rate/100/12);
      const minPay = Math.min(d.minPayment || interest + 1, d.balance + interest);
      const pay = Math.min(minPay, remaining);
      totalInterest += interest;
      d.balance = d.balance + interest - pay;
      remaining -= pay;
    });
    // Apply remaining to first non-zero
    for (const d of sorted) {
      if (d.balance > 0 && remaining > 0) {
        const pay = Math.min(remaining, d.balance);
        d.balance -= pay;
        remaining -= pay;
      }
    }
    months = m + 1;
  }
  return { months, totalInterest, years: months / 12 };
}

// Convert annual to per-frequency
function freqLabel(freqVal) {
  return { 12: 'month', 24: 'semi-month', 26: 'bi-week', 52: 'week', 365: 'day' }[freqVal] || 'period';
}

// Format large numbers concisely
function fmtShort(n, cur) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const sym = getCurrencySymbol(cur);
  if (abs >= 1e9) return sign + sym + (abs/1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return sign + sym + (abs/1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return sign + sym + (abs/1e3).toFixed(0) + 'K';
  return formatCurrency(n, cur);
}

// Savings rate % of gross
function savingsRatePct(monthlySavings, monthlyGross) {
  return monthlyGross > 0 ? (monthlySavings / monthlyGross) * 100 : 0;
}