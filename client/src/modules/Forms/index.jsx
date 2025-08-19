import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

const Form = ({
    isSignInPage = true,
}) => {
    const [data, setData] = useState({
        fullName: '',
        phoneNumber: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            if (isSignInPage) {
                // Sign In - just need phone number
                if (!data.phoneNumber) {
                    setError('Phone number is required');
                    setIsLoading(false);
                    return;
                }
                console.log('API URL:', `${config.API_URL}/api/login`);
                const res = await fetch(`${config.API_URL}/api/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phoneNumber: data.phoneNumber
                    })
                });

                const resData = await res.json();

                if (res.status === 200) {
                    localStorage.setItem('user:detail', JSON.stringify(resData.user));
                    setSuccess('Login successful! Redirecting...');
                    setTimeout(() => navigate('/'), 1000);
                } else {
                    setError(resData.message || 'Login failed');
                }
            } else {
                // Sign Up - need both name and phone number
                if (!data.fullName || !data.phoneNumber) {
                    setError('Full name and phone number are required');
                    setIsLoading(false);
                    return;
                }
                const res = await fetch(`${config.API_URL}/api/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fullName: data.fullName,
                        phoneNumber: data.phoneNumber
                    })
                });

                const resData = await res.json();

                if (res.status === 201) {
                    localStorage.setItem('user:detail', JSON.stringify(resData.user));
                    setSuccess('Registration successful! Redirecting...');
                    setTimeout(() => navigate('/'), 1000);
                } else {
                    setError(resData.message || 'Registration failed');
                }
            }
        } catch (error) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
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

                {/* Phone Number Form */}
                <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                    {!isSignInPage && (
                        <div>
                            <label htmlFor="fullName" className="block text-sm font-medium text-neutral-700 mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                id="fullName"
                                value={data.fullName}
                                onChange={(e) => setData({ ...data, fullName: e.target.value })}
                                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                placeholder="Enter your full name"
                                required={!isSignInPage}
                                disabled={isLoading}
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="phoneNumber" className="block text-sm font-medium text-neutral-700 mb-2">
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            id="phoneNumber"
                            value={data.phoneNumber}
                            onChange={(e) => setData({ ...data, phoneNumber: e.target.value })}
                            className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            placeholder="Enter your phone number"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-medium py-3 px-4 rounded-xl transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                {isSignInPage ? 'Signing in...' : 'Creating account...'}
                            </div>
                        ) : (
                            isSignInPage ? 'Sign In' : 'Create Account'
                        )}
                    </button>
                </form>

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
