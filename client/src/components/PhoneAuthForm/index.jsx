import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';
import Input from '../Input';
import Button from '../Button';

const PhoneAuthForm = ({ isSignInPage = true }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            if (!phoneNumber.trim()) {
                throw new Error('Phone number is required');
            }

            if (!isSignInPage && !fullName.trim()) {
                throw new Error('Full name is required for registration');
            }

            const formattedPhone = phoneNumber;
            const endpoint = isSignInPage ? 'phone-login' : 'phone-register';
            const requestBody = {
                phoneNumber: formattedPhone
            };

            if (!isSignInPage) {
                requestBody.fullName = fullName.trim();
            }

            const response = await fetch(`${config.API_URL}/api/auth/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `${isSignInPage ? 'Login' : 'Registration'} failed`);
            }

            // Store user data and token
            localStorage.setItem('user:token', data.token);
            localStorage.setItem('user:detail', JSON.stringify(data.user));

            setSuccess(data.message);

            // Navigate to dashboard
            setTimeout(() => {
                navigate('/');
            }, 1000);

        } catch (error) {
            console.error('Auth error:', error);
            setError(error.message || `${isSignInPage ? 'Login' : 'Registration'} failed`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white w-full max-w-md mx-auto rounded-lg shadow-lg p-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    {isSignInPage ? 'Welcome Back' : 'Create Account'}
                </h1>
                <p className="text-gray-600">
                    {isSignInPage
                        ? 'Enter your phone number to sign in'
                        : 'Enter your details to get started'
                    }
                </p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {!isSignInPage && (
                    <Input
                        label="Full Name"
                        name="fullName"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                    />
                )}

                <Input
                    label="Phone Number"
                    name="phoneNumber"
                    type="tel"
                    placeholder="Enter your phone number."
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                />

                <Button
                    label={loading ? (isSignInPage ? 'Signing in...' : 'Creating account...') : (isSignInPage ? 'Sign In' : 'Sign Up')}
                    type="submit"
                    disabled={loading}
                    className="w-full"
                />

                <div className="text-center">
                    <p className="text-gray-600">
                        {isSignInPage ? "Don't have an account?" : "Already have an account?"}
                        <button
                            type="button"
                            onClick={() => navigate(isSignInPage ? '/users/sign_up' : '/users/sign_in')}
                            className="text-blue-600 hover:text-blue-800 ml-2 font-medium"
                        >
                            {isSignInPage ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </div>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                </p>
            </div>
        </div>
    );
};

export default PhoneAuthForm;
