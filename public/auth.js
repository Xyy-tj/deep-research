export class Auth {
    static #instance;
    #isAuthenticated = false;
    #currentUser = null;
    #userCredits = 0;

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
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    async register(username, password) {
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

    logout() {
        this.#isAuthenticated = false;
        this.#currentUser = null;
        this.#userCredits = 0;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('credits');
    }

    checkAuth() {
        const user = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        const credits = localStorage.getItem('credits');
        if (user && token) {
            this.#isAuthenticated = true;
            this.#currentUser = user;
            this.#userCredits = Number(credits) || 0;
            return true;
        }
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
}
