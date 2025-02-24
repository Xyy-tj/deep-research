export class Auth {
    static #instance;
    #isAuthenticated = false;
    #currentUser = null;
    #userCredits = 0;
    #authStateListeners = [];

    constructor() {
        if (Auth.#instance) {
            return Auth.#instance;
        }
        Auth.#instance = this;
    }

    static getInstance() {
        if (!Auth.#instance) {
            Auth.#instance = new Auth();
        }
        return Auth.#instance;
    }

    async login(username, password) {
        if (!this.validateForm('login')) {
            return false;
        }
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                this.#isAuthenticated = true;
                this.#currentUser = username;
                this.#userCredits = data.user.credits;
                localStorage.setItem('user', username);
                localStorage.setItem('token', data.token);
                localStorage.setItem('credits', data.user.credits);
                this.#notifyAuthStateChange({ username });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
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

    async sendVerificationCode(email) {
        try {
            const response = await fetch('/api/send-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
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

    async registerWithVerificationCode(username, email, password, verificationCode) {
        if (!this.validateForm('register')) {
            return false;
        }
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, email, password, verificationCode }),
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

        let isValid = true;

        // Reset validation state
        [username, password, email, verificationCode].forEach(field => {
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
        }

        return isValid;
    }

    logout() {
        this.#isAuthenticated = false;
        this.#currentUser = null;
        this.#userCredits = 0;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('credits');
        this.#notifyAuthStateChange(null);
    }

    checkAuth() {
        const user = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        const credits = localStorage.getItem('credits');
        if (user && token) {
            this.#isAuthenticated = true;
            this.#currentUser = user;
            this.#userCredits = Number(credits) || 0;
            this.#notifyAuthStateChange({ username: user });
            return true;
        }
        this.#notifyAuthStateChange(null);
        return false;
    }

    getCurrentUser() {
        return this.#currentUser;
    }

    getUserCredits() {
        return this.#userCredits;
    }

    getToken() {
        return localStorage.getItem('token');
    }

    get isAuthenticated() {
        return this.#isAuthenticated;
    }

    onAuthStateChanged(callback) {
        this.#authStateListeners.push(callback);
        // 立即触发一次当前状态
        if (this.#isAuthenticated) {
            callback({ username: this.#currentUser });
        } else {
            callback(null);
        }
    }

    #notifyAuthStateChange(user) {
        this.#authStateListeners.forEach(callback => callback(user));
    }
}
