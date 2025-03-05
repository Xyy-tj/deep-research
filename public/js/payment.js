/**
 * Payment functionality for Deep Research
 */
import { Auth } from './auth.js';

// Payment state
const paymentState = {
  packages: [],
  selectedPackage: null,
  customAmount: null,
  paymentMethod: 'wxpay',
  currentOrder: null,
  paymentInterval: null
};

// Initialize payment functionality
async function initPayment() {
  // Fetch credit packages
  try {
    const response = await fetch('/api/payment/packages', {
      headers: {
        'Authorization': `Bearer ${await Auth.getInstance().getTokenAsync()}`
      }
    });
    const data = await response.json();
    paymentState.packages = data.packages;
    renderCreditPackages();
  } catch (error) {
    console.error('Failed to fetch credit packages:', error);
  }

  // Add event listener for recharge button
  const rechargeBtn = document.getElementById('rechargeBtn');
  if (rechargeBtn) {
    rechargeBtn.addEventListener('click', showRechargeModal);
  }

  // Initialize recharge modal
  initRechargeModal();
}

// Render credit packages
function renderCreditPackages() {
  const packagesContainer = document.getElementById('creditPackages');
  if (!packagesContainer) return;

  packagesContainer.innerHTML = '';

  // Add packages
  paymentState.packages.forEach(pkg => {
    const packageElement = document.createElement('div');
    packageElement.className = 'credit-package';
    packageElement.dataset.packageId = pkg.id;
    packageElement.innerHTML = `
      <div class="package-credits">${pkg.credits}</div>
      <div class="package-price">¥${pkg.price.toFixed(2)}</div>
    `;
    packageElement.addEventListener('click', () => selectPackage(pkg.id));
    packagesContainer.appendChild(packageElement);
  });

  // Add custom amount option
  const customPackage = document.createElement('div');
  customPackage.className = 'credit-package custom-package';
  customPackage.innerHTML = `
    <div class="package-credits">自定义</div>
    <div class="package-price">Custom</div>
  `;
  customPackage.addEventListener('click', showCustomAmountInput);
  packagesContainer.appendChild(customPackage);
}

// Select a credit package
function selectPackage(packageId) {
  // Clear custom amount
  paymentState.customAmount = null;
  document.getElementById('customAmountContainer').classList.add('hidden');
  
  // Update selected package
  paymentState.selectedPackage = packageId;
  
  // Update UI
  const packages = document.querySelectorAll('.credit-package');
  packages.forEach(pkg => {
    if (parseInt(pkg.dataset.packageId) === packageId) {
      pkg.classList.add('selected');
    } else {
      pkg.classList.remove('selected');
    }
  });
  
  // Update summary
  updatePaymentSummary();
}

// Show custom amount input
function showCustomAmountInput() {
  // Clear selected package
  paymentState.selectedPackage = null;
  
  // Update UI
  const packages = document.querySelectorAll('.credit-package');
  packages.forEach(pkg => pkg.classList.remove('selected'));
  
  document.querySelector('.custom-package').classList.add('selected');
  document.getElementById('customAmountContainer').classList.remove('hidden');
  document.getElementById('customAmount').focus();
  
  // Update summary
  updatePaymentSummary();
}

// Update payment summary based on selection
function updatePaymentSummary() {
  const summaryElement = document.getElementById('paymentSummary');
  if (!summaryElement) return;
  
  let amount = 0;
  let credits = 0;
  
  if (paymentState.selectedPackage) {
    const selectedPackage = paymentState.packages.find(pkg => pkg.id === paymentState.selectedPackage);
    if (selectedPackage) {
      amount = selectedPackage.price;
      credits = selectedPackage.credits;
    }
  } else if (paymentState.customAmount) {
    amount = paymentState.customAmount;
    // Estimate credits (10 credits per yuan)
    credits = Math.floor(amount * 10);
  }
  
  if (amount > 0) {
    summaryElement.innerHTML = `
      <div class="summary-item">
        <span>Amount:</span>
        <span>¥${amount.toFixed(2)}</span>
      </div>
      <div class="summary-item">
        <span>Credits:</span>
        <span>${credits}</span>
      </div>
    `;
    document.getElementById('paymentSubmitBtn').disabled = false;
  } else {
    summaryElement.innerHTML = '<div class="text-gray-500">Please select a package or enter a custom amount</div>';
    document.getElementById('paymentSubmitBtn').disabled = true;
  }
}

