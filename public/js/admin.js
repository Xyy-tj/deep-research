/**
 * Admin Panel Functionality for Deep Research
 */
import { Auth } from './auth.js';

// Admin state
const adminState = {
    users: [],
    invitationCodes: [],
    payments: [],
    systemSettings: {
        baseCredits: 2,
        depthMultiplier: 1,
        breadthMultiplier: 0.5
    }
};

// Helper function to get auth headers
async function getAuthHeaders() {
    const token = await Auth.getInstance().getTokenAsync();
    console.log('Auth token for API request:', token ? 'Token exists' : 'No token');
    
    if (!token) {
        // 如果没有token，尝试重新验证
        console.log('No token found, trying to re-authenticate...');
        await Auth.getInstance().checkAuth();
        const newToken = await Auth.getInstance().getTokenAsync();
        console.log('After re-auth, token exists:', !!newToken);
    }
    
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
    };
}

// Initialize admin panel
async function initAdminPanel() {
    try {
        console.log('Initializing admin panel...');
        
        // 确保用户已经认证
        await Auth.getInstance().checkAuth();
        
        // Check if user is admin
        const user = await Auth.getInstance().getCurrentUser();
        console.log('Current user:', user);
        
        if (!user) {
            console.error('No user information available');
            window.location.href = 'index.html';
            return;
        }
        
        // Check admin status - user.isAdmin might be coming from JWT payload
        if (!user.isAdmin && user.is_admin !== 1 && user.is_admin !== true) {
            console.error('User is not an admin', user);
            window.location.href = 'index.html';
            return;
        }

        // Display admin info
        document.getElementById('adminInfo').textContent = `Logged in as: ${user.username} (Admin)`;

        // Initialize tabs
        initTabs();
        
        // 确保我们有有效的token
        const token = await Auth.getInstance().getTokenAsync();
        if (!token) {
            console.error('No valid token available');
            window.location.href = 'index.html';
            return;
        }

        // Load initial data
        await loadUsers();
        await loadInvitationCodes();
        await loadPayments();
        await loadSystemSettings();

        // Add event listeners
        addEventListeners();
    } catch (error) {
        console.error('Failed to initialize admin panel:', error);
        showError('Failed to initialize admin panel. Please try again later.');
        // Redirect to index on error
        window.location.href = 'index.html';
    }
}

// Initialize tabs
function initTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });
}

// Add event listeners
function addEventListeners() {
    // Search users
    document.getElementById('searchUsersBtn').addEventListener('click', searchUsers);
    document.getElementById('userSearchInput').addEventListener('keyup', event => {
        if (event.key === 'Enter') {
            searchUsers();
        }
    });

    // Generate invitation codes
    document.getElementById('generateCodesBtn').addEventListener('click', generateInvitationCodes);

    // Search payments
    document.getElementById('searchPaymentsBtn').addEventListener('click', searchPayments);
    document.getElementById('paymentSearchInput').addEventListener('keyup', event => {
        if (event.key === 'Enter') {
            searchPayments();
        }
    });

    // Save system settings
    document.getElementById('saveSystemSettingsBtn').addEventListener('click', saveSystemSettings);

    // Edit credits modal
    document.getElementById('closeCreditsModal').addEventListener('click', () => {
        document.getElementById('editCreditsModal').style.display = 'none';
    });
    document.getElementById('saveCreditsBtn').addEventListener('click', saveUserCredits);

    // Close modal when clicking outside
    window.addEventListener('click', event => {
        const modal = document.getElementById('editCreditsModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await Auth.getInstance().logout();
        window.location.href = 'index.html';
    });
}

// Load users
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: await getAuthHeaders(),
            credentials: 'include' // Include cookies for auth
        });

        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const data = await response.json();
        adminState.users = data.users;
        renderUsers(adminState.users);
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('userTableBody').innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-red-500">
                    Failed to load users. ${error.message}
                </td>
            </tr>
        `;
    }
}

// Render users table
function renderUsers(users) {
    const tableBody = document.getElementById('userTableBody');
    
    if (!users || users.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">No users found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${user.credits}</td>
            <td>${user.is_admin ? 'Yes' : 'No'}</td>
            <td>${user.is_verified ? 'Yes' : 'No'}</td>
            <td>${formatDate(user.created_at)}</td>
            <td>
                <button class="btn-small edit-credits-btn" data-user-id="${user.id}" data-credits="${user.credits}">
                    Edit Credits
                </button>
            </td>
        </tr>
    `).join('');

    // Add event listeners to edit credits buttons
    document.querySelectorAll('.edit-credits-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.getAttribute('data-user-id');
            const credits = btn.getAttribute('data-credits');
            openEditCreditsModal(userId, credits);
        });
    });
}

