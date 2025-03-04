/**
 * 邀请码管理面板JavaScript
 * 包含管理面板的所有交互功能
 */

// 全局变量
let authToken = localStorage.getItem('admin_token'); 
let allCodes = [];

// 文档加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    const adminPanel = document.getElementById('adminPanel');
    const loginPrompt = document.getElementById('loginPrompt');
    
    // 检查是否已登录
    if (authToken) {
        adminPanel.classList.remove('hidden');
        loginPrompt.classList.add('hidden');
        
        // 确保生成按钮显示正确状态
        const generateBtnText = document.getElementById('generateBtnText');
        const generateBtnLoading = document.getElementById('generateBtnLoading');
        if (generateBtnText && generateBtnLoading) {
            generateBtnText.classList.remove('hidden');
            generateBtnLoading.classList.add('hidden');
        }
        
        loadCodes();
    } else {
        adminPanel.classList.add('hidden');
        loginPrompt.classList.remove('hidden');
    }
    
    // 登录表单提交
    document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('adminUsername').value;
        const password = document.getElementById('adminPassword').value;
        
        if (!username || !password) {
            showNotification('请输入用户名和密码', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.user.isAdmin) {
                    authToken = data.token;
                    localStorage.setItem('admin_token', authToken);
                    adminPanel.classList.remove('hidden');
                    loginPrompt.classList.add('hidden');
                    
                    // 确保生成按钮显示正确状态
                    const generateBtnText = document.getElementById('generateBtnText');
                    const generateBtnLoading = document.getElementById('generateBtnLoading');
                    if (generateBtnText && generateBtnLoading) {
                        generateBtnText.classList.remove('hidden');
                        generateBtnLoading.classList.add('hidden');
                    }
                    
                    loadCodes();
                    showNotification('登录成功');
                } else {
                    showNotification('需要管理员权限', 'error');
                }
            } else {
                showNotification('用户名或密码错误', 'error');
            }
        } catch (error) {
            showNotification('登录失败: ' + error.message, 'error');
        }
    });
    
    // 生成邀请码
    const generateCodesForm = document.getElementById('generateCodesForm');
    if (generateCodesForm) {
        generateCodesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const count = parseInt(document.getElementById('codeCount').value);
            
            if (isNaN(count) || count < 1 || count > 50) {
                showNotification('请输入1-50之间的数字', 'error');
                return;
            }
            
            const generateBtn = document.getElementById('generateBtn');
            const generateBtnText = document.getElementById('generateBtnText');
            const generateBtnLoading = document.getElementById('generateBtnLoading');
            
            // 显示加载状态
            generateBtn.disabled = true;
            if (generateBtnText && generateBtnLoading) {
                generateBtnText.classList.add('hidden');
                generateBtnLoading.classList.remove('hidden');
            } else {
                generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> 生成中...';
            }
            
            try {
                const response = await fetch('/api/admin/generate-invitation-codes', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify({ count })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    showNotification(`成功生成 ${data.codes.length} 个邀请码`);
                    loadCodes();
                } else {
                    const error = await response.json();
                    showNotification('生成失败: ' + error.error, 'error');
                }
            } catch (error) {
                showNotification('生成失败: ' + error.message, 'error');
            } finally {
                // 恢复按钮状态
                generateBtn.disabled = false;
                if (generateBtnText && generateBtnLoading) {
                    generateBtnText.classList.remove('hidden');
                    generateBtnLoading.classList.add('hidden');
                } else {
                    generateBtn.innerHTML = '<i class="fas fa-plus-circle mr-2"></i> 生成邀请码';
                }
            }
        });
    }
    
    // 搜索框事件
    const codeSearch = document.getElementById('codeSearch');
    if (codeSearch) {
        codeSearch.addEventListener('input', filterCodes);
    }
    
    // 过滤按钮事件
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('active', 'bg-blue-100', 'text-blue-800');
                b.classList.add('bg-gray-100', 'text-gray-800');
            });
            e.target.classList.remove('bg-gray-100', 'text-gray-800');
            e.target.classList.add('active', 'bg-blue-100', 'text-blue-800');
            filterCodes();
        });
    });
    
    // 刷新按钮事件
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('animate-spin');
            setTimeout(() => {
                refreshBtn.classList.remove('animate-spin');
            }, 1000);
            loadCodes();
        });
    }
    
    // 退出登录按钮事件
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('admin_token');
            authToken = null;
            adminPanel.classList.add('hidden');
            loginPrompt.classList.remove('hidden');
            showNotification('已退出登录');
        });
    }
    
    // 添加复制到剪贴板的全局函数
    window.copyToClipboard = async (text, button) => {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check text-green-500"></i>';
            setTimeout(() => {
                button.innerHTML = originalHTML;
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
    };
});

