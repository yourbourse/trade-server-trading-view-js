<div align="center">

# Sign-in Flow

**Authentication, session management, and credential storage**

[Flow](#sign-in-flow) · [Session Storage](#session-storage) · [Security](#security-considerations)

</div>

---

## Features

| Feature | Description |
|---------|-------------|
| **Secure Authentication** | Credentials validated against Trade Server REST API |
| **Session Management** | Tokens stored in browser sessionStorage (cleared on tab close) |
| **Remember Me** | Login number and server URL saved in localStorage |
| **Auto-redirect** | Unauthenticated users redirected to `/signin.html` |
| **Form Validation** | Client-side validation with clear error messages |
| **Responsive Design** | Works on desktop and mobile devices |

## Sign-In Flow

1. User visits the application (`/`)
2. App checks if user is authenticated (checks session storage)
3. If not authenticated, redirect to `/signin.html`
4. User enters credentials:
   - **Login**: Trading account number (positive integer)
   - **Password**: Account password
   - **Server**: Trade Server URL (defaults to test server)
5. Form validation occurs before submission
6. App tests connection to server with provided credentials
7. On success:
   - Credentials are saved to session storage
   - Login and server URL are saved to local storage
   - User is redirected to main application
8. On failure:
   - Error message is displayed
   - User can try again

## Files Created

### HTML
- `signin.html` - Sign-in page with form

### CSS
- `css/signin.css` - Styling for sign-in page

### TypeScript
- `src/signin.ts` - Sign-in page logic and form handling
- `src/utils/auth.ts` - Authentication utility functions

### Modified Files
- `src/config.ts` - Updated to load credentials from session storage
- `src/app.ts` - Added authentication check before initializing

## Usage

### Starting the Application

1. Run the development server:
   ```bash
   npm run dev
   ```

2. Open browser to `http://localhost:5173` (or your configured port)

3. You will be redirected to the sign-in page

4. Enter your credentials:
   - **Login**: Your trading account number (e.g., 1002)
   - **Password**: Your account password
   - **Server**: Leave default or enter custom server URL

5. Click "Sign In"

6. You will be redirected to the main trading terminal

### Signing Out

To sign out, you can:

1. **From Browser Console**:
   ```javascript
   logout()
   // or
   window.logout()
   ```

2. **Clear Session Storage**:
   - Open browser DevTools → Application → Session Storage
   - Clear `userCredentials` and `apiKey`
   - Refresh the page

3. **Close the Browser** 
   - Session storage is automatically cleared when browser/tab closes

### Remembering Credentials

The sign-in page automatically saves your **login number** and **server URL** to local storage. When you return:
- Login field is pre-filled
- Server field is pre-filled
- You only need to enter your password

To clear saved credentials:
- Open browser DevTools → Application → Local Storage
- Remove `savedCredentials` item

## API Integration

### Session Storage Structure

After successful sign-in, the following is stored in session storage:

**userCredentials**:
```json
{
  "login": 1002,
  "server": "https://uat.api.yourbourse.trade:32228"
}
```

> **Note:** REST API URL (`baseUrl`) and WebSocket URL (`wsUrl`) are derived from `server` using `deriveServerUrls()` utility.



### Local Storage Structure

**savedCredentials**:
```json
{
  "login": 1002,
  "server": "https://uat.api.yourbourse.trade:32228"
}
```

## Security Considerations

1. **Session Storage**: Credentials are stored in session storage, which is:
   - Cleared when tab/browser closes
   - Not accessible across tabs
   - Not sent with HTTP requests

2. **HTTPS Only**: Ensure your server uses HTTPS in production

3. **Password Not Saved**: Only login and server URL are saved to local storage (not password)

4. **Server Validation**: All credentials are validated server-side via `/api/v1/auth/login` endpoint

## Customization

### Changing Default Server

Edit `signin.html` line 51:
```html
<input 
    type="url" 
    id="server" 
    name="server" 
    class="form-control" 
    placeholder="https://your-server.com:port" 
    value="https://your-default-server.com:port"
    required
/>
```

### Styling

Modify `css/signin.css` to match your brand:
- Update gradient colors (lines 9, 123)
- Change card styling (lines 18-24)
- Customize form controls (lines 72-84)

### Form Validation

Modify validation rules in `src/signin.ts` → `validateForm()` method:
- Add custom validation logic
- Change error messages
- Add additional fields

## Troubleshooting

### "Cannot connect to server" Error
- Check server URL is correct
- Ensure server is running and accessible
- Check network/firewall settings
- Verify CORS is enabled on server

### "Authentication failed" Error
- Verify login number is correct
- Check password is correct
- Ensure account exists on server

### Infinite Redirect Loop
- Clear session storage
- Clear local storage
- Hard refresh browser (Ctrl+Shift+R)

### Credentials Not Saved
- Check browser allows local storage
- Check not in private/incognito mode
- Check browser storage quota

## Development Notes

- TypeScript compilation checks are in place
- Form uses native HTML5 validation
- Fetch API used for server communication
- ES6 modules used throughout
- Compatible with Vite build system

## Future Enhancements

Potential improvements:
- Add "Forgot Password" functionality
- Implement 2FA (two-factor authentication)
- Add "Remember Me" checkbox for password
- Show password strength indicator
- Add account registration flow
- Implement OAuth/SSO options
- Add biometric authentication support

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [Authentication](AUTHENTICATION.md) | HMAC signing and session management |
| [Getting Started](GETTING_STARTED.md) | Complete setup including sign-in |
| [Configuration](CONFIGURATION.md) | Server URL and auth configuration |
| [Troubleshooting](TROUBLESHOOTING.md) | Sign-in issues and solutions |
| [Development Guide](DEVELOPMENT.md) | Code structure for signin.ts |
