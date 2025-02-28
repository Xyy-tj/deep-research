document.addEventListener('DOMContentLoaded', function() {
    initCaseLibrary();
});

// Research question templates
const questionTemplates = {
    // Academic templates
    'longjiang-water-quality': {
        title: '长江流域水质变化趋势研究',
        template: `请对长江流域近10年的水质变化趋势进行深入研究，具体需要:
1. 分析长江上、中、下游的水质指标变化
2. 探讨影响水质变化的主要工业和农业因素
3. 评估现有水污染治理政策的有效性
4. 提出改善长江水质的可行性建议
请提供详细的数据支持和案例分析。`
    },
    'chinese-philosophy': {
        title: '中国古代哲学思想演变',
        template: `请深入研究中国古代哲学思想的演变过程:
1. 分析先秦时期的儒、道、法等主要哲学流派的核心思想
2. 探讨汉唐时期儒家思想与佛教思想的融合与碰撞
3. 研究宋明理学的形成及其对中国传统文化的影响
4. 评估古代哲学思想对当代中国社会价值观的潜在影响
请结合历史背景和代表人物进行分析。`
    },
    
    // Business templates
    'ecommerce-trends': {
        title: '中国电子商务发展趋势',
        template: `请对中国电子商务市场的发展趋势进行全面分析:
1. 梳理过去5年中国电商市场的规模变化和主要平台格局
2. 分析新兴电商模式(如社交电商、直播电商)的发展特点和优势
3. 评估疫情后电商行业的变化和消费者行为转变
4. 预测未来3-5年中国电商行业可能出现的新趋势和机遇
请提供具体的数据支持和案例分析。`
    },
    'sharing-economy': {
        title: '共享经济商业模式分析',
        template: `请深入分析共享经济的商业模式及其在中国的发展:
1. 概述共享经济的基本概念和主要特征
2. 分析中国主要共享经济领域(出行、住宿、办公等)的代表企业商业模式
3. 探讨共享经济面临的法律、监管和可持续性挑战
4. 评估共享经济未来发展方向和创新可能性
请结合具体案例和数据进行分析。`
    },
    
    // Technology templates
    'ai-healthcare': {
        title: '人工智能在医疗领域的应用',
        template: `请详细研究人工智能在医疗健康领域的应用:
1. 分析AI在医疗诊断、影像识别、药物研发等方面的具体应用
2. 探讨中国AI医疗企业的代表性案例和技术突破
3. 评估AI医疗技术面临的数据隐私、伦理和监管挑战
4. 预测未来5年AI在医疗领域的发展趋势和突破方向
请结合实际案例和研究数据进行分析。`
    },
    'blockchain-fintech': {
        title: '区块链技术发展与应用',
        template: `请全面研究区块链技术的发展与金融科技应用:
1. 分析区块链技术的核心原理和技术演进历程
2. 探讨区块链在金融支付、供应链金融、数字货币等领域的应用案例
3. 评估中国区块链政策环境与技术发展现状
4. 研究区块链技术面临的可扩展性、安全性和监管挑战
请结合具体应用场景和案例进行分析。`
    },
    
    // Social templates
    'aging-society': {
        title: '城市老龄化社会问题研究',
        template: `请深入研究中国城市老龄化问题及其社会影响:
1. 分析中国主要城市老龄化程度和发展趋势
2. 探讨城市老龄化对医疗、养老、社会保障等方面的影响
3. 评估现有应对老龄化社会的政策措施及其效果
4. 借鉴国际经验，提出适合中国国情的应对城市老龄化的建议
请结合人口统计数据和具体城市案例进行分析。`
    },
    'rural-education': {
        title: '中国农村教育发展调查',
        template: `请全面研究中国农村教育的发展现状与挑战:
1. 分析中国农村基础教育的现状、资源分配和主要问题
2. 探讨城乡教育差距的具体表现和深层原因
3. 评估近年来农村教育扶持政策的实施效果
4. 提出促进农村教育公平与质量提升的可行建议
请结合具体数据和典型案例进行分析。`
    }
};

