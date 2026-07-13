/**
 * Sign In Page Logic
 * Handles user authentication and redirects to the main application
 */

import { isAuthenticated, persistApiToken } from './utils/auth.js';
import { AuthService } from './trade-server-api/rest/AuthService.js';
import { AccountService } from './trade-server-api/rest/AccountService.js';
import { client } from './schema/public-api/client.gen.js';
import type { AuthUser } from './types/AuthUser.js';
import { displayVersion, logLibraryVersion } from './utils/version.js';
import { deriveServerUrls } from './utils/serverUrl.js';
import { createLogger } from './utils/logger.js';

const logger = createLogger({ prefix: '[Signin]' });

interface SignInFormData {
    login: number;
    password: string;
    server: string;
}

interface StoredCredentials {
    login: number;
    server: string;
}

class SignInManager {
    private form: HTMLFormElement;
    private loginInput: HTMLInputElement;
    private passwordInput: HTMLInputElement;
    private serverInput: HTMLInputElement;
    private submitBtn: HTMLButtonElement;
    private btnText: HTMLElement;
    private btnSpinner: HTMLElement;
    private errorMessage: HTMLElement;

    constructor() {
        this.form = document.getElementById('signin-form') as HTMLFormElement;
        this.loginInput = document.getElementById('login') as HTMLInputElement;
        this.passwordInput = document.getElementById('password') as HTMLInputElement;
        this.serverInput = document.getElementById('server') as HTMLInputElement;
        this.submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
        this.btnText = document.getElementById('btn-text') as HTMLElement;
        this.btnSpinner = document.getElementById('btn-spinner') as HTMLElement;
        this.errorMessage = document.getElementById('error-message') as HTMLElement;

        this.init();
    }