// Handle custom amount input
function handleCustomAmountChange(event) {
  const amount = parseFloat(event.target.value);
  if (!isNaN(amount) && amount > 0) {
    paymentState.customAmount = amount;
  } else {
    paymentState.customAmount = null;
  }
  updatePaymentSummary();
}

// Initialize recharge modal
function initRechargeModal() {
  // Get modal elements
  const modal = document.getElementById('rechargeModal');
  const closeBtn = document.getElementById('closeRechargeModal');
  const customAmountInput = document.getElementById('customAmount');
  const paymentForm = document.getElementById('paymentForm');
  
  // Add event listeners
  if (closeBtn) {
    closeBtn.addEventListener('click', hideRechargeModal);
  }
  
  if (customAmountInput) {
    customAmountInput.addEventListener('input', handleCustomAmountChange);
  }
  
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmit);
  }
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      hideRechargeModal();
    }
  });
}

// Show recharge modal
function showRechargeModal() {
  const modal = document.getElementById('rechargeModal');
  if (modal) {
    modal.classList.remove('hidden');
    // Reset state
    paymentState.selectedPackage = null;
    paymentState.customAmount = null;
    
    // Reset UI
    const packages = document.querySelectorAll('.credit-package');
    packages.forEach(pkg => pkg.classList.remove('selected'));
    document.getElementById('customAmountContainer').classList.add('hidden');
    document.getElementById('customAmount').value = '';
    document.getElementById('paymentSummary').innerHTML = '<div class="text-gray-500">Please select a package or enter a custom amount</div>';
    document.getElementById('paymentSubmitBtn').disabled = true;
    
    // Hide payment result and QR code
    document.getElementById('paymentResult').classList.add('hidden');
    document.getElementById('qrCodeContainer').classList.add('hidden');
    document.getElementById('paymentOptions').classList.remove('hidden');
  }
}

// Hide recharge modal
function hideRechargeModal() {
  const modal = document.getElementById('rechargeModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Clear payment check interval
    if (paymentState.paymentInterval) {
      clearInterval(paymentState.paymentInterval);
      paymentState.paymentInterval = null;
    }
  }
}

