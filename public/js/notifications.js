// Notifications utility functions

/**
 * Show a notification message to the user
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, warning, info)
 * @param {number} duration - How long to show the notification in milliseconds
 */
export function showNotification(message, type = 'success', duration = 3000) {
    const notificationDiv = document.createElement('div');
    
    // Set appropriate styling based on notification type
    let iconHtml = '';
    let bgColor = '';
    let borderColor = '';
    let textColor = '';
    
    switch (type) {
        case 'success':
            iconHtml = '<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>';
            bgColor = 'bg-green-50';
            borderColor = 'border-green-500';
            textColor = 'text-green-700';
            break;
        case 'error':
            iconHtml = '<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>';
            bgColor = 'bg-red-50';
            borderColor = 'border-red-500';
            textColor = 'text-red-700';
            break;
        case 'warning':
            iconHtml = '<svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>';
            bgColor = 'bg-yellow-50';
            borderColor = 'border-yellow-500';
            textColor = 'text-yellow-700';
            break;
        case 'info':
        default:
            iconHtml = '<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>';
            bgColor = 'bg-blue-50';
            borderColor = 'border-blue-500';
            textColor = 'text-blue-700';
    }
    
    notificationDiv.className = `fixed bottom-4 right-4 ${bgColor} border-l-4 ${borderColor} p-4 z-50 notification-animation`;
    notificationDiv.innerHTML = `
        <div class="flex">
            <div class="flex-shrink-0">
                ${iconHtml}
            </div>
            <div class="ml-3">
                <p class="text-sm ${textColor}">${message}</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notificationDiv);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        .notification-animation {
            animation: slideIn 0.3s ease-out forwards, fadeOut 0.5s ease-in forwards ${duration/1000 - 0.5}s;
            transform: translateX(100%);
            opacity: 0;
        }
        
        @keyframes slideIn {
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes fadeOut {
            to {
                opacity: 0;
                transform: translateY(10px);
            }
        }
    `;
    document.head.appendChild(style);
    
    // Remove the notification after the specified duration
    setTimeout(() => {
        if (notificationDiv.parentNode) {
            document.body.removeChild(notificationDiv);
        }
    }, duration);
}
