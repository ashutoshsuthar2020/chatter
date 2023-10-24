import Input from './../../components/Input/index';
import Button from './../../components/Button/index';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
    
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        console.log('data:>> ',data);
        e.preventDefault();
        const res = await fetch(`http://localhost:8000/api/${isSignInPage?'login':'register'}`,{
            method:'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        if(res.status===400){
            alert('Invalid credentials')
        }else{
            const resData = await res.json();
            if(resData.token){
                localStorage.setItem('user:token', resData.token)
                localStorage.setItem('user:detail', JSON.stringify(resData.user))
                navigate('/')
            }
            else{
                alert(resData);
            }
        }
    };

    return (
        <div className="bg-white w-[600px] h-[800px] shadow-lg rounded-lg flex flex-col justify-center items-center">
            <div className="text-4xl font-extrabold">Welcome {isSignInPage && 'Back'}</div>
            <div className="text-xl font-light">{isSignInPage ? 'Sign in to get explored':'Sign up to get started'}</div>
            <br />
            <form className='flex flex-col items-center w-full' onSubmit={(e) => handleSubmit(e)}>
                {!isSignInPage && <Input label='Full name' name='name' placeholder='Enter your full name' value={data.fullName} onChange={(e) => setData({...data, fullName:e.target.value})}/>}
                <Input label='Email address' name='email' placeholder='Enter your email' className="mb-6" value={data.email} onChange={(e) => setData({...data, email:e.target.value})}/>
                <Input label='Password' type='password' name='password' placeholder='Enter your password' className="mb-14" value={data.password} onChange={(e) => setData({...data, password:e.target.value})}/>
                <Button label={isSignInPage?'Sign in':'Sign up'} type="submit" className='w-1/4 mb-2'/>
            </form>
            <div>{isSignInPage ? "Don't have an account?": "Already have an account?"} <span className='underline cursor-pointer text-primary' onClick={() => navigate(`/users/${isSignInPage?'sign_up':'sign_in'}`)}>{isSignInPage?'Sign up':'Sign in'}</span></div>
        </div>
    )
};
export default Form;