// Handle payment form submission
async function handlePaymentSubmit(event) {
  event.preventDefault();
  
  try {
    // Show loading state
    const submitBtn = document.getElementById('paymentSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    // Prepare payment data
    const paymentData = {
      paymentMethod: paymentState.paymentMethod
    };
    
    if (paymentState.selectedPackage) {
      paymentData.packageId = paymentState.selectedPackage;
    } else if (paymentState.customAmount) {
      paymentData.customAmount = paymentState.customAmount;
    } else {
      throw new Error('Please select a package or enter a custom amount');
    }
    
    // Send payment request
    const response = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await Auth.getInstance().getTokenAsync()}`
      },
      body: JSON.stringify(paymentData)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create payment order');
    }
    
    // Handle successful order creation
    paymentState.currentOrder = result.orderId;
    
    // Show payment QR code
    document.getElementById('paymentOptions').classList.add('hidden');
    document.getElementById('qrCodeContainer').classList.remove('hidden');
    
    // Generate QR code
    const qrCodeElement = document.getElementById('paymentQrCode');
    qrCodeElement.innerHTML = '';
    
    if (result.payUrl) {
      // Create QR code
      new QRCode(qrCodeElement, {
        text: result.payUrl,
        width: 256,
        height: 256,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
      
      // Show payment info
      const paymentAmountElement = document.getElementById('paymentAmount');
      const paymentCreditsElement = document.getElementById('paymentCredits');
      
      if (paymentAmountElement) {
        paymentAmountElement.textContent = `${result.amount.toFixed(2)}`;
      }
      
      if (paymentCreditsElement) {
        paymentCreditsElement.textContent = result.credits;
      }
      
      // Start checking payment status
      startCheckingPaymentStatus(result.orderId);
    } else {
      throw new Error('No payment URL returned');
    }
  } catch (error) {
    console.error('Payment error:', error);
    
    // Show error message
    document.getElementById('paymentResult').classList.remove('hidden');
    document.getElementById('paymentResultMessage').textContent = error.message || 'Payment processing failed';
    document.getElementById('paymentResultMessage').classList.add('text-red-500');
    document.getElementById('paymentResultIcon').innerHTML = '<i class="fas fa-times-circle text-red-500 text-5xl"></i>';
  } finally {
    // Reset button state
    const submitBtn = document.getElementById('paymentSubmitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Pay Now';
  }
}

// Start checking payment status
function startCheckingPaymentStatus(orderId) {
  // Clear any existing interval
  if (paymentState.paymentInterval) {
    clearInterval(paymentState.paymentInterval);
  }
  
  // Check immediately
  checkPaymentStatus(orderId);
  
  // Then check every 5 seconds
  paymentState.paymentInterval = setInterval(() => {
    checkPaymentStatus(orderId);
  }, 5000);
}

// Check payment status
async function checkPaymentStatus(orderId) {
  try {
    console.log(`Checking payment status for order: ${orderId}`);
    const response = await fetch(`/api/payment/check-status/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${await Auth.getInstance().getTokenAsync()}`
      }
    });
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to check payment status');
    }
    
    console.log(`Payment status check result:`, result);
    
    // If payment is completed
    if (result.status === 'completed') {
      // Show success message
      document.getElementById('qrCodeContainer').classList.add('hidden');
      document.getElementById('paymentResult').classList.remove('hidden');
      document.getElementById('paymentResultMessage').textContent = `Payment successful! ${result.credits} credits have been added to your account.`;
      document.getElementById('paymentResultMessage').classList.remove('text-red-500');
      document.getElementById('paymentResultIcon').innerHTML = '<i class="fas fa-check-circle text-green-500 text-5xl"></i>';
      
      // Update user balance
      if (window.updateBalance) {
        window.updateBalance();
      }
      
      // Clear interval
      clearInterval(paymentState.paymentInterval);
      paymentState.paymentInterval = null;
    } else if (result.status === 'failed') {
      // Show failure message
      document.getElementById('qrCodeContainer').classList.add('hidden');
      document.getElementById('paymentResult').classList.remove('hidden');
      document.getElementById('paymentResultMessage').textContent = `Payment failed. Please try again.`;
      document.getElementById('paymentResultMessage').classList.add('text-red-500');
      document.getElementById('paymentResultIcon').innerHTML = '<i class="fas fa-times-circle text-red-500 text-5xl"></i>';
      
      // Clear interval
      clearInterval(paymentState.paymentInterval);
      paymentState.paymentInterval = null;
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
  }
}

// Function to check if user is logged in
function isUserLoggedIn() {
  return Auth.getInstance().isAuthenticated;
}

// Document ready
document.addEventListener('DOMContentLoaded', function() {
  // Initialize payment functionality if user is logged in
  if (isUserLoggedIn()) {
    initPayment();
  } else {
    // If not logged in initially, listen for auth changes
    document.addEventListener('authStateChanged', function(e) {
      if (e.detail.isAuthenticated) {
        initPayment();
      }
    });
  }
});

export { initPayment, isUserLoggedIn };
