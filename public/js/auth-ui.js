import { Auth } from './auth.js';

// Initialize auth module
const auth = Auth.getInstance();

// DOM Elements
let userSection, authSection, authModal, authForm, authModalTitle, 
    loginBtn, registerBtn, closeAuthModal, mainContent, welcomePage, 
    emailVerification, authSubmitBtnText;

document.addEventListener('DOMContentLoaded', () => {
    // Get DOM elements
    userSection = document.getElementById('userSection');
    authSection = document.getElementById('authSection');
    authModal = document.getElementById('authModal');
    authForm = document.getElementById('authForm');
    authModalTitle = document.getElementById('authModalTitle');
    loginBtn = document.getElementById('loginBtn');
    registerBtn = document.getElementById('registerBtn');
    closeAuthModal = document.getElementById('closeAuthModal');
    mainContent = document.getElementById('mainContent');
    welcomePage = document.getElementById('welcomePage');
    emailVerification = document.getElementById('emailVerification');
    authSubmitBtnText = document.getElementById('authSubmitBtnText');

    // Show/hide auth modal
    function showAuthModal(type) {
        authModal.classList.remove('hidden');
        authForm.dataset.type = type;
        authModalTitle.textContent = type === 'login' ? 'Login' : 'Register';
        emailVerification.classList.toggle('hidden', type === 'login');
        
        // Reset form
        authForm.reset();
        const inputs = authForm.querySelectorAll('input');
        inputs.forEach(input => input.classList.remove('border-red-500'));
        
        // Update button text
        if (authSubmitBtnText) {
            authSubmitBtnText.textContent = type === 'login' ? 'Login' : 'Register';
        }
        
        // Show/hide email verification section
        if (type === 'login') {
            emailVerification.style.display = 'none';
        } else {
            emailVerification.style.display = 'block';
        }

        // Show invitation code section for registration
        const invitationCodeSection = document.getElementById('invitationCodeSection');
        if (invitationCodeSection) {
            invitationCodeSection.classList.toggle('hidden', type === 'login');
        }
    }

    function hideAuthModal() {
        authModal.classList.add('hidden');
        authForm.reset();
    }

    // Event listeners for auth buttons
    loginBtn.addEventListener('click', () => showAuthModal('login'));
    registerBtn.addEventListener('click', () => showAuthModal('register'));
    closeAuthModal.addEventListener('click', hideAuthModal);

    // Handle auth form submission
    async function handleAuth(e) {
        e.preventDefault();
        const type = authForm.dataset.type;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        let success = false;
        if (type === 'login') {
            success = await auth.login(username, password);
        } else {
            const email = document.getElementById('email').value;
            const verificationCode = document.getElementById('verificationCode').value;
            const invitationCode = document.getElementById('invitationCode').value;
            success = await auth.registerWithVerificationCode(username, email, password, verificationCode, invitationCode);
        }

        if (success) {
            hideAuthModal();
            updateAuthDisplay();
            
            // 确保余额立即更新（冗余调用，以防在页面加载顺序问题）
            if (typeof window.updateBalance === 'function') {
                window.updateBalance();
            }
        } else {
            alert(type === 'login' ? 'Login failed' : 'Registration failed');
        }
    }

    authForm.addEventListener('submit', handleAuth);

    // Handle verification code sending
    document.getElementById('sendVerificationBtn').addEventListener('click', async () => {
        const sendBtn = document.getElementById('sendVerificationBtn');
        const email = document.getElementById('email');
        const invitationCode = document.getElementById('invitationCode');
        
        // Validate email
        if (!email.value || !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            email.classList.add('border-red-500');
            alert('Please enter a valid email address');
            return;
        }
        
        // Validate invitation code
        if (!invitationCode.value) {
            invitationCode.classList.add('border-red-500');
            alert('Please enter a valid invitation code');
            return;
        }
        
        sendBtn.disabled = true;
        sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
        let countdown = 60;
        const originalText = sendBtn.textContent;
        
        const success = await auth.sendVerificationCode(email.value, invitationCode.value);
        if (success) {
            const timer = setInterval(() => {
                sendBtn.textContent = `${countdown}s`;
                countdown--;
                if (countdown < 0) {
                    clearInterval(timer);
                    sendBtn.disabled = false;
                    sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                    sendBtn.textContent = originalText;
                }
            }, 1000);
            
            alert('Verification code sent successfully');
        } else {
            alert('Failed to send verification code');
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            sendBtn.textContent = originalText;
        }
    });

    // Initialize auth display
    updateAuthDisplay();
});

// Update auth display based on authentication state
function updateAuthDisplay() {
    const isAuthenticated = auth.isAuthenticated;
    userSection.classList.toggle('hidden', !isAuthenticated);
    authSection.classList.toggle('hidden', isAuthenticated);
    mainContent.classList.toggle('hidden', !isAuthenticated);
    welcomePage.classList.toggle('hidden', isAuthenticated);

    // 处理余额显示
    const balanceDisplay = document.getElementById('balanceDisplay');
    if (balanceDisplay) {
        if (isAuthenticated) {
            balanceDisplay.classList.remove('hidden');
            // 确保余额数据是最新的
            if (typeof window.updateBalance === 'function') {
                window.updateBalance();
            }
        } else {
            balanceDisplay.classList.add('hidden');
        }
    }

    if (isAuthenticated) {
        const username = auth.getCurrentUser();
        document.getElementById('userGreeting').textContent = `Welcome, ${username}!`;
    }
}

// Export functions for use in other modules
export { updateAuthDisplay };
