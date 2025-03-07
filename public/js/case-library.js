// Case Library JavaScript
document.addEventListener('DOMContentLoaded', () => {
    console.log('Case Library JS loaded');
    // Load case library content into the case library tab
    const loadCaseLibraryContent = async () => {
        try {
            console.log('Attempting to load case library content');
            const response = await fetch('/case-library.html');
            if (response.ok) {
                const html = await response.text();
                const container = document.getElementById('caseLibraryContainer');
                console.log('Case library container found:', !!container);
                if (container) {
                    container.innerHTML = html;
                    console.log('Content loaded into container, initializing handlers');
                    initializeEventHandlers();
                } else {
                    console.error('Case library container not found in the DOM');
                }
            } else {
                console.error('Failed to load case library content:', response.status);
            }
        } catch (error) {
            console.error('Error loading case library content:', error);
        }
    };

    // Initialize all event handlers
    const initializeEventHandlers = () => {
        console.log('Initializing event handlers');
        
        // Initialize image fallbacks
        const setupImageFallbacks = () => {
            const previewImages = document.querySelectorAll('.preview-image img');
            
            previewImages.forEach(img => {
                // Set the error handler
                img.onerror = function() {
                    this.style.display = 'none';
                    this.parentNode.classList.add('no-image');
                    
                    // Create fallback element if it doesn't already exist
                    if (!this.parentNode.querySelector('.preview-fallback')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'preview-fallback';
                        
                        const span = document.createElement('span');
                        span.textContent = this.alt || this.closest('.research-example-card').querySelector('.example-title').textContent;
                        
                        fallback.appendChild(span);
                        this.parentNode.appendChild(fallback);
                    }
                };
                
                // If the image is already loaded but broken, trigger the error handler
                if (img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
                    img.onerror();
                }
            });
        };
        
        // Call the setup function
        setupImageFallbacks();

        // Category tab switching
        const categoryTabs = document.querySelectorAll('.category-tab');
        const categoryContents = document.querySelectorAll('.category-content');
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                
                // Update active tab
                categoryTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show corresponding content
                categoryContents.forEach(content => {
                    if (content.getAttribute('data-category') === category) {
                        content.classList.add('active');
                    } else {
                        content.classList.remove('active');
                    }
                });
            });
        });

        // Handle PDF preview buttons
        const viewPdfButtons = document.querySelectorAll('.view-pdf-btn');
        const pdfPreviewModal = document.getElementById('pdfPreviewModal');
        const pdfViewer = document.getElementById('pdfViewer');
        const closePdfModalButton = document.getElementById('closePdfModal');
        const pdfDebugStatus = document.getElementById('pdfDebugStatus');

        viewPdfButtons.forEach((button, index) => {
            button.addEventListener('click', (e) => {
                const pdfUrl = button.getAttribute('data-pdf');
                
                if (pdfUrl && pdfViewer) {
                    // Show modal - using both active class (for CSS) and removing hidden class
                    pdfPreviewModal.classList.add('active');
                    pdfPreviewModal.classList.remove('hidden');
                    pdfPreviewModal.style.display = 'flex'; // Force display flex

                    // Update debug info
                    if (pdfDebugStatus) {
                        pdfDebugStatus.textContent = '正在加载PDF: ' + pdfUrl;
                    }
                    
                    // Load PDF in container
                    pdfViewer.innerHTML = `<iframe src="${pdfUrl}" width="100%" height="100%" frameborder="0"></iframe>`;
                } else {
                    console.error('PDF viewer element or PDF URL not found');
                }
            });
        });

        // Close modal when clicking close button
        if (closePdfModalButton) {
            closePdfModalButton.addEventListener('click', () => {
                pdfPreviewModal.classList.remove('active');
                pdfPreviewModal.classList.add('hidden');
                pdfPreviewModal.style.display = 'none';
            });
        } else {
            console.error('Close PDF modal button not found');
        }

        // Close modal when clicking outside
        if (pdfPreviewModal) {
            pdfPreviewModal.addEventListener('click', (e) => {
                console.log('PDF modal clicked:', e.target === pdfPreviewModal);
                if (e.target === pdfPreviewModal) {
                    pdfPreviewModal.classList.remove('active');
                    pdfPreviewModal.classList.add('hidden');
                    pdfPreviewModal.style.display = 'none';
                }
            });
        }

        // Handle template view buttons
        const viewTemplateButtons = document.querySelectorAll('.view-template-btn');
        const templatePreviewModal = document.getElementById('templatePreviewModal');
        const templatePreviewContainer = document.getElementById('templatePreviewContainer');
        const closeTemplateModalButton = document.getElementById('closeTemplateModal');
        
        console.log('Found template buttons:', viewTemplateButtons.length);
        console.log('Template modal exists:', !!templatePreviewModal);
        
        viewTemplateButtons.forEach(button => {
            button.addEventListener('click', () => {
                const templateId = button.getAttribute('data-template');
                console.log(`Loading template: ${templateId}`);
                
                if (templatePreviewModal && templatePreviewContainer) {
                    // Show the template modal - using both active class and removing hidden
                    templatePreviewModal.classList.add('active');
                    templatePreviewModal.classList.remove('hidden');
                    templatePreviewModal.style.display = 'flex'; // Force display flex
                    
                    // Load the actual template content from the templates directory
                    fetch(`/templates/${templateId}.html`)
                        .then(response => {
                            if (response.ok) {
                                return response.text();
                            } else {
                                throw new Error(`Template not found: ${response.status}`);
                            }
                        })
                        .then(html => {
                            // Check if the returned HTML is likely to be the index.html page
                            // by looking for tell-tale signs of the main page
                            if (html.includes('<title>深度研究助手') || 
                                html.includes('id="app"') || 
                                html.includes('navbar-container')) {
                                // This is likely the index.html page, not a template
                                throw new Error('Template not available');
                            }
                            templatePreviewContainer.innerHTML = html;
                        })
                        .catch(error => {
                            console.error('Error loading template:', error);
                            templatePreviewContainer.innerHTML = `<p class="text-center py-8 text-gray-600">暂无提问模板</p>`;
                        });
                }
            });
        });
        
        // Close template modal
        if (closeTemplateModalButton && templatePreviewModal) {
            closeTemplateModalButton.addEventListener('click', () => {
                templatePreviewModal.classList.remove('active');
                templatePreviewModal.classList.add('hidden');
                templatePreviewModal.style.display = 'none';
            });
        }
    };

    // Load case library content when the page loads
    loadCaseLibraryContent();
});
