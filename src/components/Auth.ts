export class Auth {
    private static instance: Auth;
    private isAuthenticated: boolean = false;
    private currentUser: string | null = null;

    private constructor() {}

    public static getInstance(): Auth {
        if (!Auth.instance) {
            Auth.instance = new Auth();
        }
        return Auth.instance;
    }

    public async login(username: string, password: string): Promise<boolean> {
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
                this.isAuthenticated = true;
                this.currentUser = username;
                localStorage.setItem('user', username);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    public async register(username: string, password: string): Promise<boolean> {
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

    public logout(): void {
        this.isAuthenticated = false;
        this.currentUser = null;
        localStorage.removeItem('user');
    }

    public checkAuth(): boolean {
        const user = localStorage.getItem('user');
        if (user) {
            this.isAuthenticated = true;
            this.currentUser = user;
        }
        return this.isAuthenticated;
    }

    public getCurrentUser(): string | null {
        return this.currentUser;
    }
}