function initCaseLibrary() {
    // Initialize tabs
    initCategoryTabs();
    
    // Initialize template and PDF preview buttons
    initTemplateButtons();
    initPdfButtons();
    
    // Initialize modal close buttons
    initModalCloseButtons();
    
    // Initialize use template button
    initUseTemplateButton();
}

function initCategoryTabs() {
    const categoryTabs = document.querySelectorAll('.category-tab');
    const categoryContents = document.querySelectorAll('.category-content');
    
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            
            // Remove active class from all tabs and contents
            categoryTabs.forEach(t => t.classList.remove('active'));
            categoryContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to current tab and content
            this.classList.add('active');
            document.querySelector(`.category-content[data-category="${category}"]`).classList.add('active');
        });
    });
}

function initTemplateButtons() {
    const templateButtons = document.querySelectorAll('.view-template-btn');
    const templateModal = document.getElementById('templatePreviewModal');
    const templateTitle = document.getElementById('templatePreviewTitle');
    const templateContainer = document.getElementById('templatePreviewContainer');
    
    templateButtons.forEach(button => {
        button.addEventListener('click', function() {
            const templateId = this.getAttribute('data-template');
            const template = questionTemplates[templateId];
            
            if (template) {
                templateTitle.textContent = template.title;
                templateContainer.innerHTML = `<div class="template-content">
                    <pre class="template-text">${template.template}</pre>
                </div>`;
                
                // Show modal
                templateModal.classList.remove('hidden');
                templateModal.classList.add('active');
            }
        });
    });
}

function initPdfButtons() {
    const pdfButtons = document.querySelectorAll('.view-pdf-btn');
    const pdfModal = document.getElementById('pdfPreviewModal');
    const pdfTitle = document.getElementById('pdfPreviewTitle');
    const pdfViewer = document.getElementById('pdfViewer');
    const pdfDebugStatus = document.getElementById('pdfDebugStatus');
    
    // Make sure the container is visible and has appropriate styling
    if (pdfViewer) {
        pdfViewer.style.minHeight = '500px';
        pdfViewer.style.width = '100%';
        pdfViewer.style.position = 'relative';
        pdfViewer.style.overflow = 'auto';
        pdfViewer.style.backgroundColor = '#f8f9fa';
    }
    
    pdfButtons.forEach(button => {
        button.addEventListener('click', function() {
            const pdfPath = this.getAttribute('data-pdf');
            const pdfName = this.parentNode.parentNode.querySelector('.example-title').textContent;
            
            pdfTitle.textContent = `${pdfName} - PDF预览`;
            
            // Update debug status
            if (pdfDebugStatus) {
                pdfDebugStatus.textContent = `准备加载: ${pdfPath}`;
            }
            
            // Clear the viewer before loading
            if (pdfViewer) {
                pdfViewer.innerHTML = '<div class="loading-indicator" style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> 加载PDF中...</div>';
            }
            
            // Show modal immediately for better user experience
            pdfModal.classList.remove('hidden');
            pdfModal.classList.add('active');
            
            // Load PDF using PDF.js
            console.log('Clicking PDF button, loading PDF:', pdfPath);
            setTimeout(() => {
                if (pdfDebugStatus) {
                    pdfDebugStatus.textContent = `正在加载: ${pdfPath}`;
                }
                loadPDF(pdfPath, pdfViewer);
            }, 100); // Small delay to ensure modal is visible first
        });
    });
    
    // Close modal functionality
    const closeButtons = document.querySelectorAll('#closePdfModal, .pdf-preview-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            // Only close if clicking on the backdrop or the close button
            if (event.target === this || event.target.id === 'closePdfModal') {
                pdfModal.classList.remove('active');
                pdfModal.classList.add('hidden');
                // Clear the viewer when closing
                if (pdfViewer) {
                    pdfViewer.innerHTML = '';
                }
                if (pdfDebugStatus) {
                    pdfDebugStatus.textContent = '等待加载';
                }
            }
        });
    });
}

