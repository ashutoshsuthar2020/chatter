import React from 'react';
import Avatar from './../../assets/user.svg';

const ContactProfileModal = ({ contact, onClose, activeUsers = [] }) => {
    if (!contact) return null;

    const isOnline = activeUsers.find(x => x.userId === contact.receiverId || x.userId === contact.user?.receiverId);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-neutral-900">Contact Profile</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Profile Information */}
                    <div className="flex flex-col items-center space-y-6">
                        {/* Profile Picture */}
                        <div className="relative">
                            <img
                                src={contact.user?.picture || contact.picture || Avatar}
                                alt="Contact Profile"
                                className="w-32 h-32 rounded-full object-cover border-4 border-primary-200"
                            />
                            {/* Online status indicator */}
                            {isOnline && (
                                <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white"></div>
                            )}
                        </div>

                        {/* Contact Details */}
                        <div className="text-center space-y-4 w-full">
                            <div>
                                <h3 className="text-2xl font-semibold text-neutral-900">
                                    {contact.user?.fullName || contact.fullName || 'Unknown User'}
                                </h3>
                            </div>

                            {/* Bio Section */}
                            {(contact.user?.bio || contact.bio) && (
                                <div className="bg-neutral-50 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-neutral-700 mb-2">About</h4>
                                    <p className="text-sm text-neutral-600 leading-relaxed">
                                        {contact.user?.bio || contact.bio}
                                    </p>
                                </div>
                            )}

                            {/* Contact Info */}
                            <div className="space-y-3">
                                {contact.user?.phoneNumber && (
                                    <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                                        <span className="text-sm font-medium text-neutral-700">Phone</span>
                                        <span className="text-sm text-neutral-600">
                                            {contact.user.phoneNumber}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between py-2 border-b border-neutral-100">
                                    <span className="text-sm font-medium text-neutral-700">Status</span>
                                    <span className={`text-sm flex items-center ${isOnline ? 'text-green-600' : 'text-neutral-500'}`}>
                                        <div className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-neutral-400'}`}></div>
                                        {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-3 pt-6">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactProfileModal;