    private init(): void {
        // Load saved credentials if available
        this.loadSavedCredentials();

        // Add form submit handler
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));

        // Clear errors on input
        [this.loginInput, this.passwordInput, this.serverInput].forEach((input) => {
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    private loadSavedCredentials(): void {
        try {
            const savedCredsStr = localStorage.getItem('savedCredentials');
            if (savedCredsStr) {
                const savedCreds: StoredCredentials = JSON.parse(savedCredsStr);
                this.loginInput.value = savedCreds.login.toString();
                this.serverInput.value = savedCreds.server;
            }
        } catch (error) {
            logger.error('Failed to load saved credentials:', error);
        }
    }

    private saveCredentials(login: number, server: string): void {
        try {
            const creds: StoredCredentials = { login, server };
            localStorage.setItem('savedCredentials', JSON.stringify(creds));
        } catch (error) {
            logger.error('Failed to save credentials:', error);
        }
    }

    private async handleSubmit(e: Event): Promise<void> {
        e.preventDefault();

        // Clear previous errors
        this.hideError();
        this.clearAllFieldErrors();

        // Validate form
        const validation = this.validateForm();
        if (!validation.isValid) {
            this.showError(validation.error || 'Please check your inputs');
            return;
        }

        // Get form data
        const formData = this.getFormData();

        // Show loading state
        this.setLoading(true);

        try {
            // Normalize server URL
            const normalizedServer = this.normalizeServerUrl(formData.server);

            // Test connection to server
            await this.testServerConnection(normalizedServer, formData.login, formData.password);

            // Save credentials to sessionStorage for the main app
            this.saveSessionCredentials(formData.login, normalizedServer);

            // Save login and server to localStorage for next time
            this.saveCredentials(formData.login, normalizedServer);

            // Redirect to main application
            logger.info('Authentication successful, redirecting to main app');
            // Use replace to avoid back button issues
            window.location.replace('/');
        } catch (error) {
            logger.error('Sign in failed:', error);
            const errorMsg = error instanceof Error ? error.message : 'Sign in failed. Please try again.';
            this.showError(errorMsg);
        } finally {
            this.setLoading(false);
        }
    }

    private validateForm(): { isValid: boolean; error?: string } {
        // Validate login
        const login = parseInt(this.loginInput.value);
        if (!login || login <= 0) {
            this.showFieldError(this.loginInput, 'Login is required and must be a positive number');
            return { isValid: false, error: 'Login is incorrect' };
        }

        // Validate password
        if (!this.passwordInput.value || this.passwordInput.value.length === 0) {
            this.showFieldError(this.passwordInput, 'Password is required');
            return { isValid: false, error: 'Password is required' };
        }

        // Validate server URL
        if (!this.serverInput.value) {
            this.showFieldError(this.serverInput, 'Server URL is required');
            return { isValid: false, error: 'Server is required' };
        }

        try {
            const url = new URL(this.serverInput.value);
            if (!['https:', 'http:'].includes(url.protocol)) {
                this.showFieldError(this.serverInput, 'Invalid protocol. Use http:// or https://');
                return { isValid: false, error: 'Invalid URL or insecure protocol' };
            }
        } catch {
            this.showFieldError(this.serverInput, 'Invalid URL format');
            return { isValid: false, error: 'Invalid URL format' };
        }

        return { isValid: true };
    }

    private getFormData(): SignInFormData {
        return {
            login: parseInt(this.loginInput.value),
            password: this.passwordInput.value,
            server: this.serverInput.value,
        };
    }

    private normalizeServerUrl(url: string): string {
        try {
            const parsedUrl = new URL(url);
            // Remove trailing slash
            return parsedUrl.href.replace(/\/$/, '');
        } catch {
            throw new Error('Invalid server URL');
        }
    }

    private async testServerConnection(server: string, login: number, password: string): Promise<void> {
        try {
            // Derive REST API URL from server
            const { baseUrl } = deriveServerUrls(server);

            // Configure SDK client with the test server URL
            client.setConfig({ baseURL: baseUrl });

            // Create AuthUser for authentication
            const authUser: AuthUser = {
                login,
                password,
                apiKey: '',
                signingToken: '',
            };

            // Create AuthService and AccountService instances
            const authService = new AuthService(authUser);
            const accountService = new AccountService(authUser);

            // Attempt to authenticate (throws on HTTP error thanks to throwOnError: true in AuthService)
            const response = await authService.signIn(login);

            // Sanity-check the response shape (shouldn't fail if the server is spec-compliant)
            if (!response || (!response.token && !response.signingToken)) {
                throw new Error('Invalid response from server. Authentication failed.');
            }

            // Verify the connection by fetching account info
            await accountService.getAccountInfo();

            // Persist apiKey, signingToken, and expiration via the single
            // helper — expiration is what TradeServerClient's scheduler uses
            // to time the background refresh.
            persistApiToken(response);
        } catch (error: unknown) {
            logger.error('Authentication error:', error);

            // Check for specific error types
            if (typeof error === 'object' && error !== null) {
                const err = error as { status?: number; message?: string };

                if (err.status === 401 || err.message?.toLowerCase().includes('unauthorized')) {
                    throw new Error('Invalid credentials. Please check your login and password.');
                }

                if (err.status === 403) {
                    throw new Error('Access forbidden. Please check your credentials.');
                }
            }

            if (
                error instanceof TypeError &&
                (error.message.includes('fetch') || error.message.includes('Failed to fetch'))
            ) {
                throw new Error('Cannot connect to server. Please check the server URL and your network connection.');
            }

            if (error instanceof Error) {
                // Re-throw with original message if it's informative
                if (error.message && error.message.length > 0 && !error.message.includes('undefined')) {
                    throw new Error(error.message);
                }
            }

            throw new Error('Authentication failed. Please check your credentials and try again.');
        }
    }

    private saveSessionCredentials(login: number, server: string): void {
        // Don't store user's password for security - only login and server
        // API key and signing token are stored separately in testServerConnection
        // After authentication, signingToken is used as the password for HMAC signing
        sessionStorage.setItem(
            'userCredentials',
            JSON.stringify({
                login,
                server,
            })
        );
    }

    private showFieldError(input: HTMLInputElement, message: string): void {
        input.classList.add('is-invalid');
        const errorId = `${input.id}-error`;
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    private clearFieldError(input: HTMLInputElement): void {
        input.classList.remove('is-invalid');
        const errorId = `${input.id}-error`;
        const errorElement = document.getElementById(errorId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('show');
        }
    }

    private clearAllFieldErrors(): void {
        [this.loginInput, this.passwordInput, this.serverInput].forEach((input) => {
            this.clearFieldError(input);
        });
    }

    private showError(message: string): void {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }

    private hideError(): void {
        this.errorMessage.style.display = 'none';
        this.errorMessage.textContent = '';
    }

    private setLoading(loading: boolean): void {
        this.submitBtn.disabled = loading;
        if (loading) {
            this.btnText.textContent = 'Signing in...';
            this.btnSpinner.style.display = 'inline-block';
        } else {
            this.btnText.textContent = 'Sign In';
            this.btnSpinner.style.display = 'none';
        }
    }
}

// Initialize sign in manager when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    logger.debug('====== DOMContentLoaded fired ======');
    logger.debug('Current URL:', window.location.href);
    logger.debug('Current pathname:', window.location.pathname);

    logLibraryVersion();
    await displayVersion('app-version');

    // Show a note when the user was signed out due to session expiry / revocation.
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_ended') {
        const errorEl = document.getElementById('error-message');
        if (errorEl) {
            errorEl.textContent = 'You were signed out because your session ended. Please sign in again.';
            errorEl.style.display = 'block';
        }
    }

    // If user is already authenticated, redirect to main app
    if (isAuthenticated()) {
        logger.info('User already authenticated, redirecting to main app...');
        // Use replace to avoid back button issues
        window.location.replace('/');
        return;
    }

    logger.info('User not authenticated, showing sign-in form');
    new SignInManager();
});
