import GoogleSignInButton from './../../components/GoogleSignInButton/index';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

const Form = ({
    isSignInPage = true,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const navigate = useNavigate();

    const handleGoogleSuccess = async (googleUserData) => {
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const endpoint = isSignInPage ? 'login/google' : 'register/google';
            const res = await fetch(`${config.API_URL}/api/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    googleId: googleUserData.googleId,
                    email: googleUserData.email,
                    fullName: googleUserData.fullName,
                    firstName: googleUserData.firstName,
                    lastName: googleUserData.lastName,
                    picture: googleUserData.picture,
                    credential: googleUserData.credential
                })
            });

            const resData = await res.json();

            if (res.status === 200 || res.status === 201) {
                if (resData.token) {
                    localStorage.setItem('user:token', resData.token);
                    localStorage.setItem('user:detail', JSON.stringify(resData.user));
                    
                    setSuccess('Authentication successful! Redirecting...');
                    setTimeout(() => navigate('/'), 1000);
                } else {
                    setError(resData.message || 'Authentication failed');
                }
            } else if (res.status === 400 && resData.message === 'User not found. Please sign up first.') {
                // Auto-redirect to sign up if user doesn't exist during sign in
                if (isSignInPage) {
                    setError('Account not found. Redirecting to sign up...');
                    setTimeout(() => navigate('/users/sign_up'), 2000);
                } else {
                    setError(resData.message);
                }
            } else if (res.status === 400 && resData.message === 'User already exists with this email') {
                // Auto-redirect to sign in if user exists during sign up
                if (!isSignInPage) {
                    setError('Account already exists. Redirecting to sign in...');
                    setTimeout(() => navigate('/users/sign_in'), 2000);
                } else {
                    setError(resData.message);
                }
            } else {
                setError(resData.message || 'Authentication failed');
            }
        } catch (error) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleError = (error) => {
        setError('Google authentication failed. Please try again.');
        console.error('Google Sign-In Error:', error);
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="bg-white w-full max-w-md shadow-medium rounded-3xl p-8">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                        Welcome to Chatter
                    </h1>
                    <p className="text-neutral-600">
                        {isSignInPage ? 'Sign in to continue chatting with your friends' : 'Create your account to start chatting'}
                    </p>
                </div>
                
                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6">
                        {error}
                    </div>
                )}
                
                {/* Success Message */}
                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm mb-6">
                        {success}
                    </div>
                )}

                {/* Google Sign-In Button */}
                <div className="mb-6">
                    <GoogleSignInButton
                        onSuccess={handleGoogleSuccess}
                        onError={handleGoogleError}
                        isSignUp={!isSignInPage}
                        disabled={isLoading}
                    />
                </div>

                <div className="text-center text-sm text-neutral-600">
                    {isSignInPage ? "Don't have an account?" : "Already have an account?"}{' '}
                    <span 
                        className='text-primary-600 hover:text-primary-700 cursor-pointer font-medium transition-colors' 
                        onClick={() => navigate(`/users/${isSignInPage ? 'sign_up' : 'sign_in'}`)}
                    >
                        {isSignInPage ? 'Sign up' : 'Sign in'}
                    </span>
                </div>

                <div className="mt-6 pt-6 border-t border-neutral-100 text-center">
                    <p className="text-xs text-neutral-500">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    )
};
export default Form;
