// Import the updateBalance function or declare it if needed
let updateBalance;

// This will be called when main.js defines the updateBalance function
export function setUpdateBalanceFunction(fn) {
    updateBalance = fn;
}

export class Auth {
    static #instance;
    #isAuthenticated = false;
    #currentUser = null;
    #userCredits = 0;
    #userInfo = null; // 存储完整的用户信息
    #authStateListeners = [];

    constructor() {
        if (Auth.#instance) {
            return Auth.#instance;
        }
        Auth.#instance = this;
        
        // Initialize from localStorage (for backward compatibility)
        const user = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        const credits = localStorage.getItem('credits');
        
        if (user && token) {
            this.#isAuthenticated = true;
            this.#currentUser = user;
            this.#userCredits = Number(credits) || 0;
            
            // 尝试从localStorage获取用户信息
            try {
                const userInfoStr = localStorage.getItem('userInfo');
                if (userInfoStr) {
                    this.#userInfo = JSON.parse(userInfoStr);
                }
            } catch (e) {
                console.error('Error parsing userInfo from localStorage:', e);
            }
        }
        
        // Check for authentication when the class is instantiated (async)
        setTimeout(() => this.checkAuth(), 0);
    }

    static getInstance() {
        if (!Auth.#instance) {
            Auth.#instance = new Auth();
        }
        return Auth.#instance;
    }

    async login(username, password) {
        if (!this.validateForm('login')) {
            return { success: false, message: 'Please fill in all required fields correctly' };
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
                credentials: 'include' // 确保包含cookies
            });

            if (response.ok) {
                const data = await response.json();
                this.#isAuthenticated = true;
                this.#currentUser = username;
                this.#userCredits = data.user.credits;
                this.#userInfo = data.user; // 存储完整的用户信息
                
                // 保存到localStorage作为备份
                localStorage.setItem('user', username);
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                localStorage.setItem('credits', data.user.credits);
                localStorage.setItem('userInfo', JSON.stringify(data.user)); // 保存完整用户信息
                
                // 通知状态变化
                this.#notifyAuthStateChange(data.user);
                
                return { success: true };
            } else {
                // 处理不同的错误状态码
                let errorMessage = 'Login failed';
                
                if (response.status === 401) {
                    errorMessage = 'Invalid username or password';
                } else if (response.status === 429) {
                    errorMessage = 'Too many login attempts, please try again later';
                } else if (response.status >= 500) {
                    errorMessage = 'Server error, please try again later';
                }
                
                try {
                    // 尝试从响应中获取更详细的错误信息
                    const errorData = await response.json();
                    if (errorData && errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    // 如果无法解析JSON，使用默认错误消息
                }
                
                return { success: false, message: errorMessage };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error, please check your connection' };
        }
    }

