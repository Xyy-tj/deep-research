// Research History JavaScript
import { translations } from './i18n.js';
import { showNotification } from './notifications.js';
import { Auth } from './auth.js';

// Helper function to get auth headers
async function getAuthHeaders() {
    const token = await Auth.getInstance().getTokenAsync();
    
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const loadResearchHistoryContent = async () => {
        try {
            // Try to fetch from API first
            let data = { records: [] };
            try {
                const response = await fetch('/api/research/list', {
                    method: 'POST',
                    headers: await getAuthHeaders(),
                    credentials: 'include' // Include cookies for auth
                });
                
                if (response.ok) {
                    data = await response.json();
                } else {
                    console.warn(`API returned status: ${response.status}. Using mock data instead.`);
                    // Use mock data if API fails
                    data = getMockResearchData();
                }
            } catch (error) {
                console.warn('API fetch failed:', error.message);
                // Use mock data if API fails
                data = getMockResearchData();
            }
            
            const container = document.getElementById('historyContainer');
            console.log('History container found:', !!container);
            
            if (container) {
                // Generate HTML content for research history
                renderResearchHistory(container, data.records);
                console.log('Content loaded into container, initializing handlers');
                initializeEventHandlers();
            } else {
                console.error('History container not found in the DOM');
            }
        } catch (error) {
            console.error('Error loading research history:', error);
            const container = document.getElementById('historyContainer');
            if (container) {
                container.innerHTML = `
                    <div class="p-4 bg-red-50 border-l-4 border-red-500">
                        <div class="flex">
                            <div class="flex-shrink-0">
                                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                                </svg>
                            </div>
                            <div class="ml-3">
                                <p class="text-sm text-red-700">Error loading research history: ${error.message}</p>
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    };
    
    // Function to generate mock research data for testing
    const getMockResearchData = () => {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(now);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        return {
            records: [
                {
                    id: 'r1',
                    user_id: 1,
                    query: 'Quantum computing applications in healthcare',
                    depth: 3,
                    breadth: 5,
                    language: 'en-US',
                    status: 'completed',
                    start_time: now.toISOString(),
                    end_time: new Date(now.getTime() + 120000).toISOString(),
                    output_filename: 'quantum_healthcare_research.md',
                    num_references: 15,
                    num_learnings: 8
                },
                {
                    id: 'r2',
                    user_id: 1,
                    query: 'Sustainable energy solutions',
                    depth: 2,
                    breadth: 4,
                    language: 'zh-CN',
                    status: 'completed',
                    start_time: yesterday.toISOString(),
                    end_time: new Date(yesterday.getTime() + 90000).toISOString(),
                    output_filename: 'sustainable_energy_research.md',
                    num_references: 12,
                    num_learnings: 6
                },
                {
                    id: 'r3',
                    user_id: 1,
                    query: 'Machine learning in financial markets',
                    depth: 4,
                    breadth: 3,
                    language: 'en-US',
                    status: 'failed',
                    start_time: lastWeek.toISOString(),
                    end_time: new Date(lastWeek.getTime() + 30000).toISOString(),
                    error_message: 'Research process interrupted due to API rate limiting'
                },
                {
                    id: 'r4',
                    user_id: 1,
                    query: 'Advancements in artificial intelligence',
                    depth: 3,
                    breadth: 5,
                    language: 'en-US',
                    status: 'completed',
                    start_time: lastWeek.toISOString(),
                    end_time: new Date(lastWeek.getTime() + 150000).toISOString(),
                    output_filename: 'ai_advancements_research.md',
                    num_references: 20,
                    num_learnings: 12
                }
            ]
        };
    };

    // Render research history records
    const renderResearchHistory = (container, records) => {
        if (!records || records.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center empty-history">
                    <div class="mb-4">
                        <svg class="h-12 w-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.663 17h4.673M12 3v1m0 16v1m-9-9h1m16 0h1m-2.947-7.053l-.708.708M5.654 7.654l-.708-.707M18.346 17.346l-.707.707M5.654 17.346l.707.707"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-medium text-gray-900">No research history found</h3>
                    <p class="mt-2 text-sm text-gray-500">Start a new research to see your history here.</p>
                </div>
            `;
            return;
        }

        // Sort records by start time (newest first)
        records.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        
        // Group records by date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const todayRecords = records.filter(r => new Date(r.start_time) >= today);
        const yesterdayRecords = records.filter(r => {
            const date = new Date(r.start_time);
            return date >= yesterday && date < today;
        });
        const olderRecords = records.filter(r => new Date(r.start_time) < yesterday);
        
        // Generate HTML
        let html = `
            <div class="research-history-container">
                <h2 class="text-xl font-semibold mb-4">Research History</h2>
                <div class="research-history-list">
        `;
        
        // Today's records
        if (todayRecords.length > 0) {
            html += `
                <div class="date-group mb-6">
                    <h3 class="text-lg font-medium">Today</h3>
                    <div class="space-y-3">
                        ${todayRecords.map(record => generateRecordHtml(record)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Yesterday's records
        if (yesterdayRecords.length > 0) {
            html += `
                <div class="date-group mb-6">
                    <h3 class="text-lg font-medium">Yesterday</h3>
                    <div class="space-y-3">
                        ${yesterdayRecords.map(record => generateRecordHtml(record)).join('')}
                    </div>
                </div>
            `;
        }
        
        // Older records
        if (olderRecords.length > 0) {
            html += `
                <div class="date-group">
                    <h3 class="text-lg font-medium">Older</h3>
                    <div class="space-y-3">
                        ${olderRecords.map(record => generateRecordHtml(record)).join('')}
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    };
    
    // Generate HTML for a single record
    const generateRecordHtml = (record) => {
        const researchId = record.research_id || record.id;
        const query = record.query || '';
        const depth = record.query_depth || record.depth || 0;
        const breadth = record.query_breadth || record.breadth || 0;
        const language = record.language || 'en-US';
        const status = record.status || 'unknown';
        const startTime = record.start_time ? new Date(record.start_time) : null;
        const endTime = record.end_time ? new Date(record.end_time) : null;
        const duration = calculateDuration(startTime, endTime);
        const formattedStartTime = startTime ? startTime.toLocaleTimeString() : '';

        console.log('record.output_filename:', record.output_filename);
        
        return `
            <div class="research-record p-4 bg-white rounded-md shadow-sm hover:shadow-md transition-all">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                    <h4 class="text-md font-medium">${query}</h4>
                    ${getStatusBadge(status)}
                </div>
                <div class="text-sm text-gray-500 mb-3">
                    ${formattedStartTime} · ${duration}
                </div>
                <div class="grid grid-cols-3 gap-2 mb-3">
                    <div class="stat-item">
                        <span class="text-xs text-gray-500">Depth:</span> ${depth}
                    </div>
                    <div class="stat-item">
                        <span class="text-xs text-gray-500">Breadth:</span> ${breadth}
                    </div>
                    <div class="stat-item">
                        <span class="text-xs text-gray-500">Language:</span> ${language.split('-')[0].toUpperCase()}
                    </div>
                </div>
                ${generateStatsHtml(record)}
                <div class="flex space-x-2 mt-3">
                    ${record.output_filename ? `
                        <button class="view-report-btn px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md text-sm hover:bg-indigo-200" 
                                data-research-id="${researchId}" data-filename="${record.output_filename}">
                            View Report
                        </button>
                        <button class="download-report-btn px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200"
                                data-research-id="${researchId}" data-filename="${record.output_filename}">
                            Download
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    };

    // Helper function to generate status badge HTML
    const getStatusBadge = (status) => {
        let badgeClass = '';
        let badgeText = '';
        
        switch(status.toLowerCase()) {
            case 'completed':
                badgeClass = 'bg-green-100 text-green-800';
                badgeText = 'Completed';
                break;
            case 'failed':
                badgeClass = 'bg-red-100 text-red-800';
                badgeText = 'Failed';
                break;
            case 'started':
                badgeClass = 'bg-blue-100 text-blue-800';
                badgeText = 'In Progress';
                break;
            default:
                badgeClass = 'bg-gray-100 text-gray-800';
                badgeText = 'Unknown';
        }
        
        return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${badgeText}</span>`;
    };

    // Helper function to calculate duration
    const calculateDuration = (startTime, endTime) => {
        if (!startTime) return 'Unknown duration';
        
        const end = endTime || new Date();
        const durationMs = end.getTime() - startTime.getTime();
        
        if (durationMs < 0) return 'Invalid duration';
        
        if (durationMs < 60000) {
            return `${Math.round(durationMs / 1000)}s`;
        } else if (durationMs < 3600000) {
            return `${Math.round(durationMs / 60000)}m`;
        } else {
            const hours = Math.floor(durationMs / 3600000);
            const minutes = Math.round((durationMs % 3600000) / 60000);
            return `${hours}h ${minutes}m`;
        }
    };

    // Helper function to generate stats HTML
    const generateStatsHtml = (record) => {
        const numReferences = record.num_references || 0;
        const numLearnings = record.num_learnings || 0;
        const visitedUrlsCount = record.visited_urls_count || 0;
        
        if (record.status === 'failed') {
            return `
                <div class="text-sm text-red-600 mt-2">
                    <span class="font-medium">Error:</span> ${record.error_message || 'Unknown error'}
                </div>
            `;
        }
        
        if (numReferences === 0 && numLearnings === 0 && visitedUrlsCount === 0) {
            return '';
        }
        
        return `
            <div class="grid grid-cols-2 gap-2">
                ${numReferences > 0 ? `
                    <div class="stat-item">
                        <span class="text-xs text-gray-500">References:</span> ${numReferences}
                    </div>
                ` : ''}
                ${numLearnings > 0 ? `
                    <div class="stat-item">
                        <span class="text-xs text-gray-500">Learnings:</span> ${numLearnings}
                    </div>
                ` : ''}
                ${visitedUrlsCount > 0 ? `
                    <div class="stat-item">
                        <span class="text-xs text-gray-500">URLs visited:</span> ${visitedUrlsCount}
                    </div>
                ` : ''}
            </div>
        `;
    };

    // Initialize all event handlers
    const initializeEventHandlers = () => {
        console.log('Initializing research history event handlers');
        
        // Handle PDF modal close button
        const closePdfModalButton = document.getElementById('closePdfModal');
        if (closePdfModalButton) {
            closePdfModalButton.addEventListener('click', () => {
                const pdfPreviewModal = document.getElementById('pdfPreviewModal');
                if (pdfPreviewModal) {
                    pdfPreviewModal.classList.remove('active');
                    pdfPreviewModal.classList.add('hidden');
                    pdfPreviewModal.style.display = 'none';
                    
                    // Clear the PDF viewer content
                    const pdfViewer = document.getElementById('pdfViewer');
                    if (pdfViewer) {
                        pdfViewer.innerHTML = '';
                    }
                }
            });
            console.log('PDF modal close button event listener added');
        }
        
        // Handle view report buttons
        document.querySelectorAll('.view-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const researchId = button.getAttribute('data-research-id');
                const filename = 'output/' + button.getAttribute('data-filename');
                console.log(`View report clicked for research: ${researchId}, filename: ${filename}`);
                
                if (filename) {
                    try {
                        // First ensure we're in the history tab
                        const historyTab = document.querySelector('.sidebar-item[data-tab="history"]');
                        if (historyTab && !historyTab.classList.contains('active')) {
                            console.log('Activating history tab before showing PDF');
                            historyTab.click();
                            
                            // Small delay to ensure tab switch is complete
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                        const pdfPreviewModal = document.getElementById('pdfPreviewModal');
                        const pdfViewer = document.getElementById('pdfViewer');
                        const closePdfModalButton = document.getElementById('closePdfModal');
                        const pdfDebugStatus = document.getElementById('pdfDebugStatus');

                        console.log('PDF modal exists:', !!pdfPreviewModal);
                        console.log('PDF viewer exists:', !!pdfViewer);
                        console.log('Close PDF button exists:', !!closePdfModalButton); 

                        if (pdfViewer) {
                            console.log('Showing modal and loading PDF');
                            // Show modal - using both active class (for CSS) and removing hidden class
                            pdfPreviewModal.classList.add('active');
                            pdfPreviewModal.classList.remove('hidden');
                            pdfPreviewModal.style.display = 'flex'; // Force display flex
        
                            // Update debug info
                            if (pdfDebugStatus) {
                                pdfDebugStatus.textContent = '正在加载PDF: ' + filename;
                            }
                            
                            // Load PDF in container
                            pdfViewer.innerHTML = `<iframe src="${filename}" width="100%" height="100%" frameborder="0"></iframe>`;
                            console.log('PDF iframe added to viewer');
                        } else {
                            console.error('PDF viewer element or PDF URL not found');
                        }
                    } catch (error) {
                        console.error('Error loading markdown preview:', error);
                        showNotification('Failed to load research report', 'error');
                    }
                } else {
                    console.error('No filename available for research report');
                    showNotification('Research report not available', 'error');
                }
            });
        });
        
        // Handle download report buttons
        document.querySelectorAll('.download-report-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const filename = button.getAttribute('data-filename');
                console.log(`Download report clicked for filename: ${filename}`);
                
                if (filename) {
                    try {
                        await downloadMarkdown(filename);
                    } catch (error) {
                        console.error('Error downloading report:', error);
                        showNotification('Failed to download research report', 'error');
                    }
                } else {
                    console.error('No filename available for research report');
                    showNotification('Research report not available', 'error');
                }
            });
        });
    };

    // Create a custom event for tab activation
    document.addEventListener('tabActivated', (e) => {
        if (e.detail.tabId === 'history') {
            console.log('History tab activated, loading content');
            loadResearchHistoryContent();
        }
    });

    // Initial load if history tab is active
    if (document.querySelector('.sidebar-item[data-tab="history"].active')) {
        console.log('History tab is initially active, loading content');
        loadResearchHistoryContent();
    }
    
    // Also listen for clicks on the history tab directly
    const historyTabItem = document.querySelector('.sidebar-item[data-tab="history"]');
    if (historyTabItem) {
        historyTabItem.addEventListener('click', () => {
            console.log('History tab clicked, dispatching tabActivated event');
            // Dispatch a custom event that the history tab was activated
            const event = new CustomEvent('tabActivated', { 
                detail: { tabId: 'history' } 
            });
            document.dispatchEvent(event);
        });
    }
});

// Export functions that need to be accessible from other modules
export { };
