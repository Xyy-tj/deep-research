// Utility functions for the deep-research application

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, warning, info)
 */
export function showToast(message, type = 'info') {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed top-4 right-4 z-50 flex flex-col items-end space-y-2';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    
    // Set appropriate classes based on type
    let bgColor = 'bg-blue-500';
    let icon = '<i class="fas fa-info-circle mr-2"></i>';
    
    switch (type) {
        case 'success':
            bgColor = 'bg-green-500';
            icon = '<i class="fas fa-check-circle mr-2"></i>';
            break;
        case 'error':
            bgColor = 'bg-red-500';
            icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
            break;
        case 'warning':
            bgColor = 'bg-yellow-500';
            icon = '<i class="fas fa-exclamation-triangle mr-2"></i>';
            break;
    }
    
    toast.className = `${bgColor} text-white px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 flex items-center max-w-xs`;
    toast.innerHTML = `${icon}${message}`;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('translate-x-0', 'opacity-100');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}
