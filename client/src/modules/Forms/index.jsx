import Input from './../../components/Input/index';
import Button from './../../components/Button/index';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';

const Form = ({
    isSignInPage = true,
}) => {
    const [data, setData] = useState({
        ...(!isSignInPage && {
            fullName: ''
        }),
        email: '',
        password: '',
    })
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
            const res = await fetch(`${config.API_URL}/api/${isSignInPage ? 'login' : 'register'}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const resData = await res.json();

            if (res.status === 400 || res.status === 401) {
                setError(resData.message || 'Invalid credentials');
            } else if (res.status === 200 || res.status === 201) {
                if (resData.token) {
                    localStorage.setItem('user:token', resData.token);
                    localStorage.setItem('user:detail', JSON.stringify(resData.user));
                    
                    if (isSignInPage) {
                        setSuccess('Sign in successful! Redirecting...');
                        setTimeout(() => navigate('/'), 1000);
                    } else {
                        setSuccess('Account created successfully! Redirecting to dashboard...');
                        setTimeout(() => navigate('/'), 1500);
                    }
                } else {
                    setError(resData.message || 'Something went wrong');
                }
            } else {
                setError('Server error. Please try again.');
            }
        } catch (error) {
            setError('Network error. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="bg-white w-full max-w-md shadow-medium rounded-3xl p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-neutral-900 mb-2">
                        Welcome {isSignInPage && 'Back'}
                    </h1>
                    <p className="text-neutral-600">
                        {isSignInPage ? 'Sign in to continue chatting' : 'Create your account to get started'}
                    </p>
                </div>

                <form className='space-y-6' onSubmit={(e) => handleSubmit(e)}>
                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                            {error}
                        </div>
                    )}
                    
                    {/* Success Message */}
                    {success && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
                            {success}
                        </div>
                    )}

                    {!isSignInPage && (
                        <Input
                            label='Full name'
                            name='name'
                            placeholder='Enter your full name'
                            value={data.fullName}
                            onChange={(e) => setData({ ...data, fullName: e.target.value })}
                            disabled={isLoading}
                        />
                    )}
                    <Input
                        label='Email address'
                        name='email'
                        type='email'
                        placeholder='Enter your email'
                        value={data.email}
                        onChange={(e) => setData({ ...data, email: e.target.value })}
                        disabled={isLoading}
                    />
                    <Input
                        label='Password'
                        type='password'
                        name='password'
                        placeholder='Enter your password'
                        value={data.password}
                        onChange={(e) => setData({ ...data, password: e.target.value })}
                        disabled={isLoading}
                    />
                    <Button
                        label={isLoading ? (isSignInPage ? 'Signing in...' : 'Creating account...') : (isSignInPage ? 'Sign in' : 'Sign up')}
                        type="submit"
                        className='w-full'
                        size='lg'
                        disabled={isLoading}
                    />
                </form>

                <div className="mt-6 text-center text-sm text-neutral-600">
                    {isSignInPage ? "Don't have an account?" : "Already have an account?"}{' '}
                    <span
                        className='text-primary-600 hover:text-primary-700 cursor-pointer font-medium transition-colors'
                        onClick={() => navigate(`/users/${isSignInPage ? 'sign_up' : 'sign_in'}`)}
                    >
                        {isSignInPage ? 'Sign up' : 'Sign in'}
                    </span>
                </div>
            </div>
        </div>
    )
};
export default Form;