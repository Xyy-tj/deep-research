import { Auth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize auth
    const auth = Auth.getInstance();
    
    // Check if user is authenticated
    const isAuthenticated = auth.isAuthenticated || await auth.checkAuth();
    
    // If authenticated and on welcome.html, redirect to main app
    if (isAuthenticated && window.location.pathname.includes('welcome.html')) {
        window.location.href = '/index.html';
    }
});