    async register(username, password) {
        if (!this.validateForm('register')) {
            return false;
        }
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                return await this.login(username, password);
            }
            return false;
        } catch (error) {
            console.error('Registration error:', error);
            return false;
        }
    }

    async sendVerificationCode(email, invitationCode) {
        try {
            const response = await fetch('/api/send-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, invitationCode }),
            });

            if (response.ok) {
                return true;
            }
            return false;
        } catch (error) {
            console.error('Send verification error:', error);
            return false;
        }
    }

    async registerWithVerificationCode(username, email, password, verificationCode, invitationCode) {
        if (!this.validateForm('register')) {
            return false;
        }
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, verificationCode, invitationCode }),
            });

            if (response.ok) {
                return await this.login(username, password);
            }
            return false;
        } catch (error) {
            console.error('Registration error:', error);
            return false;
        }
    }

    validateForm(type) {
        const username = document.getElementById('username');
        const password = document.getElementById('password');
        const email = document.getElementById('email');
        const verificationCode = document.getElementById('verificationCode');
        const invitationCode = document.getElementById('invitationCode');

        let isValid = true;

        // Reset validation state
        [username, password, email, verificationCode, invitationCode].forEach(field => {
            if (field) {
                field.classList.remove('border-red-500');
            }
        });

        // Validate username
        if (!username.value || username.value.length < 3) {
            username.classList.add('border-red-500');
            isValid = false;
        }

        // Validate password
        if (!password.value || password.value.length < 6) {
            password.classList.add('border-red-500');
            isValid = false;
        }

        // Additional validation for registration
        if (type === 'register') {
            // Enable email and verification code fields
            email.required = true;
            verificationCode.required = true;
            invitationCode.required = true;

            // Validate email
            if (!email.value || !email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                email.classList.add('border-red-500');
                isValid = false;
            }

            // Validate verification code
            if (!verificationCode.value || verificationCode.value.length !== 6) {
                verificationCode.classList.add('border-red-500');
                isValid = false;
            }
            
            // Validate invitation code
            if (!invitationCode.value || invitationCode.value.length < 3) {
                invitationCode.classList.add('border-red-500');
                isValid = false;
            }
        }

        return isValid;
    }

    async checkAuth() {
        // 优先使用API进行身份验证
        try {
            const response = await fetch('/api/verify-token', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Include cookies for auth
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.authenticated && data.user) {
                    // User is authenticated via cookie
                    this.#isAuthenticated = true;
                    this.#currentUser = data.user.username;
                    this.#userCredits = data.user.credits || 0;
                    this.#userInfo = data.user; // 存储完整的用户信息
                    
                    // Update localStorage with the latest credit information
                    localStorage.setItem('user', data.user.username);
                    if (data.token) { // If token is returned in response
                        localStorage.setItem('token', data.token);
                    }
                    localStorage.setItem('credits', String(this.#userCredits));
                    localStorage.setItem('userInfo', JSON.stringify(data.user)); // 保存完整用户信息
                    
                    this.#notifyAuthStateChange(data.user);
                    
                    // Update the balance
                    if (updateBalance) {
                        updateBalance();
                    }
                    
                    return true;
                }
            }
            
            // 如果API验证失败，尝试使用localStorage（向后兼容）
            const user = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            const credits = localStorage.getItem('credits');
            
            if (user && token) {
                // 使用localStorage中的令牌再次尝试验证
                try {
                    const tokenResponse = await fetch('/api/verify-token', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        credentials: 'include'
                    });
                    
                    if (tokenResponse.ok) {
                        const tokenData = await tokenResponse.json();
                        if (tokenData.authenticated) {
                            // 令牌有效，使用API返回的用户数据
                            this.#isAuthenticated = true;
                            this.#currentUser = tokenData.user.username;
                            this.#userCredits = tokenData.user.credits || 0;
                            this.#userInfo = tokenData.user; // 存储完整的用户信息
                            
                            // 更新localStorage
                            localStorage.setItem('user', tokenData.user.username);
                            if (tokenData.token) {
                                localStorage.setItem('token', tokenData.token);
                            }
                            localStorage.setItem('credits', String(this.#userCredits));
                            localStorage.setItem('userInfo', JSON.stringify(tokenData.user)); // 保存完整用户信息
                            
                            this.#notifyAuthStateChange(tokenData.user);
                            
                            // 更新余额
                            if (updateBalance) {
                                updateBalance();
                            }
                            
                            return true;
                        }
                    }
                } catch (tokenError) {
                    console.error('Error verifying token from localStorage:', tokenError);
                }
            }
            
            // 如果所有验证方法都失败，清除认证状态
            this.#isAuthenticated = false;
            this.#currentUser = null;
            this.#userCredits = 0;
            this.#userInfo = null;
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('credits');
            localStorage.removeItem('userInfo');
            this.#notifyAuthStateChange(null);
            return false;
        } catch (error) {
            // Network or other errors
            console.error('Authentication check failed:', error);
            this.#isAuthenticated = false;
            this.#currentUser = null;
            this.#userCredits = 0;
            this.#userInfo = null;
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('credits');
            localStorage.removeItem('userInfo');
            this.#notifyAuthStateChange(null);
            return false;
        }
    }

    async getTokenAsync() {
        try {
            console.log('Getting token async...');
            // 尝试从API获取令牌
            const response = await fetch('/api/verify-token', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // Include cookies for auth
            });
            
            console.log('Token API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Token API response data:', data);
                
                if (data.authenticated && data.token) {
                    console.log('🔑 Retrieved token from API');
                    // 更新localStorage
                    localStorage.setItem('token', data.token);
                    return data.token;
                }
            }
        } catch (error) {
            console.error('Error fetching token from API:', error);
        }
        
        // 如果API获取失败，尝试从localStorage获取
        const token = localStorage.getItem('token');
        console.log('🔑 Retrieved token from localStorage:', !!token ? 'Token exists' : 'No token found');
        return token;
    }

    // 同步方法，用于向后兼容
    getToken() {
        const token = localStorage.getItem('token');
        console.log('🔑 Retrieved token from localStorage:', !!token ? 'Token exists' : 'No token found');
        return token;
    }

    logout() {
        // Call the logout API to clear the cookie
        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include' // Include cookies for auth
        }).catch(error => {
            console.error('Logout error:', error);
        }).finally(() => {
            // Clear local storage and update state regardless of API response
            this.#isAuthenticated = false;
            this.#currentUser = null;
            this.#userCredits = 0;
            this.#userInfo = null;
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('credits');
            localStorage.removeItem('userInfo');
            this.#notifyAuthStateChange(null);
            
            // Hide balance display when logging out
            const balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.classList.add('hidden');
            }
            
            // Update balance display to 0
            updateBalance();
        });
    }

    async getCurrentUser() {
        if (!this.#isAuthenticated) {
            await this.checkAuth();
        }
        
        // 返回完整的用户信息对象
        return this.#userInfo;
    }

    getUserCredits() {
        return this.#userCredits;
    }

    get isAuthenticated() {
        console.log('🔒 Auth state check:', this.#isAuthenticated);
        return this.#isAuthenticated;
    }

    onAuthStateChanged(callback) {
        this.#authStateListeners.push(callback);
        // 立即触发一次当前状态
        if (this.#isAuthenticated) {
            callback(this.#userInfo);
            
            // If we have a toggleMainContent function in the global scope, use it
            if (typeof window.toggleMainContent === 'function') {
                window.toggleMainContent(true);
            }
            
            // Show balance display for authenticated users
            const balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.classList.remove('hidden');
                
                // Update balance if the function is available
                if (typeof window.updateBalance === 'function') {
                    window.updateBalance();
                }
            }
        } else {
            callback(null);
            
            // If we have a toggleMainContent function in the global scope, use it
            if (typeof window.toggleMainContent === 'function') {
                window.toggleMainContent(false);
            }
            
            // Hide balance display for non-authenticated users
            const balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.classList.add('hidden');
            }
        }
    }

    #notifyAuthStateChange(user) {
        this.#authStateListeners.forEach(callback => {
            callback(user);
        });
    }
}
