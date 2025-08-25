import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const GoogleSignInButton = ({ onSuccess, onError, isSignUp = false, disabled = false }) => {
    const handleGoogleSuccess = (credentialResponse) => {
        try {
            const decoded = jwtDecode(credentialResponse.credential);

            const googleUserData = {
                googleId: decoded.sub,
                fullName: decoded.name,
                firstName: decoded.given_name,
                lastName: decoded.family_name,
                picture: decoded.picture,
                credential: credentialResponse.credential
            };

            onSuccess(googleUserData);
        } catch (error) {
            console.error('Error decoding Google JWT:', error);
            onError(error);
        }
    };

    const handleGoogleError = () => {
        onError(new Error('Google Sign-In failed'));
    };

    return (
        <div className={`w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="google-signin-wrapper">
                <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    size="large"
                    text={isSignUp ? "signup_with" : "signin_with"}
                    shape="rectangular"
                    logo_alignment="left"
                    width="100%"
                />
            </div>
        </div>
    );
};

export default GoogleSignInButton;