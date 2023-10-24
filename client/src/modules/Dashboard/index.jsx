import React, { useState, useEffect, useRef} from "react";
import Img1 from './../../assets/user.svg'
import Avatar from "./../../assets/user.svg"
import Input from "./../../components/Input"
import {io} from 'socket.io-client'

const Dashboard = ()=>{
    const [user, setUser] = useState(JSON.parse(localStorage.getItem('user:detail')));
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({});
    const [message, setMessage] = useState('');
    const [users,setUsers] = useState([]);
    const [socket,setSocket] = useState(null);
    const messageRef = useRef(null);
    useEffect(() => {
        setSocket(io('http://localhost:8080'))
    }, []);

    useEffect(() => {
        socket?.emit('addUser', user?.id);
        socket?.on('getUsers',users => {
            console.log('activeUsers :>>',users);
        })
        socket?.on('getMessage', data => {
            setMessages(prev => ({
                ...prev,
                messages: [...prev.messages, {user: data.user,message: data.message }]
            }))
        })
    }, [socket]);
    
    useEffect(() => {
        messageRef?.current?.scrollIntoView({ behavior: 'smooth'})
    }, [messages?.messages]);

    useEffect(() => {
        const loggedInUser = JSON.parse(localStorage.getItem('user:detail'));
        const fetchConversations = async() => {
            const res = await fetch(`http://localhost:8000/api/conversations/${loggedInUser?.id}`, {
                method:'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const resData = await res.json();
            setConversations(resData);
        }
        fetchConversations()
    }, []);

    useEffect(() => {
        const fetchUsers = async() => {
            const res = await fetch(`http://localhost:8000/api/users/${user?.id}`,{
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const resData = await res.json();
            setUsers(resData);
        };
        fetchUsers()
    },[]);

    const fetchMessages = async(conversationId, receiver) => {
        // console.log("receiver :>>",receiver);
        const res = await fetch(`http://localhost:8000/api/message/${conversationId}?senderId=${user?.id}&&receiverId=${receiver?.receiverId}`,{
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        const resData = await res.json();
        // console.log('resData :>>',resData.mssgData);
        conversationId = resData.conversationId;
        // console.log("conid::"+ conversationId);
        setMessages({messages: resData.mssgData, receiver, conversationId});
    }

    const sendMessage = async(e) => {
        socket.emit('sendMessage',{
            senderId: user?.id,
            receiverId: messages?.receiver?.receiverId,
            message,
            conversationId: messages?.conversationId
        });
        // console.log('message:>>',messages.conversationId);
        const res = await fetch('http://localhost:8000/api/message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversationId: messages?.conversationId, 
                senderId: user?.id, 
                message,
                receiverId: messages?.receiver?.receiverId
            })
        });
        setMessage('');
    }

    return(
        <div className="flex w-screen">
            {/* users dashboard */}
            <div className="w-[25%] h-screen bg-secondary overflow-scroll">
                <div className="flex items-center my-8">
                    <div className="border border-primary p-[2pz] rounded-full">
                        <img src={Avatar} width={70} height={70} alt="User"/>
                    </div>
                    <div className="ml-8">
                        <h3 className="text-2xl">{user?.fullName}</h3>
                        <p className="text-lg font-light">My Account</p>
                    </div>
                </div>
                <div className="mt-10 mx-14">
                    <div className="text-lg text-primary">Messages</div>
                    <div>
                        {
                            conversations.length>0 ?
                            conversations.map(({conversationId, user})=>{
                                return(
                                    <div className="flex items-center py-8 border-b border-b-gray-300">
                                        <div className="flex items-center cursor-pointer" onClick={() => fetchMessages(conversationId, user)}>
                                            <div>
                                                <img src={Img1} width={60} height={60} alt="User"/>
                                            </div>
                                            <div className="ml-6">
                                                <h3 className="text-1xl">{user?.fullName}</h3>
                                                <p className="text-lg font-light">{'status'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            }) : <div className="text-lg font-semibold text-center">No Conversations.</div>
                        }
                    </div>
                </div>
            </div>
            <hr />
            {/* chats */}
            <div className="w-[50%] h-screen bg-white flex flex-col items-center">
                {
                    messages?.receiver?.fullName &&
                    <div className='w-[100%] bg-secondary h-[80px] mt-14 rounded-full flex items-center px-14'>
                        <div className='cursor-pointer'><img src={Avatar} width={60} height={60} alt="User"/></div> 
                        <div className='ml-6 mr-auto'>
                            <h3 className='text-lg'>{messages?.receiver?.fullName}</h3>
                            <p className='text-sm font-light text-gray-600'>{'online'}</p>
                        </div>
                        <div className='cursor-pointer'>
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-phone-call" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                            <path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"></path>
                            <path d="M15 7a2 2 0 0 1 2 2"></path>
                            <path d="M15 3a6 6 0 0 1 6 6"></path>
                            </svg>
                        </div>
                    </div>
                }
                <div className="h-[75%] w-full overflow-scroll border-b">
                    <div className="p-14">
                        {
                            messages?.messages?.length > 0 ?
                            messages.messages.map(({message, user:{id} = {}})=>{
                                return(
                                    <>
                                        <div className={`max-w-[40%] rounded-b-xl p-4 mb-6 ${id === user?.id ? 'bg-primary text-white rounded-tl-xl ml-auto' : 'bg-secondary rounded-tr-xl'}`}>{message}</div>
                                        <div ref={messageRef}></div>
                                    </>
                                )
                            }):<div className="mt-24 text-lg font-semibold text-center">No Messages or no convo selected.</div>
                        }
                    </div>
                </div>
                {
                    messages?.receiver?.fullName &&
                    <div className="flex items-center w-full p-14">
                        <Input placeholder="Type a message..." value={message} onChange={(e) => setMessage(e.target.value)} className="w-[90%]" inputClassName="p-4 border-0 shadow-md rounded-full bg-light focus:ring-0 focus:border-0"/>
                        <div className={`"p-2 ml-4 rounded-full cursor-pointer bg-light ${!message && 'pointer-events-none'}"`} onClick={() => sendMessage()}>
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-send" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                            <path d="M10 14l11 -11"></path>
                            <path d="M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5"></path>
                            </svg>
                        </div>
                        <div className={`"p-2 ml-4 rounded-full cursor-pointer bg-light ${!message && 'pointer-events-none'}"`}>
                            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-circle-plus" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
                            <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"></path>
                            <path d="M9 12h6"></path>
                            <path d="M12 9v6"></path>
                            </svg>
                        </div>
                    </div>
                }
            </div>
            {/* Contacts */}
            <div className="w-[25%] h-screen bg-white px-8 py-16 overflow-scroll">
                <div className="text-lg text-primary">Contacts</div>
                {
                    users.length > 0 ? users.map(({userId, user})=>{
                        // console.log(user);
                        return(
                            <div className="flex items-center py-8 border-b border-b-gray-300">
                                <div className="flex items-center cursor-pointer" onClick={() => fetchMessages('new', user)}>
                                    <div>
                                        <img src={Img1} width={60} height={60} alt="User"/>
                                    </div>
                                    <div className="ml-6">
                                        <h3 className="text-1xl">{user?.fullName}</h3>
                                        <p className="text-lg font-light">{'status'}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    }) : <div className="text-lg font-semibold text-center">No Conversations.</div>
                }
            </div>
        </div>
    )
}
export default Dashboard
