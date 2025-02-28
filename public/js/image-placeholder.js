document.addEventListener('DOMContentLoaded', function() {
    // Find all image elements with src pointing to example images
    const exampleImages = document.querySelectorAll('img[src^="/images/examples/"]');
    
    // Replace with placeholder colored divs
    exampleImages.forEach(img => {
        const originalSrc = img.getAttribute('src');
        const alt = img.getAttribute('alt') || 'Example Image';
        
        // Get category from image src
        let category = 'default';
        if (originalSrc.includes('academic')) {
            category = 'academic';
        } else if (originalSrc.includes('business')) {
            category = 'business';
        } else if (originalSrc.includes('tech')) {
            category = 'technology';
        } else if (originalSrc.includes('social')) {
            category = 'social';
        }
        
        // Create a colored placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'placeholder-image';
        placeholder.style.height = '100%';
        placeholder.style.width = '100%';
        placeholder.style.display = 'flex';
        placeholder.style.alignItems = 'center';
        placeholder.style.justifyContent = 'center';
        placeholder.style.color = 'white';
        placeholder.style.fontWeight = 'bold';
        
        // Set background color based on category
        switch(category) {
            case 'academic':
                placeholder.style.backgroundColor = '#4f46e5'; // Indigo
                break;
            case 'business':
                placeholder.style.backgroundColor = '#0891b2'; // Cyan
                break;
            case 'technology':
                placeholder.style.backgroundColor = '#16a34a'; // Green
                break;
            case 'social':
                placeholder.style.backgroundColor = '#ea580c'; // Orange
                break;
            default:
                placeholder.style.backgroundColor = '#6b7280'; // Gray
        }
        
        // Add text
        placeholder.textContent = alt;
        
        // Replace the image with the placeholder
        const parent = img.parentNode;
        parent.replaceChild(placeholder, img);
    });
    
    // Find all image elements in research-example-card components
    const exampleImagesInCards = document.querySelectorAll('.research-example-card .preview-image img');
    
    // Apply placeholders to all example images
    exampleImagesInCards.forEach(img => {
        // Save the original src for potential future loading
        const originalSrc = img.getAttribute('src');
        
        // Set a placeholder background color
        img.parentElement.style.backgroundColor = '#f0f0f0';
        
        // Create a placeholder with an icon
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'image-placeholder flex items-center justify-center h-full';
        placeholderDiv.innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
        placeholderDiv.style.height = '180px'; // Set appropriate height
        
        // Replace the img with the placeholder
        img.style.display = 'none';
        img.parentElement.appendChild(placeholderDiv);
    });
    
    // Handle PDF preview button clicks - modify to use a message instead of trying to load PDFs
    const pdfButtons = document.querySelectorAll('.view-pdf-btn');
    pdfButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get the modal and show a message instead
            const pdfModal = document.getElementById('pdfPreviewModal');
            const modalContent = pdfModal.querySelector('.modal-content');
            
            // Clear any existing content
            while(modalContent.firstChild) {
                modalContent.removeChild(modalContent.firstChild);
            }
            
            // Add header with close button
            const header = document.createElement('div');
            header.className = 'modal-header flex justify-between items-center mb-4';
            header.innerHTML = `
                <h3 class="text-xl font-bold">PDF预览</h3>
                <button class="close-modal-btn"><i class="fas fa-times"></i></button>
            `;
            modalContent.appendChild(header);
            
            // Add message about missing PDF
            const message = document.createElement('div');
            message.className = 'p-4 bg-gray-100 rounded-lg text-center';
            message.innerHTML = `
                <i class="fas fa-exclamation-circle text-3xl text-yellow-500 mb-3"></i>
                <p class="text-lg">PDF文件暂未上传。请稍后再试。</p>
            `;
            modalContent.appendChild(message);
            
            // Show the modal
            pdfModal.classList.remove('hidden');
            
            // Add event listener to close button
            pdfModal.querySelector('.close-modal-btn').addEventListener('click', function() {
                pdfModal.classList.add('hidden');
            });
        });
    });
});
