import { Auth, setUpdateBalanceFunction } from './auth.js';
import { translations } from './i18n.js';

// Global variables
let currentLanguage = localStorage.getItem('language') || 'en';
let balanceUpdateInterval = null;

// Global helper functions
const t = (key) => {
    const translation = translations[currentLanguage]?.[key];
    if (!translation) {
        console.warn(`Missing translation for key: ${key} in language: ${currentLanguage}`);
        return key;
    }
    return translation;
};

window.copyToClipboard = async (text, button) => {
    await navigator.clipboard.writeText(text);
    const originalText = button.innerHTML;
    button.innerHTML = t('copied');
    setTimeout(() => button.innerHTML = originalText, 2000);
};

window.downloadMarkdown = async (filename) => {
    const response = await fetch(`/api/download/${filename}`, {
        credentials: 'include' // Include cookies for auth
    });
    if (!response.ok) throw new Error('Download failed');
    const content = await response.text();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

// Function to update user balance
async function updateBalance() {
    try {
        console.log('🔄 Starting balance update process...');
        // 获取Auth实例
        const auth = Auth.getInstance();
        console.log('👤 Auth state:', { isAuthenticated: auth.isAuthenticated });
        
        const balanceDisplay = document.getElementById('balanceDisplay');
        
        // 首先检查认证状态
        if (!auth.isAuthenticated) {
            console.log('🔑 User not authenticated, checking auth...');
            await auth.checkAuth();
            console.log('🔑 Auth check completed, new state:', { isAuthenticated: auth.isAuthenticated });
            
            // Hide balance display if not authenticated
            if (balanceDisplay) {
                balanceDisplay.classList.add('hidden');
            }
            return 0;
        }
        
        // 使用异步方法获取令牌
        const token = await auth.getTokenAsync();
        
        console.log('📡 Sending balance request...');
        const response = await fetch('/api/user/balance', {
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            },
            credentials: 'include' // 包含cookies，确保HTTP-only cookie被发送
        });
        
        console.log('📫 Balance response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('💰 Balance data received:', data);
            
            const userBalance = document.getElementById('userBalance');
            
            if (balanceDisplay && userBalance) {
                // Show balance display for authenticated users
                balanceDisplay.classList.remove('hidden');
                userBalance.textContent = data.balance;
                console.log('✅ Balance display updated to:', data.balance);
            } else {
                console.error('❌ Balance display elements not found');
            }
            return data.balance; // Return the balance for other functions to use
        } else {
            console.error('❌ Failed to fetch balance:', response.status, response.statusText);
            // 如果是授权错误，尝试重新验证身份
            if (response.status === 401 || response.status === 403) {
                console.log('🔄 Auth error, attempting to refresh auth...');
                await Auth.getInstance().checkAuth();
            }
            clearInterval(balanceUpdateInterval);
            return 0;
        }
    } catch (error) {
        console.error('❌ Error fetching balance:', error);
        clearInterval(balanceUpdateInterval);
        return 0;
    }
}

// Make updateBalance globally available
window.updateBalance = updateBalance;

// Register the updateBalance function with Auth module
setUpdateBalanceFunction(updateBalance);

// Function to manually refresh balance with animation
async function refreshBalanceWithAnimation() {
    const refreshButton = document.getElementById('refreshBalance');
    if (refreshButton) {
        refreshButton.classList.add('animate-spin');
        try {
            console.log('🔄 Manual balance refresh triggered');
            await updateBalance();
        } finally {
            setTimeout(() => {
                refreshButton.classList.remove('animate-spin');
            }, 1000);
        }
    }
}

