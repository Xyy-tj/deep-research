// PDF Viewer implementation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize PDF viewer functionality
    initPDFViewer();
});

function initPDFViewer() {
    // Get required elements
    const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
    
    // Global pdfjsLib variable
    window.pdfjsLib = window.pdfjsLib || {};
    
    // Initialize PDF.js library
    function loadPDFJSLibrary(callback) {
        if (typeof pdfjsLib.getDocument !== 'undefined') {
            // Library already loaded
            callback();
            return;
        }
        
        // Load PDF.js library
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.onload = function() {
            // Set worker source
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            callback();
        };
        document.head.appendChild(script);
    }
    
    // Create canvas for each page
    function renderPage(pdf, pageNumber, container) {
        pdf.getPage(pageNumber).then(function(page) {
            const viewport = page.getViewport({ scale: 1.5 });
            
            // Create canvas for this page
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Add canvas to container
            container.appendChild(canvas);
            
            // Render PDF page into canvas context
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            page.render(renderContext).promise.then(function() {
                // Check if there are more pages to render
                if (pageNumber < pdf.numPages) {
                    renderPage(pdf, pageNumber + 1, container);
                }
            });
        });
    }
    
    // Main function to display PDF
    window.displayPDF = function(file) {
        // Show loading indicator
        pdfPreviewContainer.innerHTML = '<div class="flex justify-center items-center h-full"><div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div></div>';
        
        // Load PDF.js if needed
        loadPDFJSLibrary(function() {
            // Create file URL
            const fileURL = URL.createObjectURL(file);
            
            // Load the PDF file
            const loadingTask = pdfjsLib.getDocument(fileURL);
            
            loadingTask.promise.then(function(pdf) {
                // Clear preview container
                pdfPreviewContainer.innerHTML = '';
                
                // Create container for PDF pages
                const pagesContainer = document.createElement('div');
                pagesContainer.className = 'pdf-pages';
                pdfPreviewContainer.appendChild(pagesContainer);
                
                // Render first page (renderPage will handle subsequent pages)
                renderPage(pdf, 1, pagesContainer);
            }).catch(function(error) {
                console.error('Error loading PDF:', error);
                pdfPreviewContainer.innerHTML = `<p class="text-red-500 p-4">Error loading PDF: ${error.message}</p>`;
            });
        });
    };
    
    // Function to clear the preview
    window.clearPDFPreview = function() {
        if (pdfPreviewContainer) {
            pdfPreviewContainer.innerHTML = '<p class="text-gray-500 italic" data-i18n="selectPdfToPreview">Select a PDF file to preview</p>';
        }
    };
}
