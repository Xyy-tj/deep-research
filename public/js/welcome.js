import { Auth } from './auth.js';
import { translations } from './i18n.js';

// Global variables
let currentLanguage = localStorage.getItem('language') || 'en';

// Global helper functions
const t = (key) => {
    const translation = translations[currentLanguage]?.[key];
    if (!translation) {
        console.warn(`Missing translation for key: ${key} in language: ${currentLanguage}`);
        return key;
    }
    return translation;
};

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize auth
    const auth = Auth.getInstance();
    
    // If user is already authenticated, redirect to main app
    if (auth.isAuthenticated || await auth.checkAuth()) {
        window.location.href = '/index.html';
        return;
    }
    
    // Initialize language selector
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
        languageSelector.value = currentLanguage;
        
        // Create a custom styled dropdown for better appearance
        function enhanceLanguageSelector() {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative inline-block';
            
            const selectedOption = document.createElement('div');
            selectedOption.className = 'pl-2 pr-8 py-2 text-sm rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer flex items-center';
            
            const flag = document.createElement('span');
            flag.className = 'mr-2';
            flag.textContent = languageSelector.options[languageSelector.selectedIndex].getAttribute('data-flag');
            
            const text = document.createElement('span');
            text.textContent = languageSelector.options[languageSelector.selectedIndex].textContent.replace(/🇺🇸|🇨🇳/, '').trim();
            
            selectedOption.appendChild(flag);
            selectedOption.appendChild(text);
            
            wrapper.appendChild(selectedOption);
            languageSelector.parentNode.insertBefore(wrapper, languageSelector);
            languageSelector.style.display = 'none';
            
            selectedOption.addEventListener('click', () => {
                const newLang = languageSelector.value === 'en' ? 'zh' : 'en';
                languageSelector.value = newLang;
                updateLanguage(newLang);
                flag.textContent = languageSelector.options[languageSelector.selectedIndex].getAttribute('data-flag');
                text.textContent = languageSelector.options[languageSelector.selectedIndex].textContent.replace(/🇺🇸|🇨🇳/, '').trim();
            });
        }
        
        enhanceLanguageSelector();
        
        // Language switching function
        function updateLanguage(lang) {
            currentLanguage = lang;
            localStorage.setItem('language', lang);
            
            // Update all i18n elements
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key]) {
                    el.textContent = translations[lang][key];
                }
            });
            
            // Update placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                if (translations[lang] && translations[lang][key]) {
                    el.placeholder = translations[lang][key];
                }
            });
        }
        
        // Initial language update
        updateLanguage(currentLanguage);
    }
    
    // Handle login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const authModal = document.getElementById('authModal');
            const authModalTitle = document.getElementById('authModalTitle');
            const authSubmitBtnText = document.getElementById('authSubmitBtnText');
            const invitationCodeSection = document.getElementById('invitationCodeSection');
            const emailVerification = document.getElementById('emailVerification');
            
            if (authModal && authModalTitle && authSubmitBtnText) {
                // 使用i18n系统获取文本
                authModalTitle.setAttribute('data-i18n', 'login');
                authSubmitBtnText.setAttribute('data-i18n', 'login');
                
                // 更新元素的文本内容
                authModalTitle.textContent = t('login');
                authSubmitBtnText.textContent = t('login');
                
                invitationCodeSection.style.display = 'none';
                emailVerification.style.display = 'none';
                authModal.classList.remove('hidden');
            }
        });
    }
    
    // Handle register button
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const authModal = document.getElementById('authModal');
            const authModalTitle = document.getElementById('authModalTitle');
            const authSubmitBtnText = document.getElementById('authSubmitBtnText');
            const invitationCodeSection = document.getElementById('invitationCodeSection');
            const emailVerification = document.getElementById('emailVerification');
            
            if (authModal && authModalTitle && authSubmitBtnText) {
                // 使用i18n系统获取文本
                authModalTitle.setAttribute('data-i18n', 'register');
                authSubmitBtnText.setAttribute('data-i18n', 'register');
                
                // 更新元素的文本内容
                authModalTitle.textContent = t('register');
                authSubmitBtnText.textContent = t('register');
                
                invitationCodeSection.style.display = 'block';
                emailVerification.style.display = 'block';
                authModal.classList.remove('hidden');
            }
        });
    }
    
    // Handle close modal button
    const closeAuthModal = document.getElementById('closeAuthModal');
    if (closeAuthModal) {
        closeAuthModal.addEventListener('click', () => {
            const authModal = document.getElementById('authModal');
            if (authModal) {
                authModal.classList.add('hidden');
            }
        });
    }
    
    // Handle show/hide billing information button
    const billingInfoToggle = document.getElementById('toggleBillingInfo');
    if (billingInfoToggle) {
        billingInfoToggle.addEventListener('click', () => {
            const billingInfoSection = document.getElementById('billingInfoSection');
            if (billingInfoSection) {
                billingInfoSection.classList.toggle('hidden');
                if (billingInfoSection.classList.contains('hidden')) {
                    billingInfoToggle.textContent = t('showBillingInfo');
                } else {
                    billingInfoToggle.textContent = t('hideBillingInfo');
                }
            }
        });
    }
});
