// Prompt Optimizer Module
// This module handles the prompt optimization feature using AI

import { showToast } from './utils.js';
import { getCurrentLanguage } from './i18n.js';

// Translations for prompt optimization
const translations = {
    'en': {
        optimizing: 'Optimizing your prompt...',
        error: 'Failed to optimize prompt. Please try again.',
        success: 'Prompt optimized successfully!',
        confirmTitle: 'Optimized Prompt',
        confirmMessage: 'Would you like to use this optimized prompt?',
        yes: 'Yes, use it',
        no: 'No, keep original'
    },
    'zh-CN': {
        optimizing: '正在优化您的提示词...',
        error: '优化提示词失败，请重试。',
        success: '提示词优化成功！',
        confirmTitle: '优化后的提示词',
        confirmMessage: '您想使用这个优化后的提示词吗？',
        yes: '是的，使用它',
        no: '否，保留原始提示词'
    }
};

// Get translations based on current language
function getTranslation(key) {
    const lang = getCurrentLanguage();
    return (translations[lang] && translations[lang][key]) || translations['en'][key];
}

// Create a modal for confirming the optimized prompt
function createOptimizePromptModal() {
    // Check if modal already exists
    if (document.getElementById('optimizePromptModal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'optimizePromptModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center hidden z-50';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 relative">
            <div class="flex justify-between items-center mb-4">
                <h2 id="optimizePromptModalTitle" class="text-2xl font-bold text-gray-800"></h2>
                <button id="closeOptimizePromptModal" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="mb-6">
                <p id="optimizePromptModalMessage" class="text-gray-600 mb-4"></p>
                <div class="bg-gray-100 p-4 rounded-lg">
                    <p id="optimizedPromptText" class="text-gray-800 whitespace-pre-wrap"></p>
                </div>
                <div class="mt-4 bg-gray-50 p-4 rounded-lg">
                    <h3 class="text-sm font-medium text-gray-700 mb-2">AI Assistant's Explanation:</h3>
                    <p id="optimizePromptExplanation" class="text-gray-600 text-sm whitespace-pre-wrap"></p>
                </div>
            </div>
            <div class="flex justify-end space-x-4">
                <button id="rejectOptimizedPrompt" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"></button>
                <button id="acceptOptimizedPrompt" class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"></button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('closeOptimizePromptModal').addEventListener('click', () => {
        document.getElementById('optimizePromptModal').classList.add('hidden');
    });
}

// Initialize the prompt optimization feature
export function initPromptOptimizer() {
    // Create the modal for confirming optimized prompts
    createOptimizePromptModal();
    
    // Add event listener to the optimize button
    const optimizeBtn = document.getElementById('optimizePromptBtn');
    if (!optimizeBtn) {
        console.error('Optimize prompt button not found');
        return;
    }
    
    optimizeBtn.addEventListener('click', async () => {
        const queryTextarea = document.getElementById('query');
        const originalPrompt = queryTextarea.value.trim();
        
        if (!originalPrompt) {
            showToast('Please enter a research topic first', 'warning');
            return;
        }
        
        // Show loading state
        optimizeBtn.disabled = true;
        optimizeBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> ${getTranslation('optimizing')}`;
        
        try {
            // Get current language
            const language = getCurrentLanguage();
            
            // Call the API to optimize the prompt
            const response = await fetch('/api/optimize-prompt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: originalPrompt,
                    language
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to optimize prompt');
            }
            
            const data = await response.json();
            
            // Show the confirmation modal
            const modal = document.getElementById('optimizePromptModal');
            document.getElementById('optimizePromptModalTitle').textContent = getTranslation('confirmTitle');
            document.getElementById('optimizePromptModalMessage').textContent = getTranslation('confirmMessage');
            document.getElementById('optimizedPromptText').textContent = data.optimizedPrompt;
            
            // Extract explanation from full response
            let explanation = data.fullResponse;
            if (data.optimizedPrompt !== data.fullResponse) {
                // Try to extract just the explanation part
                explanation = explanation.replace(data.optimizedPrompt, '');
            }
            document.getElementById('optimizePromptExplanation').textContent = explanation;
            
            // Set button text
            document.getElementById('acceptOptimizedPrompt').textContent = getTranslation('yes');
            document.getElementById('rejectOptimizedPrompt').textContent = getTranslation('no');
            
            // Show the modal
            modal.classList.remove('hidden');
            
            // Add one-time event listeners for the buttons
            const acceptBtn = document.getElementById('acceptOptimizedPrompt');
            const rejectBtn = document.getElementById('rejectOptimizedPrompt');
            
            const acceptHandler = () => {
                queryTextarea.value = data.optimizedPrompt;
                modal.classList.add('hidden');
                showToast(getTranslation('success'), 'success');
                acceptBtn.removeEventListener('click', acceptHandler);
                rejectBtn.removeEventListener('click', rejectHandler);
            };
            
            const rejectHandler = () => {
                modal.classList.add('hidden');
                acceptBtn.removeEventListener('click', acceptHandler);
                rejectBtn.removeEventListener('click', rejectHandler);
            };
            
            acceptBtn.addEventListener('click', acceptHandler);
            rejectBtn.addEventListener('click', rejectHandler);
            
        } catch (error) {
            console.error('Error optimizing prompt:', error);
            showToast(getTranslation('error'), 'error');
        } finally {
            // Reset button state
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = `<i class="fas fa-magic mr-1"></i> <span data-i18n="optimizePrompt">优化</span>`;
        }
    });
}
