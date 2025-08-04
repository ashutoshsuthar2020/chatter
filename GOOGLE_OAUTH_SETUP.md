# Google OAuth Setup Guide

## Setting up Google OAuth for Chatter App

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** or **Google Identity Services**

### 2. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth 2.0 Client IDs**
3. Configure the consent screen if prompted
4. For **Application type**, select **Web application**
5. Add authorized origins:
   - `http://localhost:3000` (for development)
   - `http://localhost:3001` (if using different port)
   - Add your production domain when ready
6. Add authorized redirect URIs:
   - `http://localhost:3000/users/sign_in`
   - `http://localhost:3000/users/sign_up`
7. Click **Create**

### 3. Configure Environment Variables

1. Copy the **Client ID** from Google Cloud Console
2. Update the following files:

**Client-side (.env in /client folder):**
```
REACT_APP_GOOGLE_CLIENT_ID=your_actual_google_client_id_here
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=http://localhost:8000
```

**Server-side (.env in /server folder):**
```
MONGODB = "mongodb://localhost:27017"
PORT = 8000
JWT_SECRET_KEY = "THIS_IS_A_JWT_SECRET_KEY"
GOOGLE_CLIENT_ID = your_actual_google_client_id_here
```

### 4. Test the Implementation

1. Start the server: `cd server && npm start`
2. Start the client: `cd client && npm start`
3. Navigate to sign-up page
4. Click "Continue with Google" button
5. Complete the OAuth flow

### 5. Features Included

- ✅ Google OAuth sign-up
- ✅ Google OAuth sign-in  
- ✅ Automatic account creation from Google profile
- ✅ JWT token generation for authenticated sessions
- ✅ Profile picture from Google account
- ✅ Secure token verification on server-side

### 6. Security Notes

- The Google token is verified on the server-side using Google's official library
- User data is validated against the Google token payload
- JWT tokens are generated for session management
- Existing email validation prevents duplicate accounts

### 7. Troubleshooting

**"Invalid Google token" error:**
- Check that GOOGLE_CLIENT_ID matches in both client and server
- Ensure the token hasn't expired
- Verify the authorized origins in Google Cloud Console

**"User already exists" error:**
- This is expected behavior if trying to sign up with an email that's already registered
- Use sign-in instead, or use a different email address

**Button not appearing:**
- Check browser console for errors
- Verify that @react-oauth/google is properly installed
- Check that GoogleOAuthProvider is wrapping the app component