function loadPDF(pdfPath, container) {
    // Clear the container
    container.innerHTML = '';
    
    // Create loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载PDF中...';
    container.appendChild(loadingIndicator);
    
    // Debug info - show path being loaded
    console.log('Attempting to load PDF from:', pdfPath);

    // Check if path is empty or invalid
    if (!pdfPath || pdfPath === '' || pdfPath === '#') {
        container.innerHTML = '<p class="error-message">PDF文件路径无效。请稍后再试。</p>';
        return;
    }
    
    // Handle PDF.js library - in newer versions, it might be exposed as 'pdfjsLib' or just 'window.pdfjsLib'
    let pdfJsLib;
    
    if (typeof pdfjsLib !== 'undefined') {
        pdfJsLib = pdfjsLib;
    } else if (typeof window.pdfjsLib !== 'undefined') {
        pdfJsLib = window.pdfjsLib;
    } else if (typeof window.pdfjsLib === 'undefined' && typeof window.pdfjs !== 'undefined') {
        pdfJsLib = window.pdfjs;
    } else {
        container.innerHTML = '<p class="error-message">PDF.js 库未加载或无法识别，无法预览PDF文件。</p>';
        console.error('PDF.js library not found');
        return;
    }
    
    // Ensure PDF.js worker is set
    if (!pdfJsLib.GlobalWorkerOptions || !pdfJsLib.GlobalWorkerOptions.workerSrc) {
        pdfJsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }
    
    // Check if getDocument exists and is a function
    if (typeof pdfJsLib.getDocument !== 'function') {
        container.innerHTML = '<p class="error-message">PDF.js 库加载不完整，无法找到 getDocument 方法。</p>';
        console.error('pdfJsLib.getDocument is not a function');
        return;
    }
    
    // Load the PDF
    try {
        // Check if the path is relative and make it absolute if needed
        const fullPath = pdfPath.startsWith('/') ? window.location.origin + pdfPath : pdfPath;
        console.log('Full PDF path:', fullPath);
        
        // Create a visible test element to confirm the container is working
        container.innerHTML = `
            <div style="padding: 20px; background-color: #e3f2fd; margin-bottom: 15px; border-radius: 4px; text-align: center;">
                正在加载PDF: ${fullPath}
            </div>
        `;
        
        // Add a check to verify if the file exists using fetch
        fetch(fullPath, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`PDF文件不存在或无法访问 (${response.status} ${response.statusText})`);
                }
                return response;
            })
            .then(() => {
                console.log('PDF文件存在，正在加载...');
                
                // Create loading task
                const loadingTask = pdfJsLib.getDocument({
                    url: fullPath,
                    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/cmaps/',
                    cMapPacked: true,
                });
                
                loadingTask.promise
                    .then(function(pdf) {
                        console.log('PDF加载成功:', pdf);
                        
                        // Update debug status
                        const debugStatus = document.getElementById('pdfDebugStatus');
                        if (debugStatus) {
                            debugStatus.textContent = `PDF已成功加载: ${pdf.numPages} 页`;
                            debugStatus.style.color = 'green';
                        }
                        
                        // Force style update to ensure container is visible
                        container.style.display = 'block';
                        container.style.visibility = 'visible';
                        container.style.minHeight = '500px';
                        
                        // Remove loading indicator and clear container completely
                        container.innerHTML = '';
                        
                        // Debug - add a visible indicator
                        const debugElement = document.createElement('div');
                        debugElement.style.padding = '5px';
                        debugElement.style.background = '#f0f8ff';
                        debugElement.style.marginBottom = '10px';
                        debugElement.style.fontSize = '14px';
                        debugElement.textContent = `PDF已加载: ${pdf.numPages} 页`;
                        container.appendChild(debugElement);
                        
                        // Create canvas container with explicit styling
                        const canvasContainer = document.createElement('div');
                        canvasContainer.className = 'pdf-canvas-container';
                        canvasContainer.style.width = '100%';
                        canvasContainer.style.minHeight = '500px'; // Ensure visible height
                        canvasContainer.style.border = '1px solid #ccc';
                        canvasContainer.style.overflow = 'auto';
                        canvasContainer.style.backgroundColor = '#f9f9f9';
                        container.appendChild(canvasContainer);
                        
                        // Create pagination controls
                        const paginationControls = document.createElement('div');
                        paginationControls.className = 'pdf-pagination';
                        paginationControls.innerHTML = `
                            <button id="pdf-prev-page" class="pagination-btn" disabled><i class="fas fa-chevron-left"></i> 上一页</button>
                            <span id="pdf-page-info">第 1 页，共 ${pdf.numPages} 页</span>
                            <button id="pdf-next-page" class="pagination-btn"><i class="fas fa-chevron-right"></i> 下一页</button>
                        `;
                        container.appendChild(paginationControls);
                        
                        // Current page
                        let currentPage = 1;
                        
                        // Render first page
                        renderPage(pdf, currentPage, canvasContainer);
                        
                        // Add event listeners for pagination - using querySelector relative to container to avoid conflicts
                        const prevButton = container.querySelector('#pdf-prev-page');
                        const nextButton = container.querySelector('#pdf-next-page');
                        const pageInfo = container.querySelector('#pdf-page-info');
                        
                        if (prevButton) {
                            prevButton.addEventListener('click', function() {
                                if (currentPage > 1) {
                                    currentPage--;
                                    renderPage(pdf, currentPage, canvasContainer);
                                    updatePagination();
                                }
                            });
                        }
                        
                        if (nextButton) {
                            nextButton.addEventListener('click', function() {
                                if (currentPage < pdf.numPages) {
                                    currentPage++;
                                    renderPage(pdf, currentPage, canvasContainer);
                                    updatePagination();
                                }
                            });
                        }
                        
                        // Update pagination buttons
                        function updatePagination() {
                            if (pageInfo) {
                                pageInfo.textContent = `第 ${currentPage} 页，共 ${pdf.numPages} 页`;
                            }
                            if (prevButton) {
                                prevButton.disabled = currentPage === 1;
                            }
                            if (nextButton) {
                                nextButton.disabled = currentPage === pdf.numPages;
                            }
                        }
                    })
                    .catch(function(error) {
                        // Handle error with PDF.js
                        console.error('PDF.js加载错误:', error);
                        container.innerHTML = `<p class="error-message">PDF加载失败: ${error.message}</p>`;
                    });
            })
            .catch(error => {
                console.error('文件检查错误:', error);
                container.innerHTML = `<p class="error-message">PDF文件暂未上传或无法访问: ${error.message}</p>`;
            });
    } catch (error) {
        console.error('加载过程中发生错误:', error);
        container.innerHTML = `<p class="error-message">加载PDF时出错: ${error.message}</p>`;
    }
}