/**
 * 加载所有邀请码
 */
async function loadCodes() {
    const codesContainer = document.getElementById('codesList');
    if (!codesContainer) return;
    
    codesContainer.innerHTML = '<div class="flex justify-center py-8"><div class="loading"></div></div>';
    
    try {
        const response = await fetch('/api/admin/invitation-codes', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            allCodes = data.codes || [];
            
            updateStats(allCodes);
            
            displayCodes(allCodes);
        } else {
            const error = await response.json();
            codesContainer.innerHTML = `<p class="text-red-500">错误: ${error.error}</p>`;
        }
    } catch (error) {
        codesContainer.innerHTML = '<p class="text-red-500">加载邀请码失败</p>';
        console.error('加载邀请码错误:', error);
    }
}

/**
 * 更新统计数据
 */
function updateStats(codes) {
    const availableCodesCount = document.getElementById('availableCodesCount');
    const usedCodesCount = document.getElementById('usedCodesCount');
    
    if (availableCodesCount && usedCodesCount) {
        const available = codes.filter(code => code.is_used === 0).length;
        const used = codes.filter(code => code.is_used === 1).length;
        
        availableCodesCount.textContent = available;
        usedCodesCount.textContent = used;
    }
}

/**
 * 根据搜索和过滤条件筛选邀请码
 */
function filterCodes() {
    const searchText = document.getElementById('codeSearch')?.value.toLowerCase() || '';
    const filterType = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    
    let filtered = [...allCodes];
    
    if (filterType === 'available') {
        filtered = filtered.filter(code => code.is_used === 0);
    } else if (filterType === 'used') {
        filtered = filtered.filter(code => code.is_used === 1);
    }
    
    if (searchText) {
        filtered = filtered.filter(code => 
            code.code.toLowerCase().includes(searchText) || 
            (code.used_by_username && code.used_by_username.toLowerCase().includes(searchText))
        );
    }
    
    displayCodes(filtered);
}

/**
 * 显示邀请码列表
 */
function displayCodes(codes) {
    const codesContainer = document.getElementById('codesList');
    if (!codesContainer) return;
    
    if (!codes || codes.length === 0) {
        codesContainer.innerHTML = '<p class="text-gray-500 text-center py-4">没有找到邀请码</p>';
        return;
    }

    codesContainer.innerHTML = '';
    
    codes.forEach(code => {
        const isUsed = code.is_used === 1;
        const codeElement = document.createElement('div');
        codeElement.className = `code-item ${isUsed ? 'code-used' : ''} fade-in`;
        
        codeElement.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <div class="flex items-center">
                        <span class="text-lg font-mono font-bold">${code.code}</span>
                        <button onclick="copyToClipboard('${code.code}', this)" class="ml-2 text-gray-500 hover:text-gray-700" title="复制邀请码">
                            <i class="fas fa-copy"></i>
                        </button>
                    </div>
                    <div class="text-sm text-gray-500">创建时间: ${new Date(code.created_at).toLocaleString()}</div>
                    ${isUsed ? `
                        <div class="text-sm text-gray-500">使用者: ${code.used_by_username || '未知'}</div>
                        <div class="text-sm text-gray-500">使用时间: ${new Date(code.used_at).toLocaleString()}</div>
                    ` : ''}
                </div>
                <div class="px-2 py-1 rounded text-sm ${isUsed ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'}">
                    ${isUsed ? '已使用' : '可用'}
                </div>
            </div>
        `;
        
        codesContainer.appendChild(codeElement);
    });
}

/**
 * 显示通知
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type === 'success' ? 'notification-success' : 'notification-error'} fade-in`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}