// Function to check if user has enough credits for an operation
async function checkSufficientCredits(requiredCredits) {
    const currentBalance = await updateBalance();
    if (currentBalance < requiredCredits) {
        showNotification(t('insufficientCredits'), 'error');
        return false;
    }
    return true;
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize auth and handle logout
    const auth = Auth.getInstance();
    
    // 获取余额显示元素
    const balanceDisplay = document.getElementById('balanceDisplay');
    
    // 检查认证状态并适当处理余额显示
    if (auth.isAuthenticated) {
        if (balanceDisplay) {
            balanceDisplay.classList.remove('hidden');
        }
        
        // 初始化用户余额
        try {
            await updateBalance();
        } catch (error) {
            console.error('Error initializing balance:', error);
        }
    } else {
        // 如果用户未认证，确保余额显示隐藏
        if (balanceDisplay) {
            balanceDisplay.classList.add('hidden');
        }
        
        // 检查认证状态（可能通过cookie自动登录）
        const isAuthenticated = await auth.checkAuth();
        if (isAuthenticated && balanceDisplay) {
            balanceDisplay.classList.remove('hidden');
            await updateBalance();
        }
    }
    
    // Handle logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.logout();
            window.location.reload(); // 添加页面刷新以确保UI状态更新
        });
    }

    // Initialize refresh balance button
    const refreshBalanceBtn = document.getElementById('refreshBalance');
    if (refreshBalanceBtn) {
        refreshBalanceBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await refreshBalanceWithAnimation();
        });
    }

    const form = document.getElementById('researchForm');
    const startButton = document.getElementById('startResearch');
    const breadthInput = document.getElementById('breadth');
    const depthInput = document.getElementById('depth');
    const breadthValue = document.getElementById('breadthValue');
    const depthValue = document.getElementById('depthValue');
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const results = document.getElementById('results');
    const interactiveDialog = document.getElementById('interactiveDialog');
    const questionText = document.getElementById('questionText');
    const answerInput = document.getElementById('answerInput');
    const submitAnswer = document.getElementById('submitAnswer');
    const welcomePage = document.getElementById('welcomePage');
    const mainContent = document.getElementById('mainContent');
    const languageSelector = document.getElementById('languageSelector');

    let currentResearchId = null;
    let currentQuestionId = null;
    let currentEventSource = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 2000; // 2 seconds

    // Enable detailed console logging
    const logger = {
        debug: (...args) => console.debug('[Deep Research]', ...args),
        info: (...args) => console.info('[Deep Research]', ...args),
        error: (...args) => console.error('[Deep Research]', ...args)
    };

    // Update range input values
    breadthInput.addEventListener('input', (e) => {
        breadthValue.textContent = e.target.value;
    });

    depthInput.addEventListener('input', (e) => {
        const depthLevel = parseInt(e.target.value);
        const depthKey = `depthLevel${depthLevel}`;
        depthValue.textContent = t(depthKey);
    });

    // Handle answer submission
    submitAnswer.addEventListener('click', async (e) => {
        e.preventDefault();
        const answer = answerInput.value.trim();
        if (!answer || !currentResearchId) {
            logger.error('Cannot submit answer: ', { answer, currentResearchId });
            return;
        }

        try {
            logger.info('Submitting answer:', { researchId: currentResearchId, answer });
            const response = await fetch(`/api/research/${currentResearchId}/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.getInstance().getToken()}`
                },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({ answer })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Hide the dialog after submitting
            interactiveDialog.classList.add('hidden');
            answerInput.value = '';
            logger.info('Answer submitted successfully');
        } catch (error) {
            logger.error('Error submitting answer:', error);
            alert('Failed to submit answer. Please try again.');
        }
    });

    // Cleanup function for event source
    function cleanupEventSource() {
        if (currentEventSource) {
            logger.info('Cleaning up event source');
            currentEventSource.close();
            currentEventSource = null;
        }
    }

    // Function to save partial research results
    async function savePartialResults() {
        logger.info('Attempting to save partial research results');
        try {
            logger.debug('Making request to save partial results:', currentResearchId);
            const response = await fetch(`/api/research/${currentResearchId}/partial`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.getInstance().getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to save partial results');
            }

            const data = await response.json();
            logger.info('Partial results saved successfully');
            
            if (data.report) {
                logger.debug('Displaying partial results report');
                displayResult(data.report);
                showNotification('Research interrupted. Partial results have been saved.', 'warning');
            }
        } catch (error) {
            logger.error('Error saving partial results:', error);
            showNotification('Failed to save partial results.', 'error');
        }
    }

    // Function to create and setup EventSource
    function setupEventSource(researchId) {
        logger.info('Setting up EventSource for research:', researchId);
        
        if (currentEventSource) {
            logger.debug('Closing existing EventSource');
            currentEventSource.close();
        }

        logger.debug('Creating new EventSource connection');
        currentEventSource = new EventSource(`/api/events/${researchId}`);
        
        currentEventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            logger.debug('Received event data:', data);
            reconnectAttempts = 0; // Reset reconnect attempts on successful message

            switch (data.type) {
                case 'progress':
                    logger.debug('Updating progress:', data.progress);
                    updateProgress(data.progress);
                    break;
                case 'question':
                    logger.info('Received question:', data.question);
                    currentQuestionId = data.questionId;
                    showQuestion(data.question);
                    break;
                case 'result':
                    logger.info('Received final result');
                    logger.debug('Result content length:', data.result.length);
                    displayResult(data.result);
                    break;
                case 'complete':
                    logger.info('Research completed successfully');
                    showNotification('Research completed successfully!', 'success');
                    logger.debug('Closing EventSource connection');
                    currentEventSource.close();
                    currentEventSource = null;
                    break;
                case 'error':
                    logger.error('Received error from server:', data.error);
                    showNotification(data.error, 'error');
                    logger.debug('Closing EventSource connection due to error');
                    currentEventSource.close();
                    currentEventSource = null;
                    break;
            }
        };

        currentEventSource.onerror = async (error) => {
            logger.error('EventSource connection error:', error);
            
            // Only attempt reconnect if we still have an active EventSource
            if (currentEventSource) {
                logger.debug('Closing errored EventSource connection');
                currentEventSource.close();
                
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    logger.info(`Initiating reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
                    showNotification(`Connection lost. Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, 'warning');
                    
                    setTimeout(() => {
                        if (currentResearchId) {
                            logger.debug('Attempting to reconnect EventSource');
                            setupEventSource(currentResearchId);
                        }
                    }, RECONNECT_DELAY);
                } else {
                    logger.error('Maximum reconnection attempts reached');
                    await savePartialResults();
                    currentEventSource = null;
                    showNotification('Connection lost. Partial results have been saved.', 'error');
                }
            }
        };

        logger.info('EventSource setup completed');
        return currentEventSource;
    }

    // Function to display research result
    function displayResult(result) {
        logger.info('Displaying research result');
        logger.debug('Creating result section in DOM');

        const resultsContainer = document.getElementById('results');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = '';
        
        let content = '';
        let filename = '';
        
        if (typeof result === 'string') {
            content = result;
            filename = 'research-result.md';
        } else if (result && result.content) {
            content = result.content;
            filename = result.filename || 'research-result.md';
        } else {
            logger.error('Invalid result format');
            return;
        }
        
        // Process the markdown content to format references properly
        const processedContent = formatReferences(content);
        
        const resultSection = document.createElement('div');
        resultSection.className = 'mt-8';
        
        // 使用两步渲染过程：先解析Markdown，然后将HTML插入到DOM中
        const markdownHtml = marked.parse(processedContent);
        
        resultSection.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6">
                <h3 class="text-xl font-semibold mb-4">${t('researchResults')}</h3>
                <div class="markdown-content"></div>
                <div class="mt-6 flex justify-end space-x-4">
                    <button onclick="saveResults()" class="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors">
                        ${t('saveResults')}
                    </button>
                    <a href="data:text/markdown;charset=utf-8,${encodeURIComponent(content)}" 
                       download="${filename}" 
                       class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors">
                        ${t('downloadMarkdown')}
                    </a>
                </div>
            </div>
        `;
        
        resultsContainer.appendChild(resultSection);
        
        // 将解析后的HTML安全地插入到markdown-content元素中
        const markdownContent = resultSection.querySelector('.markdown-content');
        if (markdownContent) {
            markdownContent.innerHTML = markdownHtml;
        }
        
        // Show the results section
        resultsContainer.style.display = 'block';
        
        // Save the result to the current research session
        if (currentResearchSession) {
            currentResearchSession.result = content;
        }
    }

    // Function to format references in markdown content
    function formatReferences(content) {
        // Check if the content has a References section
        if (!content.includes('## References')) {
            return content;
        }

        // Split the content into sections
        const parts = content.split('## References');
        
        if (parts.length < 2) {
            return content;
        }
        
        // Get the content before and after the References section
        const beforeReferences = parts[0];
        let referencesSection = parts[1];
        
        // Regular expression to match reference entries
        // Format: [number] Author. (Year). Title. Journal, Volume(Issue), Pages.
        //    [Link](url)
        const referenceRegex = /\[(\d+)\](.*?)(?:\n\s*\[Link\]\((.*?)\))?(?=\n\n|\n\[\d+\]|$)/gs;
        
        // Create HTML for references section
        let referencesHTML = '<div class="references-container">';
        
        // Replace each reference with formatted HTML
        let match;
        while ((match = referenceRegex.exec(referencesSection)) !== null) {
            const [fullMatch, number, text, url] = match;
            const formattedText = text.trim();
            
            // Extract year if available (assuming format includes a year in parentheses)
            const yearMatch = formattedText.match(/\((\d{4})\)/);
            const year = yearMatch ? yearMatch[1] : '';
            
            // Extract author(s) - assuming they come before the year
            let author = '';
            if (yearMatch) {
                author = formattedText.substring(0, formattedText.indexOf(yearMatch[0])).trim();
            } else {
                // Try to extract author by looking for the first period
                const firstPeriodPos = formattedText.indexOf('.');
                if (firstPeriodPos > -1) {
                    author = formattedText.substring(0, firstPeriodPos + 1).trim();
                }
            }
            
            // Extract title - assuming it comes after the year and before the journal
            let title = '';
            let journal = '';
            
            if (yearMatch) {
                const afterYear = formattedText.substring(formattedText.indexOf(yearMatch[0]) + yearMatch[0].length).trim();
                // Title typically ends with a period before journal name
                const titleEndPos = afterYear.indexOf('. ');
                if (titleEndPos > -1) {
                    title = afterYear.substring(0, titleEndPos + 1).trim();
                    journal = afterYear.substring(titleEndPos + 1).trim();
                } else {
                    title = afterYear;
                }
            } else {
                // If no year found, try to extract title and journal based on periods
                const parts = formattedText.split('. ');
                if (parts.length > 1) {
                    // Skip the first part (author)
                    title = parts[1] + '.';
                    journal = parts.slice(2).join('. ');
                }
            }
            
            // Create a professional academic reference card
            referencesHTML += `
            <div class="reference-card">
                <div class="reference-number">[${number}]</div>
                <div class="reference-content">`;
                
            // 创建作者行，如果有年份则包含年份
            if (author) {
                referencesHTML += `<div class="reference-author">`;
                
                // 如果有年份，先显示年份
                if (year) {
                    referencesHTML += `<span class="reference-year">${year}</span> `;
                }
                
                // 显示作者
                referencesHTML += `${author.replace(/'/g, "\\'")}</div>`;
            } else if (year) {
                // 如果只有年份没有作者
                referencesHTML += `<div class="reference-author"><span class="reference-year">${year}</span></div>`;
            }
            
            // 只添加期刊信息（如果存在）
            if (journal) {
                referencesHTML += `<div class="reference-details">
                    <span class="reference-journal">${journal}</span>
                </div>`;
            }
                        
            if (url) {
                referencesHTML += `
                    <div class="reference-link-container">
                        <a href="${url}" class="reference-link" onclick="return openReferenceModal('${url.replace(/'/g, "\\'")}', '${(author || '').replace(/'/g, "\\'")}${year ? ' (' + year + ')' : ''}', event);">
                            <svg xmlns="http://www.w3.org/2000/svg" class="reference-link-icon" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                            </svg>
                            查看原文
                        </a>
                    </div>`;
            }
            
            referencesHTML += `
                </div>
            </div>`;
        }
        
        referencesHTML += '</div>';
        
        // Return the formatted content
        return beforeReferences + '## References\n' + referencesHTML;
    }

    // Language switching function
    function updateLanguage(lang) {
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        
        // Update all i18n elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = t(key);
        });
        
        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = t(key);
        });
        
        // Update depth slider text
        if (depthInput && depthValue) {
            const currentDepthLevel = parseInt(depthInput.value);
            const depthKey = `depthLevel${currentDepthLevel}`;
            depthValue.textContent = t(depthKey);
        }
    }

    // Initialize language selector
    if (languageSelector) {
        languageSelector.value = currentLanguage;
        
        // Create a custom styled dropdown for better appearance
        const enhanceLanguageSelector = () => {
            // Add a subtle transition effect when changing languages
            languageSelector.style.transition = 'all 0.2s ease';
            
            // Highlight the selector briefly when language changes
            languageSelector.addEventListener('change', (e) => {
                languageSelector.classList.add('border-primary-400');
                setTimeout(() => {
                    languageSelector.classList.remove('border-primary-400');
                }, 500);
                updateLanguage(e.target.value);
            });
        };
        
        enhanceLanguageSelector();
    }

    // Initial language update
    updateLanguage(currentLanguage);
    
    // Initialize depth slider with text instead of number
    if (depthInput && depthValue) {
        const initialDepthLevel = parseInt(depthInput.value);
        const initialDepthKey = `depthLevel${initialDepthLevel}`;
        depthValue.textContent = t(initialDepthKey);
    }

    // Handle research start
    async function startResearch() {
        const query = document.getElementById('query').value.trim();
        if (!query) {
            alert(t('pleaseEnterResearchTopic'));
            return;
        }

        // Get authentication token
        const auth = Auth.getInstance();
        const isAuthenticated = await auth.checkAuth();
        if (!isAuthenticated) {
            logger.error('Not authenticated');
            alert(t('pleaseLogInFirst'));
            return;
        }
        const token = auth.getToken();

        // Get research parameters
        const breadth = parseInt(document.getElementById('breadth').value) || 4;
        const depth = parseInt(document.getElementById('depth').value) || 2;
        const language = document.getElementById('reportLanguage').value || 'zh-CN';

        // Calculate and display estimated cost before proceeding
        try {
            const costResponse = await fetch('/api/research/cost', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({ depth, breadth })
            });

            if (!costResponse.ok) {
                const error = await costResponse.json();
                if (error.error && error.error.includes('Insufficient credits')) {
                    showError(t('insufficientCredits'));
                } else {
                    throw new Error(error.error || 'Failed to calculate cost');
                }
                return;
            }

            const costData = await costResponse.json();
            
            // 先检查用户余额是否足够
            const currentBalance = await updateBalance(); // 更新并获取最新余额
            
            if (currentBalance < costData.cost) {
                showError(t('insufficientCredits'));
                return;
            }
            
            if (!confirm(`${t('thisResearchWillCost')} ${costData.cost} ${t('credits')}. ${t('doYouWantToProceed')}?`)) {
                return; // User canceled
            }
        } catch (error) {
            logger.error('Error calculating cost:', error);
            // Continue anyway if cost calculation fails
        }

        // Clear previous results and state
        document.getElementById('results').innerHTML = '';
        currentResearchId = null;
        currentQuestionId = null;

        // Show progress section
        const progressSection = document.createElement('div');
        progressSection.id = 'progress-section';
        progressSection.className = 'mb-8';
        progressSection.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 class="text-lg font-semibold mb-4">${t('researchProgress')}</h3>
                <div id="progress-bar" class="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                    <div class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                </div>
                <p id="progress-status" class="text-sm text-gray-600">${t('startingResearch')}...</p>
                <div id="question-area" class="mt-4 hidden">
                    <p id="question-text" class="text-sm font-medium text-gray-900 mb-2"></p>
                    <div class="flex space-x-4">
                        <button id="yes-button"
                                class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                            ${t('yes')}
                        </button>
                        <button id="no-button"
                                class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                            ${t('no')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('results').appendChild(progressSection);

        try {
            // Start research
            const response = await fetch('/api/research', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({ 
                    query, 
                    breadth, 
                    depth,
                    language: document.getElementById('reportLanguage').value || 'zh-CN'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                if (error.error && error.error.includes('Insufficient credits')) {
                    showError(t('insufficientCredits'));
                } else {
                    throw new Error(error.error || 'Failed to start research');
                }
                return;
            }

            const data = await response.json();
            if (!data.researchId) {
                throw new Error('No research ID received');
            }

            // Store current research ID
            currentResearchId = data.researchId;

            // Start listening for events
            setupEventSource(currentResearchId);
        } catch (error) {
            logger.error('Error starting research:', error);
            alert(t('anErrorOccurredWhileProcessingYourRequest'));
        }
    }

    // Bind start button click
    if (startButton) {
        startButton.addEventListener('click', startResearch);
    }

    // Handle form submission (prevent default and use our custom handler)
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            startResearch();
        });
    }

    // Clean up when leaving the page
    window.addEventListener('beforeunload', cleanupEventSource);

    // Update progress bar and status
    function updateProgress(progress) {
        // First handle the dynamically created progress-bar if it exists
        const dynamicProgressBar = document.querySelector('#progress-bar div');
        const dynamicProgressStatus = document.getElementById('progress-status');

        // Make sure the progress section is visible
        if (progress) {
            document.getElementById('progress').classList.remove('hidden');
        }

        // Calculate percent 
        const percent = Math.round((progress.completedQueries / progress.totalQueries) * 100);
        
        // Set status text
        let status = '';
        
        // Special handling for report generation
        if (progress.isGeneratingReport) {
            status = `<span class="font-semibold text-primary-600">${t('generatingReport')}</span>`;
        } else {
            status = `${t('depth')}: ${progress.currentDepth}/${progress.totalDepth}, `;
            status += `${t('breadth')}: ${progress.currentBreadth}/${progress.totalBreadth}, `;
            status += `${t('queries')}: ${progress.completedQueries}/${progress.totalQueries}`;

            if (progress.currentQuery) {
                status += `<br>${t('currentlyResearching')}: ${progress.currentQuery}`;
            }
        }

        // Update dynamic elements if they exist
        if (dynamicProgressBar) {
            dynamicProgressBar.style.width = `${percent}%`;
        }
        
        if (dynamicProgressStatus) {
            dynamicProgressStatus.innerHTML = status;
        }
        
        // Also update the main progress bar and text in the UI
        if (progressBar && progressText) {
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${percent}%`;
        }
        
        // Log progress update for debugging
        logger.debug(`Progress updated: ${percent}% complete`);
    }

    // Handle user's answer to question
    async function answerQuestion(answer) {
        if (!currentResearchId || !currentQuestionId) {
            console.error('No active research session or question');
            return;
        }

        const questionArea = document.getElementById('question-area');
        questionArea.classList.add('hidden');

        try {
            logger.info('Submitting answer:', { researchId: currentResearchId, answer });
            const response = await fetch(`/api/answer/${currentResearchId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.getInstance().getToken()}`
                },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({
                    answer: answer ? 'yes' : 'no',
                    questionId: currentQuestionId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error('Failed to submit answer');
            }

            // Clear current question ID after successful submission
            currentQuestionId = null;
        } catch (error) {
            console.error('Error submitting answer:', error);
            showError(t('failedToSubmitAnswer'));

            // Show the question area again in case of error
            questionArea.classList.remove('hidden');
        }
    }

    // Show question to user
    function showQuestion(question) {
        const questionArea = document.getElementById('question-area');
        const questionText = document.getElementById('question-text');

        // Hide any previous error messages
        const errorMessages = document.querySelectorAll('.error-message');
        errorMessages.forEach(msg => msg.remove());

        questionText.textContent = question;
        questionArea.classList.remove('hidden');
    }

    // Helper function to show error messages
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4';
        errorDiv.textContent = message;

        // Insert error message before the question area if it exists
        const questionArea = document.getElementById('question-area');
        if (questionArea) {
            questionArea.parentNode.insertBefore(errorDiv, questionArea);
        } else {
            document.getElementById('results').prepend(errorDiv);
        }
    }

    // Initialize question buttons
    document.addEventListener('click', (e) => {
        if (e.target.matches('#yes-button')) {
            answerQuestion(true);
        } else if (e.target.matches('#no-button')) {
            answerQuestion(false);
        }
    });

    // Helper function to copy text to clipboard
    function copyToClipboard(text, button) {
        navigator.clipboard.writeText(text).then(() => {
            const originalText = button.innerHTML;
            button.innerHTML = `
                <svg class="w-4 h-4 mr-1 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                          d="M5 13l4 4L19 7"/>
                </svg>
                ${t('copied')}
            `;
            setTimeout(() => {
                button.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert(t('failedToCopyToClipboard'));
        });
    }

    // Helper function to toggle note textarea
    function addNote(index) {
        const noteContainer = document.querySelector(`.note-container-${index}`);
        noteContainer.classList.toggle('hidden');
    }

    // Helper function to save note
    function saveNote(index) {
        const noteContainer = document.querySelector(`.note-container-${index}`);
        const textarea = noteContainer.querySelector('textarea');
        if (textarea.value.trim()) {
            noteContainer.classList.add('hidden');
            // You could also save this to localStorage or your backend
            localStorage.setItem(`note-${index}`, textarea.value);
        }
    }

    // Helper function to show notifications
    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Save research results
    async function saveResults() {
        if (!currentResearchId) {
            showError(t('noActiveResearchSession'));
            return;
        }

        try {
            const response = await fetch('/api/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Auth.getInstance().getToken()}`
                },
                credentials: 'include', // Include cookies for auth
                body: JSON.stringify({
                    researchId: currentResearchId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            if (data.success && data.filename) {
                // Load markdown preview
                await loadMarkdownPreview(data.filename);
                
                // Store filename for download
                document.getElementById('download-report').onclick = () => downloadMarkdown(data.filename);
                
                // Show success message
                showMessage(t('researchResultsSavedSuccessfully'));
            }
        } catch (error) {
            console.error('Error saving results:', error);
            showError(t('failedToSaveResults'));
        }
    }

    // Load markdown preview
    async function loadMarkdownPreview(filename) {
        const previewContainer = document.getElementById('markdown-preview');
        if (!previewContainer) return;

        previewContainer.innerHTML = `<p class="text-gray-500">${t('loadingPreview')}...</p>`;

        try {
            logger.info('Testing markdown display');
            const response = await fetch(`/api/markdown/${filename}`, {
                credentials: 'include', // Include cookies for auth
                headers: {
                    'Authorization': `Bearer ${Auth.getInstance().getToken()}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to load markdown file');
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            if (data.content) {
                // Convert markdown to HTML using marked
                const previewHtml = marked.parse(data.content);
                previewContainer.innerHTML = previewHtml;
            } else {
                previewContainer.innerHTML = `<p class="text-gray-500">${t('noContentAvailable')}</p>`;
            }
        } catch (error) {
            console.error('Error loading markdown preview:', error);
            previewContainer.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-4">
                    <div class="flex">
                        <div class="flex-shrink-0">
                            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <div class="ml-3">
                            <p class="text-sm text-red-700">${t('errorLoadingPreview')}: ${error.message}</p>
                        </div>
                    </div>
                </div>`;
        }
    }

    // Handle markdown download
    async function downloadMarkdown(filename) {
        try {
            const response = await fetch(`/api/download/${filename}`, {
                credentials: 'include' // Include cookies for auth
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get the content as text
            const content = await response.text();
            
            // Create a blob with markdown content type
            const blob = new Blob([content], { type: 'text/markdown' });
            const url = window.URL.createObjectURL(blob);
            
            // Create a temporary link and click it
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showNotification(t('fileDownloadedSuccessfully'), 'success');
        } catch (error) {
            console.error('Error downloading markdown:', error);
            showError(t('failedToDownloadReport'));
        }
    }

    // Show success message
    function showMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'fixed bottom-4 right-4 bg-green-50 border-l-4 border-green-500 p-4';
        messageDiv.innerHTML = `
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm text-green-700">${message}</p>
                </div>
            </div>
        `;
        document.body.appendChild(messageDiv);
        
        // Remove the message after 3 seconds
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 3000);
    }

    // Function to toggle between welcome page and main content
    function toggleMainContent(show) {
        const welcomeSection = document.getElementById('welcomeSection');
        const mainContent = document.getElementById('mainContent');
        
        if (welcomeSection && mainContent) {
            welcomeSection.style.display = show ? 'none' : 'block';
            mainContent.style.display = show ? 'block' : 'none';
        }
    }
    
    // Make toggleMainContent globally accessible
    window.toggleMainContent = toggleMainContent;

    // Load welcome page content
    async function loadWelcomeContent() {
        const welcomePageContent = document.getElementById('welcomePageContent');
        if (welcomePageContent) {
            try {
                // 使用API端点而不是直接加载HTML文件
                const response = await fetch('/api/welcome-content');
                if (response.ok) {
                    const data = await response.json();
                    welcomePageContent.innerHTML = data.content;
                    
                    // Update translations after loading content
                    document.querySelectorAll('[data-i18n]').forEach(el => {
                        const key = el.getAttribute('data-i18n');
                        if (translations[currentLanguage] && translations[currentLanguage][key]) {
                            el.textContent = translations[currentLanguage][key];
                        }
                    });
                }
            } catch (error) {
                console.error('Error loading welcome content:', error);
            }
        }
    }

    // Show welcome page by default for non-logged in users
    toggleMainContent(false);
    loadWelcomeContent();

    // Update auth display when user logs in/out
    document.addEventListener('authStateChanged', (event) => {
        const { isLoggedIn } = event.detail;
        if (isLoggedIn) {
            welcomePage.classList.add('hidden');
            mainContent.classList.remove('hidden');
            // Start balance update interval
            updateBalance();
            balanceUpdateInterval = setInterval(updateBalance, 30000); // Update every 30 seconds
        } else {
            welcomePage.classList.remove('hidden');
            mainContent.classList.add('hidden');
            // Update the balance to show 0 but keep it visible
            const userBalance = document.getElementById('userBalance');
            if (userBalance) {
                userBalance.textContent = '0';
            }
            // Clear balance update interval
            if (balanceUpdateInterval) {
                clearInterval(balanceUpdateInterval);
                balanceUpdateInterval = null;
            }
        }
    });


    // Check initial auth state
    (async function checkInitialAuth() {
        const isAuthenticated = await Auth.getInstance().checkAuth();
        // If authenticated, show main content instead of welcome page
        if (isAuthenticated) {
            toggleMainContent(true);
        }
    })();

    // 测试函数 - 显示模拟研究结果
    function testReferencesDisplay() {
        logger.info('Testing references display');
        
        // 确保marked已定义
        if (typeof marked === 'undefined') {
            console.error("marked is not defined. Loading it dynamically...");
            // 如果marked未定义，动态加载它
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            script.onload = function() {
                // 配置marked选项
                marked.setOptions({
                    gfm: true,
                    breaks: true,
                    sanitize: false,
                    smartLists: true,
                    smartypants: true
                });
                console.log("marked loaded successfully");
                // 加载完成后继续执行测试
                continueTest();
            };
            document.head.appendChild(script);
        } else {
            // 如果marked已定义，直接继续
            continueTest();
        }
        
        function continueTest() {
            // Mock research result with references
            const mockResult = {
                content: `# 机器学习在石油工业中的应用研究

## 摘要
本研究探讨了机器学习技术在石油工业中的应用现状与发展前景。通过分析现有文献和实践案例，总结了机器学习在油藏表征、生产优化、设备维护等方面的应用成果，并讨论了未来发展趋势。

## 关键词
机器学习、石油工业、油藏表征、生产优化、预测性维护

## 研究背景
随着数字化转型的推进，石油工业正积极采用人工智能和机器学习技术来提高生产效率、降低成本并实现更可持续的发展。机器学习作为人工智能的核心分支，通过从历史数据中学习模式和规律，为石油行业提供了新的解决方案和优化途径。

## 主要发现
1. 机器学习技术在油藏表征方面显著提高了地质模型的准确性，特别是在复杂地质构造的解释上。
2. 在生产优化领域，机器学习算法能够实时分析生产数据，提供更精准的生产参数调整建议。
3. 预测性维护系统通过分析设备运行数据，可以提前预警潜在故障，减少非计划停机时间。
4. 数据驱动与机理模型的融合是当前研究热点，可以克服单一模型的局限性。

## 结论与建议
机器学习技术在石油工业中展现出巨大潜力，但仍面临数据质量、算法解释性等挑战。建议加强跨学科合作，提高数据标准化水平，并注重算法的可解释性研究，以促进机器学习技术在石油工业中的更广泛应用。

## References
[1] 肖立志. (2022). 机器学习数据驱动与机理模型融合及可解释性问题. 石油物探, 61(2), 205-212.
[Link](https://html.rhhz.net/SYWT/HTML/22-02-02.htm)

[2] 刘合, 李艳春, 贾德利, 王素玲, 乔美霞, 屈如意, ... & 任智慧. (2023). 人工智能在注水开发方案精细化调整中的应用现状及展望. 石油学报, 44(9), 1574.
[Link](https://www.syxb-cps.com.cn/CN/abstract/abstract6462.shtml)

[3] 张三, 李四, 王五. (2024). 深度学习在油藏特征提取中的应用. 石油学报, 45(2), 112-125.
[Link](https://example.com/paper3)

[4] Johnson, A., Smith, B., & Williams, C. (2023). Machine Learning Applications in Petroleum Engineering: A Comprehensive Review. Journal of Petroleum Technology, 75(3), 45-58.
[Link](https://example.com/paper4)

[5] Wang, X., Zhang, Y., & Li, Z. (2024). Predictive Maintenance for Offshore Platforms Using Machine Learning. SPE Journal, 29(1), 78-92.
[Link](https://example.com/paper5)`,
                filename: 'machine-learning-petroleum-research.md'
            };
            
            // Display the mock result
            displayResult(mockResult);
            
            // Show the main content area if it's hidden
            toggleMainContent(true);
            
            // Scroll to the results section
            document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // Add test button to the page when in development mode
    const isDevelopmentMode = true; // 直接设置为true进行测试
    logger.info('Development mode: ' + isDevelopmentMode);
    
    if (isDevelopmentMode) {
        // 确保在DOM完全加载后添加测试按钮
        function addTestButtons() {
            logger.info('Adding test references button');
            // Add test references button
            const testReferencesButton = document.createElement('button');
            testReferencesButton.textContent = '测试参考文献显示';
            testReferencesButton.className = 'fixed top-20 right-4 z-50 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors';
            testReferencesButton.addEventListener('click', testReferencesDisplay);
            document.body.appendChild(testReferencesButton);
            
            // Add the original test button for markdown display if it doesn't exist yet
            const testButton = document.createElement('button');
            testButton.textContent = '测试Markdown显示';
            testButton.className = 'fixed top-32 right-4 z-50 px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition-colors';
            testButton.addEventListener('click', testMarkdownDisplay);
            document.body.appendChild(testButton);
            
            logger.info('Test buttons added to the page');
        }
        
        // 确保DOM已加载完成
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(addTestButtons, 1000); // 延迟1秒添加按钮
        } else {
            window.addEventListener('DOMContentLoaded', function() {
                setTimeout(addTestButtons, 1000); // 延迟1秒添加按钮
            });
        }
    }
});

// 添加打开引用链接的浮动窗口函数
window.openReferenceModal = function(url, title, e) {
    // 获取点击位置 (确保使用传入的事件对象)
    const event = e || window.event;
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    console.log("Opening popup at:", clickX, clickY, "for URL:", url);
    
    // 创建浮动窗口
    const popup = document.createElement('div');
    popup.className = 'reference-popup';
    
    // 创建浮动窗口内容
    popup.innerHTML = `
        <div class="reference-popup-content">
            <div class="reference-popup-header">
                <h3>${title || '查看参考文献'}</h3>
                <button class="reference-popup-close">&times;</button>
            </div>
            <div class="reference-popup-body">
                <div class="iframe-container">
                    <iframe src="${url}" frameborder="0" class="reference-iframe"></iframe>
                    <div class="iframe-error-message" style="display: none;">
                        <p>无法在此窗口中显示内容，因为目标网站不允许被嵌入。</p>
                        <button class="open-in-new-tab-btn">在新标签页中打开</button>
                    </div>
                </div>
            </div>
            <div class="reference-popup-footer">
                <a href="${url}" target="_blank" class="reference-popup-open-link">
                    <svg xmlns="http://www.w3.org/2000/svg" class="reference-link-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    在新标签页打开
                </a>
            </div>
        </div>
    `;
    
    // 添加到body
    document.body.appendChild(popup);
    
    // 计算位置
    const popupWidth = 500; // 预设宽度
    const popupHeight = 400; // 预设高度
    
    // 计算左侧位置，确保不超出屏幕
    let left = clickX;
    if (left + popupWidth > window.innerWidth) {
        left = window.innerWidth - popupWidth - 20;
    }
    
    // 计算顶部位置，确保不超出屏幕
    let top = clickY;
    if (top + popupHeight > window.innerHeight) {
        top = window.innerHeight - popupHeight - 20;
    }
    
    // 设置位置
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    
    // 添加iframe加载错误处理
    const iframe = popup.querySelector('.reference-iframe');
    const errorMessage = popup.querySelector('.iframe-error-message');
    
    iframe.addEventListener('load', function() {
        try {
            // 尝试访问iframe内容，如果跨域会抛出错误
            const iframeContent = iframe.contentWindow.document;
            console.log('Iframe loaded successfully');
        } catch (error) {
            console.error('Error accessing iframe content:', error);
            showIframeError();
        }
    });
    
    iframe.addEventListener('error', function(e) {
        console.error('Iframe failed to load:', e);
        showIframeError();
    });
    
    function showIframeError() {
        iframe.style.display = 'none';
        errorMessage.style.display = 'flex';
        
        // 添加新标签页打开按钮事件
        const openInNewTabBtn = errorMessage.querySelector('.open-in-new-tab-btn');
        openInNewTabBtn.addEventListener('click', function() {
            window.open(url, '_blank');
            closeReferencePopup(popup);
        });
    }
    
    // 添加关闭按钮事件
    const closeButton = popup.querySelector('.reference-popup-close');
    closeButton.addEventListener('click', () => {
        closeReferencePopup(popup);
    });
    
    // 点击窗口外部关闭
    document.addEventListener('click', function clickOutside(e) {
        if (!popup.contains(e.target) && !e.target.closest('.reference-link') && !popup.classList.contains('closing')) {
            closeReferencePopup(popup);
            document.removeEventListener('click', clickOutside);
        }
    }, { capture: true });
    
    // 添加键盘事件 (ESC键关闭)
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeReferencePopup(popup);
            document.removeEventListener('keydown', escHandler);
        }
    });
    
    // 动画效果
    setTimeout(() => {
        popup.classList.add('reference-popup-active');
    }, 10);
    
    return false; // 防止默认行为
}

// 关闭引用弹窗
window.closeReferencePopup = function(popup) {
    if (!popup) return;
    
    // 添加关闭动画
    popup.classList.add('closing');
    popup.classList.remove('reference-popup-active');
    
    // 动画完成后移除元素
    setTimeout(() => {
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    }, 300);
}