function renderPage(pdf, pageNumber, container) {
    console.log(`Rendering page ${pageNumber}`);
    
    // Update debug status
    const debugStatus = document.getElementById('pdfDebugStatus');
    if (debugStatus) {
        debugStatus.textContent = `正在渲染第 ${pageNumber} 页`;
    }
    
    // Clear previous pages from container
    container.innerHTML = '';
    
    // Get page
    pdf.getPage(pageNumber).then(function(page) {
        console.log(`Retrieved page ${pageNumber} successfully`);
        
        // Calculate scale to fit within container width
        const containerWidth = container.clientWidth || 800; // Default if container has no width yet
        const pageWidth = page.getViewport({ scale: 1.0 }).width;
        const scale = Math.min(1.5, containerWidth / pageWidth); // Use 1.5 as max scale
        
        const viewport = page.getViewport({ scale: scale });
        
        // Create a canvas for this page
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.className = 'pdf-page';
        
        // Add explicit styling to make sure canvas is visible
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto'; // Center the canvas
        canvas.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)';
        canvas.style.backgroundColor = 'white';
        canvas.style.zIndex = '100'; // Ensure it's above other elements
        canvas.style.position = 'relative'; // Needed for z-index to work
        
        // Add the canvas to the container
        container.appendChild(canvas);
        
        // Render the page content
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        const renderTask = page.render(renderContext);
        
        renderTask.promise.then(function() {
            console.log(`Page ${pageNumber} rendered successfully`);
            
            // Update debug status
            const debugStatus = document.getElementById('pdfDebugStatus');
            if (debugStatus) {
                debugStatus.textContent = `第 ${pageNumber} 页渲染成功 (共 ${pdf.numPages} 页)`;
                debugStatus.style.color = 'green';
            }
            
            // Add overlay to confirm rendering completed
            const overlayText = document.createElement('div');
            overlayText.style.position = 'absolute';
            overlayText.style.bottom = '10px';
            overlayText.style.right = '10px';
            overlayText.style.background = 'rgba(0,0,0,0.5)';
            overlayText.style.color = 'white';
            overlayText.style.padding = '5px 10px';
            overlayText.style.borderRadius = '3px';
            overlayText.style.fontSize = '12px';
            overlayText.textContent = `页面 ${pageNumber} 渲染完成`;
            container.appendChild(overlayText);
            
            // Remove overlay after 2 seconds
            setTimeout(() => {
                if (overlayText.parentNode) {
                    overlayText.parentNode.removeChild(overlayText);
                }
            }, 2000);
        }).catch(function(error) {
            console.error('Error rendering PDF page:', error);
            const errorMsg = document.createElement('p');
            errorMsg.className = 'error-message';
            errorMsg.textContent = '渲染PDF页面时出错: ' + error.message;
            container.appendChild(errorMsg);
        });
    }).catch(function(error) {
        console.error(`Error retrieving page ${pageNumber}:`, error);
        container.innerHTML = `<p class="error-message">无法获取第 ${pageNumber} 页: ${error.message}</p>`;
    });
}

