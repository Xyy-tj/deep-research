/**
 * Admin Panel Functionality for Deep Research
 */
import { Auth } from './auth.js';

// Admin state
const adminState = {
    users: [],
    invitationCodes: [],
    payments: [],
    creditPackages: [],
    systemSettings: {
        baseCredits: 2,
        depthMultiplier: 1,
        breadthMultiplier: 0.5,
        creditExchangeRate: 10
    },
    researchRecords: [] // 添加研究记录状态
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
        await loadCreditPackages();

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
            
            // 加载研究记录数据
            if (tabName === 'research-records') {
                loadResearchRecords();
            }
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
        const editCreditsModal = document.getElementById('editCreditsModal');
        const packageModal = document.getElementById('packageModal');
        const researchModal = document.getElementById('research-content-modal');
        
        if (event.target === editCreditsModal) {
            editCreditsModal.style.display = 'none';
        }
        
        if (event.target === packageModal) {
            packageModal.style.display = 'none';
        }
        
        if (event.target === researchModal) {
            researchModal.style.display = 'none';
        }
    });

    // Credit package management
    document.getElementById('addPackageBtn').addEventListener('click', () => openPackageModal());
    document.getElementById('closePackageModal').addEventListener('click', () => {
        document.getElementById('packageModal').style.display = 'none';
    });
    document.getElementById('savePackageBtn').addEventListener('click', savePackage);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await Auth.getInstance().logout();
        window.location.href = 'index.html';
    });

    // 研究记录相关事件监听
    document.getElementById('searchResearchBtn').addEventListener('click', searchResearchRecords);
    document.getElementById('researchSearchInput').addEventListener('keyup', event => {
        if (event.key === 'Enter') {
            searchResearchRecords();
        }
    });
    
    // 研究内容模态框关闭按钮
    document.getElementById('closeResearchModal').addEventListener('click', () => {
        document.getElementById('research-content-modal').style.display = 'none';
    });
    document.getElementById('closeResearchBtn').addEventListener('click', () => {
        document.getElementById('research-content-modal').style.display = 'none';
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
        document.getElementById('creditExchangeRateInput').value = adminState.systemSettings.creditExchangeRate || 10;
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
        const creditExchangeRate = parseFloat(document.getElementById('creditExchangeRateInput').value);

        if (isNaN(baseCredits) || isNaN(depthMultiplier) || isNaN(breadthMultiplier) || isNaN(creditExchangeRate)) {
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
                breadthMultiplier,
                creditExchangeRate
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

// Load credit packages
async function loadCreditPackages() {
    try {
        const response = await fetch('/api/admin/credit-packages', {
            headers: await getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load credit packages');
        }

        const data = await response.json();
        adminState.creditPackages = data.packages;
        renderCreditPackages(adminState.creditPackages);
    } catch (error) {
        console.error('Error loading credit packages:', error);
        document.getElementById('packagesTableBody').innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-red-500">
                    Failed to load credit packages. ${error.message}
                </td>
            </tr>
        `;
    }
}

// Render credit packages table
function renderCreditPackages(packages) {
    const tableBody = document.getElementById('packagesTableBody');
    
    if (!packages || packages.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">No credit packages found</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = packages.map(pkg => `
        <tr>
            <td>${pkg.id}</td>
            <td>${pkg.credits}</td>
            <td>${pkg.price.toFixed(2)}</td>
            <td>${pkg.description || ''}</td>
            <td>${pkg.is_active ? '<span class="status-badge status-available">Active</span>' : '<span class="status-badge status-used">Inactive</span>'}</td>
            <td>${pkg.display_order}</td>
            <td>
                <button class="btn btn-small" onclick="window.editPackage(${pkg.id})">Edit</button>
                <button class="btn btn-small" onclick="window.deletePackage(${pkg.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Open package modal for adding or editing
function openPackageModal(packageId = null) {
    const modal = document.getElementById('packageModal');
    const modalTitle = document.getElementById('packageModalTitle');
    const packageIdInput = document.getElementById('packageId');
    const creditsInput = document.getElementById('packageCredits');
    const priceInput = document.getElementById('packagePrice');
    const descriptionInput = document.getElementById('packageDescription');
    const activeInput = document.getElementById('packageActive');
    const orderInput = document.getElementById('packageOrder');
    
    // Reset form
    document.getElementById('packageAlert').style.display = 'none';
    
    if (packageId) {
        // Edit mode
        const pkg = adminState.creditPackages.find(p => p.id === packageId);
        if (!pkg) {
            showError('Package not found');
            return;
        }
        
        modalTitle.textContent = 'Edit Credit Package';
        packageIdInput.value = pkg.id;
        creditsInput.value = pkg.credits;
        priceInput.value = pkg.price;
        descriptionInput.value = pkg.description || '';
        activeInput.value = pkg.is_active ? '1' : '0';
        orderInput.value = pkg.display_order;
    } else {
        // Add mode
        modalTitle.textContent = 'Add Credit Package';
        packageIdInput.value = '';
        creditsInput.value = '';
        priceInput.value = '';
        descriptionInput.value = '';
        activeInput.value = '1';
        orderInput.value = '0';
    }
    
    modal.style.display = 'block';
}

// Save package
async function savePackage() {
    try {
        const packageId = document.getElementById('packageId').value;
        const credits = parseInt(document.getElementById('packageCredits').value);
        const price = parseFloat(document.getElementById('packagePrice').value);
        const description = document.getElementById('packageDescription').value;
        const isActive = document.getElementById('packageActive').value === '1';
        const displayOrder = parseInt(document.getElementById('packageOrder').value);
        
        // Validate inputs
        if (isNaN(credits) || credits <= 0) {
            showPackageAlert('Credits must be a positive number', 'alert-danger');
            return;
        }
        
        if (isNaN(price) || price <= 0) {
            showPackageAlert('Price must be a positive number', 'alert-danger');
            return;
        }
        
        const packageData = {
            credits,
            price,
            description,
            isActive,
            displayOrder: isNaN(displayOrder) ? 0 : displayOrder
        };
        
        let url = '/api/admin/credit-packages';
        let method = 'POST';
        
        if (packageId) {
            // Update existing package
            url = `/api/admin/credit-packages/${packageId}`;
            method = 'PUT';
        }
        
        const response = await fetch(url, {
            method,
            headers: await getAuthHeaders(),
            credentials: 'include',
            body: JSON.stringify(packageData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save package');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Reload packages
            await loadCreditPackages();
            
            // Close modal
            document.getElementById('packageModal').style.display = 'none';
            
            // Show success message
            showSuccess(packageId ? 'Package updated successfully' : 'Package created successfully');
        } else {
            throw new Error(data.error || 'Failed to save package');
        }
    } catch (error) {
        console.error('Error saving package:', error);
        showPackageAlert(error.message, 'alert-danger');
    }
}

// Delete package
async function deletePackage(packageId) {
    if (!confirm('Are you sure you want to delete this package?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/credit-packages/${packageId}`, {
            method: 'DELETE',
            headers: await getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete package');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Reload packages
            await loadCreditPackages();
            
            // Show success message
            showSuccess('Package deleted successfully');
        } else {
            throw new Error(data.error || 'Failed to delete package');
        }
    } catch (error) {
        console.error('Error deleting package:', error);
        showError(error.message);
    }
}

// Show alert in package modal
function showPackageAlert(message, type) {
    const alert = document.getElementById('packageAlert');
    alert.textContent = message;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
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

// 加载研究记录
async function loadResearchRecords() {
    try {
        document.getElementById('research-records-tbody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="loading"></div> 加载研究记录中...
                </td>
            </tr>
        `;
        
        const response = await fetch('/api/admin/research-records', {
            headers: await getAuthHeaders(),
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Failed to load research records');
        }

        const data = await response.json();
        
        if (data.success) {
            adminState.researchRecords = data.records;
            renderResearchRecords(data.records);
        } else {
            throw new Error(data.error || 'Failed to load research records');
        }
    } catch (error) {
        console.error('Error loading research records:', error);
        document.getElementById('research-records-tbody').innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-red-500">
                    加载研究记录失败: ${error.message}
                </td>
            </tr>
        `;
    }
}

// 渲染研究记录表格
function renderResearchRecords(records) {
    const tableBody = document.getElementById('research-records-tbody');
    
    if (!records || records.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">没有找到研究记录</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    records.forEach(record => {
        const createdAt = formatDate(record.created_at);
        html += `
            <tr>
                <td>${record.id}</td>
                <td>${escapeHtml(record.title || '无标题')}</td>
                <td>${escapeHtml(record.username || '未知用户')}</td>
                <td>${escapeHtml(record.query || '无查询')}</td>
                <td>${createdAt}</td>
                <td>
                    <button class="btn btn-small btn-info" onclick="viewResearchContent(${record.id})">
                        查看
                    </button>
                    <button class="btn btn-small btn-primary" onclick="downloadResearchContent(${record.id}, '${escapeHtml(record.title || 'research')}')">
                        下载
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// 搜索研究记录
function searchResearchRecords() {
    const searchTerm = document.getElementById('researchSearchInput').value.toLowerCase();
    
    if (!searchTerm) {
        renderResearchRecords(adminState.researchRecords);
        return;
    }
    
    const filteredRecords = adminState.researchRecords.filter(record => {
        return (
            (record.title && record.title.toLowerCase().includes(searchTerm)) ||
            (record.query && record.query.toLowerCase().includes(searchTerm)) ||
            (record.username && record.username.toLowerCase().includes(searchTerm))
        );
    });
    
    renderResearchRecords(filteredRecords);
}

// 查看研究内容
async function viewResearchContent(recordId) {
    try {
        document.getElementById('research-content-container').innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div class="loading"></div>
                <p>加载研究内容中...</p>
            </div>
        `;
        document.getElementById('research-content-modal').style.display = 'block';
        
        const response = await fetch(`/api/admin/research-records/${recordId}/content`, {
            headers: await getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load research content');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // 设置标题
            document.getElementById('research-content-title').textContent = data.title || '研究内容';
            
            // 使用marked.js渲染Markdown内容
            const renderedContent = marked.parse(data.content || '');
            document.getElementById('research-content-container').innerHTML = renderedContent;
            
            // 设置下载按钮
            const blob = new Blob([data.content || ''], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const downloadBtn = document.getElementById('download-research-btn');
            downloadBtn.href = url;
            downloadBtn.download = `${data.title || 'research'}.md`;
        } else {
            throw new Error(data.error || 'Failed to load research content');
        }
    } catch (error) {
        console.error('Error viewing research content:', error);
        document.getElementById('research-content-container').innerHTML = `
            <div class="alert alert-danger">
                加载研究内容失败: ${error.message}
            </div>
        `;
    }
}

// 下载研究内容
async function downloadResearchContent(recordId, title) {
    try {
        const response = await fetch(`/api/admin/research-records/${recordId}/content`, {
            headers: await getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to download research content');
        }
        
        const data = await response.json();
        
        if (data.success) {
            // 创建下载链接
            const blob = new Blob([data.content || ''], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title || 'research'}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            throw new Error(data.error || 'Failed to download research content');
        }
    } catch (error) {
        console.error('Error downloading research content:', error);
        showError(`下载研究内容失败: ${error.message}`);
    }
}

// HTML转义函数
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Document ready
document.addEventListener('DOMContentLoaded', initAdminPanel);

// Expose functions to window for onclick handlers
window.openEditCreditsModal = openEditCreditsModal;
window.openPackageModal = openPackageModal;
window.editPackage = openPackageModal; // 添加别名，使editPackage指向openPackageModal
window.deletePackage = deletePackage;
window.viewResearchContent = viewResearchContent;
window.downloadResearchContent = downloadResearchContent;