// Search users
function searchUsers() {
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
    
    if (!searchTerm) {
        renderUsers(adminState.users);
        return;
    }

    const filteredUsers = adminState.users.filter(user => 
        user.username.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.id.toString().includes(searchTerm)
    );

    renderUsers(filteredUsers);
}

// Open edit credits modal
function openEditCreditsModal(userId, credits) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('currentCredits').textContent = credits;
    document.getElementById('creditsAmount').value = '10';
    document.getElementById('creditsOperation').value = 'add';
    document.getElementById('creditsNote').value = '';
    document.getElementById('editCreditsAlert').style.display = 'none';
    document.getElementById('editCreditsModal').style.display = 'block';
}

// Save user credits
async function saveUserCredits() {
    try {
        const userId = document.getElementById('editUserId').value;
        const operation = document.getElementById('creditsOperation').value;
        const amount = parseInt(document.getElementById('creditsAmount').value);
        const note = document.getElementById('creditsNote').value;

        if (isNaN(amount) || amount <= 0) {
            showModalAlert('Please enter a valid amount', 'danger');
            return;
        }

        const saveBtn = document.getElementById('saveCreditsBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading"></span> Saving...';

        const response = await fetch('/api/admin/users/credits', {
            method: 'POST',
            headers: await getAuthHeaders(),
            credentials: 'include', // Include cookies for auth
            body: JSON.stringify({
                userId,
                operation,
                amount,
                note
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update credits');
        }

        const result = await response.json();
        
        // Update user in state
        const userIndex = adminState.users.findIndex(u => u.id.toString() === userId.toString());
        if (userIndex !== -1) {
            adminState.users[userIndex].credits = result.newBalance;
        }
        
        // Update UI
        renderUsers(adminState.users);
        
        // Show success message
        showModalAlert(`Credits updated successfully. New balance: ${result.newBalance}`, 'success');
        
        // Close modal after 2 seconds
        setTimeout(() => {
            document.getElementById('editCreditsModal').style.display = 'none';
        }, 2000);
    } catch (error) {
        console.error('Error updating credits:', error);
        showModalAlert(error.message, 'danger');
    } finally {
        const saveBtn = document.getElementById('saveCreditsBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
    }
}

// Show alert in modal
function showModalAlert(message, type) {
    const alert = document.getElementById('editCreditsAlert');
    alert.textContent = message;
    alert.className = `alert alert-${type}`;
    alert.style.display = 'block';
}

// Load invitation codes
async function loadInvitationCodes() {
    try {
        const response = await fetch('/api/admin/invitation-codes', {
            headers: await getAuthHeaders(),
            credentials: 'include' // Include cookies for auth
        });

        if (!response.ok) {
            throw new Error('Failed to load invitation codes');
        }

        const data = await response.json();
        adminState.invitationCodes = data.codes;
        renderInvitationCodes(adminState.invitationCodes);
    } catch (error) {
        console.error('Error loading invitation codes:', error);
        document.getElementById('codesTableBody').innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-red-500">
                    Failed to load invitation codes. ${error.message}
                </td>
            </tr>
        `;
    }
}

// Render invitation codes table
function renderInvitationCodes(codes) {
    const tableBody = document.getElementById('codesTableBody');
    
    if (!codes || codes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">No invitation codes found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = codes.map(code => `
        <tr>
            <td>${code.id}</td>
            <td><span class="invitation-code">${code.code}</span></td>
            <td>
                <span class="status-badge ${code.is_used ? 'status-used' : 'status-available'}">
                    ${code.is_used ? 'Used' : 'Available'}
                </span>
            </td>
            <td>${code.used_by_username || '-'}</td>
            <td>${formatDate(code.created_at)}</td>
        </tr>
    `).join('');
}

// Generate invitation codes
async function generateInvitationCodes() {
    try {
        const count = parseInt(document.getElementById('codeCount').value);
        
        if (isNaN(count) || count < 1 || count > 50) {
            showError('Please enter a valid count between 1 and 50');
            return;
        }

        const generateBtn = document.getElementById('generateCodesBtn');
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<span class="loading"></span> Generating...';

        const response = await fetch('/api/admin/generate-invitation-codes', {
            method: 'POST',
            headers: await getAuthHeaders(),
            credentials: 'include', // Include cookies for auth
            body: JSON.stringify({ count })
        });

        if (!response.ok) {
            throw new Error('Failed to generate invitation codes');
        }

        // Reload invitation codes
        await loadInvitationCodes();
    } catch (error) {
        console.error('Error generating invitation codes:', error);
        showError(error.message);
    } finally {
        const generateBtn = document.getElementById('generateCodesBtn');
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate New Codes';
    }
}

// Load payments
async function loadPayments() {
    try {
        const response = await fetch('/api/admin/payments', {
            headers: await getAuthHeaders(),
            credentials: 'include' // Include cookies for auth
        });

        if (!response.ok) {
            throw new Error('Failed to load payments');
        }

        const data = await response.json();
        adminState.payments = data.payments;
        renderPayments(adminState.payments);
    } catch (error) {
        console.error('Error loading payments:', error);
        document.getElementById('paymentsTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-red-500">
                    Failed to load payments. ${error.message}
                </td>
            </tr>
        `;
    }
}

// Render payments table
function renderPayments(payments) {
    const tableBody = document.getElementById('paymentsTableBody');
    
    if (!payments || payments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No payments found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = payments.map(payment => `
        <tr>
            <td>${payment.order_id}</td>
            <td>${payment.username}</td>
            <td>¥${payment.amount.toFixed(2)}</td>
            <td>${payment.credits}</td>
            <td>
                <span class="status-badge ${getStatusClass(payment.status)}">
                    ${payment.status}
                </span>
            </td>
            <td>${payment.payment_method}</td>
            <td>${formatDate(payment.created_at)}</td>
        </tr>
    `).join('');
}

// Get status class for payment status
function getStatusClass(status) {
    switch (status) {
        case 'completed':
            return 'status-available';
        case 'failed':
            return 'status-used';
        default:
            return '';
    }
}

// Search payments
function searchPayments() {
    const searchTerm = document.getElementById('paymentSearchInput').value.toLowerCase();
    
    if (!searchTerm) {
        renderPayments(adminState.payments);
        return;
    }

    const filteredPayments = adminState.payments.filter(payment => 
        payment.order_id.toLowerCase().includes(searchTerm) ||
        payment.username.toLowerCase().includes(searchTerm)
    );

    renderPayments(filteredPayments);
}

// Load system settings
async function loadSystemSettings() {
    try {
        const response = await fetch('/api/admin/system/settings', {
            headers: await getAuthHeaders(),
            credentials: 'include' // Include cookies for auth
        });

        if (!response.ok) {
            throw new Error('Failed to load system settings');
        }

        const data = await response.json();
        adminState.systemSettings = data.settings;
        
        // Update UI
        document.getElementById('baseCreditsInput').value = adminState.systemSettings.baseCredits;
        document.getElementById('depthMultiplierInput').value = adminState.systemSettings.depthMultiplier;
        document.getElementById('breadthMultiplierInput').value = adminState.systemSettings.breadthMultiplier;
    } catch (error) {
        console.error('Error loading system settings:', error);
        showError('Failed to load system settings');
    }
}

// Save system settings
async function saveSystemSettings() {
    try {
        const baseCredits = parseFloat(document.getElementById('baseCreditsInput').value);
        const depthMultiplier = parseFloat(document.getElementById('depthMultiplierInput').value);
        const breadthMultiplier = parseFloat(document.getElementById('breadthMultiplierInput').value);

        if (isNaN(baseCredits) || isNaN(depthMultiplier) || isNaN(breadthMultiplier)) {
            showError('Please enter valid numbers for all fields');
            return;
        }

        const saveBtn = document.getElementById('saveSystemSettingsBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading"></span> Saving...';

        const response = await fetch('/api/admin/system/settings', {
            method: 'POST',
            headers: await getAuthHeaders(),
            credentials: 'include', // Include cookies for auth
            body: JSON.stringify({
                baseCredits,
                depthMultiplier,
                breadthMultiplier
            })
        });

        if (!response.ok) {
            throw new Error('Failed to save system settings');
        }

        const result = await response.json();
        adminState.systemSettings = result.settings;
        
        showSuccess('System settings saved successfully');
    } catch (error) {
        console.error('Error saving system settings:', error);
        showError(error.message);
    } finally {
        const saveBtn = document.getElementById('saveSystemSettingsBtn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
    }
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Show error message
function showError(message) {
    // You can implement a toast or notification system here
    alert(message);
}

// Show success message
function showSuccess(message) {
    // You can implement a toast or notification system here
    alert(message);
}

// Document ready
document.addEventListener('DOMContentLoaded', initAdminPanel);
