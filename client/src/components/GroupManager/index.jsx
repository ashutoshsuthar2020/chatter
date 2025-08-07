import React, { useState, useEffect } from 'react';
import config from '../../config';

const GroupManager = ({ group, user, contacts, onUpdateGroup, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [availableContacts, setAvailableContacts] = useState([]);

    // Check if current user is admin
    const isAdmin = group.createdBy._id === user.id ||
        group.members.some(member =>
            member.user._id === user.id && member.role === 'admin'
        );

    useEffect(() => {
        // Get contacts that are not already in the group
        const groupMemberIds = group.members.map(member => member.user._id);
        const available = contacts.filter(contact =>
            !groupMemberIds.includes(contact.user?.receiverId)
        );
        setAvailableContacts(available);
    }, [group, contacts]);

    const handleAddMember = async (contact) => {
        if (!isAdmin) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${config.API_URL}/api/groups/${group._id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: contact.user.receiverId,
                    adminId: user.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to add member');
            }

            onUpdateGroup(data);
            // Remove from available contacts
            setAvailableContacts(prev =>
                prev.filter(c => c.user.receiverId !== contact.user.receiverId)
            );

        } catch (error) {
            console.error('Add member error:', error);
            setError(error.message || 'Failed to add member');
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (memberId) => {
        if (!isAdmin && memberId !== user.id) return;

        const confirmMessage = memberId === user.id ?
            'Are you sure you want to leave this group?' :
            'Are you sure you want to remove this member?';

        if (!window.confirm(confirmMessage)) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${config.API_URL}/api/groups/${group._id}/members/${memberId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    adminId: user.id
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to remove member');
            }

            if (memberId === user.id) {
                // User left the group, close the modal
                onClose();
            } else {
                onUpdateGroup(data);
                // Add back to available contacts if it's in our contacts
                const removedMember = group.members.find(m => m.user._id === memberId);
                if (removedMember) {
                    const contact = contacts.find(c => c.user?.receiverId === memberId);
                    if (contact) {
                        setAvailableContacts(prev => [...prev, contact]);
                    }
                }
            }

        } catch (error) {
            console.error('Remove member error:', error);
            setError(error.message || 'Failed to remove member');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{group.name}</h2>
                        <p className="text-sm text-gray-500">{group.members.length} members</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Current Members */}
                    <div className="p-4">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">Current Members</h3>
                        <div className="space-y-2">
                            {group.members.map((member) => (
                                <div key={member.user._id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                            {member.user.fullName?.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {member.user.fullName}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {member.role === 'admin' ? 'Admin' : 'Member'}
                                                {member.user._id === user.id && ' (You)'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Remove button */}
                                    {(isAdmin || member.user._id === user.id) &&
                                        member.user._id !== group.createdBy._id && (
                                            <button
                                                onClick={() => handleRemoveMember(member.user._id)}
                                                disabled={loading}
                                                className="text-red-500 hover:text-red-700 disabled:opacity-50 text-sm"
                                            >
                                                {member.user._id === user.id ? 'Leave' : 'Remove'}
                                            </button>
                                        )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Add Members (only for admins) */}
                    {isAdmin && availableContacts.length > 0 && (
                        <div className="p-4 border-t">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">Add Members</h3>
                            <div className="space-y-2">
                                {availableContacts.map((contact) => (
                                    <div key={contact.user.receiverId} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                                {contact.user.fullName?.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">
                                                    {contact.user.fullName}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {contact.user.phoneNumber}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleAddMember(contact)}
                                            disabled={loading}
                                            className="text-blue-500 hover:text-blue-700 disabled:opacity-50 text-sm"
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Group Info */}
                    {group.description && (
                        <div className="p-4 border-t">
                            <h3 className="text-sm font-medium text-gray-900 mb-2">Description</h3>
                            <p className="text-sm text-gray-600">{group.description}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupManager;