function initModalCloseButtons() {
    // Close PDF modal
    document.getElementById('closePdfModal').addEventListener('click', function() {
        const pdfModal = document.getElementById('pdfPreviewModal');
        pdfModal.classList.remove('active');
        setTimeout(() => {
            pdfModal.classList.add('hidden');
        }, 300);
    });
    
    // Close template modal
    document.getElementById('closeTemplateModal').addEventListener('click', function() {
        const templateModal = document.getElementById('templatePreviewModal');
        templateModal.classList.remove('active');
        setTimeout(() => {
            templateModal.classList.add('hidden');
        }, 300);
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const pdfModal = document.getElementById('pdfPreviewModal');
        const templateModal = document.getElementById('templatePreviewModal');
        
        if (event.target === pdfModal) {
            pdfModal.classList.remove('active');
            setTimeout(() => {
                pdfModal.classList.add('hidden');
            }, 300);
        }
        
        if (event.target === templateModal) {
            templateModal.classList.remove('active');
            setTimeout(() => {
                templateModal.classList.add('hidden');
            }, 300);
        }
    });
}

function initUseTemplateButton() {
    const useTemplateBtn = document.getElementById('useTemplateBtn');
    
    useTemplateBtn.addEventListener('click', function() {
        const templateContent = document.querySelector('.template-text');
        if (templateContent) {
            // Get template text
            const templateText = templateContent.textContent;
            
            // Close the modal
            document.getElementById('closeTemplateModal').click();
            
            // Navigate to research tab
            document.querySelector('.sidebar-item[data-tab="research"]').click();
            
            // Set template text to query textarea
            setTimeout(() => {
                const queryTextarea = document.getElementById('query');
                if (queryTextarea) {
                    queryTextarea.value = templateText;
                    queryTextarea.focus();
                    
                    // Trigger input event to resize textarea if needed
                    const event = new Event('input', { bubbles: true });
                    queryTextarea.dispatchEvent(event);
                }
            }, 500);
        }
    });
}
