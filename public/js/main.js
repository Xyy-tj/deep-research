import { Auth } from './auth.js';
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
    const response = await fetch(`/api/download/${filename}`);
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
        const response = await fetch('/api/user/balance', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const balanceDisplay = document.getElementById('balanceDisplay');
            const userBalance = document.getElementById('userBalance');
            
            if (balanceDisplay && userBalance) {
                userBalance.textContent = data.balance;
                balanceDisplay.classList.remove('hidden');
            }
        } else {
            console.error('Failed to fetch balance');
            clearInterval(balanceUpdateInterval);
        }
    } catch (error) {
        console.error('Error fetching balance:', error);
        clearInterval(balanceUpdateInterval);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize auth and handle logout
    const auth = Auth.getInstance();
    
    // Handle logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            auth.logout();
            window.location.reload(); // 添加页面刷新以确保UI状态更新
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
        depthValue.textContent = e.target.value;
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
                },
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

        const content = result.content || result;
        const filename = result.filename || 'report.md';

        const resultSection = document.createElement('div');
        resultSection.className = 'mt-8';
        resultSection.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-6">
                <h3 class="text-xl font-semibold mb-4">${t('researchResults')}</h3>
                <div class="markdown-content">${marked.parse(content)}</div>
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

        const resultsContainer = document.getElementById('results');
        // Clear previous results
        resultsContainer.innerHTML = '';
        
        logger.debug('Appending result section to container');
        resultsContainer.appendChild(resultSection);
        resultsContainer.scrollIntoView({ behavior: 'smooth' });
        logger.info('Research result displayed successfully');
    }

    // Language switching function
    const updateLanguage = (lang) => {
        currentLanguage = lang;
        localStorage.setItem('language', lang);
        
        // Update all text content
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = t(key);
        });

        // Update placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = t(key);
        });
    };

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
                body: JSON.stringify({ 
                    query, 
                    breadth: parseInt(document.getElementById('breadth').value) || 4, 
                    depth: parseInt(document.getElementById('depth').value) || 2,
                    language: document.getElementById('reportLanguage').value || 'zh-CN'
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start research');
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
                },
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
                },
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
            const response = await fetch(`/api/markdown/${filename}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
            const response = await fetch(`/api/download/${filename}`);
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

    // Show welcome page by default for non-logged in users
    toggleMainContent(false);

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
            document.getElementById('balanceDisplay').classList.add('hidden');
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

    // Test function to display local markdown file
    async function testMarkdownDisplay() {
        try {
            logger.info('Testing markdown display');
            const response = await fetch('/test/test.md');
            if (!response.ok) {
                throw new Error('Failed to load test markdown file');
            }
            const content = await response.text();
            displayResult(content);
            logger.info('Test markdown loaded and displayed successfully');
        } catch (error) {
            logger.error('Error testing markdown display:', error);
            showError('Failed to load test markdown file');
        }
    }

    // Add test button to the page when in development mode
    const isDevelopmentMode = false; // Set to true for development, false for production
    if (isDevelopmentMode) {
        const testButton = document.createElement('button');
        testButton.textContent = 'Test Markdown Display';
        testButton.className = 'fixed bottom-4 right-4 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700';
        testButton.onclick = testMarkdownDisplay;
        document.body.appendChild(testButton);
    }
});
