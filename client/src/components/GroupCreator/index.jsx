import React, { useState } from 'react';
import config from '../../config';

const GroupCreator = ({ contacts, onCreateGroup, onClose }) => {
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const toggleMember = (contact) => {
        setSelectedMembers(prev => {
            const contactUser = contact.user || contact; // Handle both contact.user and direct contact objects
            const contactId = contactUser._id || contactUser.receiverId;

            if (prev.some(member => (member._id || member.receiverId) === contactId)) {
                return prev.filter(member => (member._id || member.receiverId) !== contactId);
            } else {
                return [...prev, contactUser];
            }
        });
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();

        if (!groupName.trim()) {
            setError('Group name is required');
            return;
        }

        if (selectedMembers.length === 0) {
            setError('Please select at least one member');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const user = JSON.parse(localStorage.getItem('user:detail'));
            const response = await fetch(`${config.API_URL}/api/groups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: groupName.trim(),
                    description: groupDescription.trim(),
                    createdBy: user.id,
                    members: selectedMembers.map(member => member.user?.receiverId || member.receiverId)
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create group');
            }

            onCreateGroup(data.group);
            onClose();

        } catch (error) {
            console.error('Create group error:', error);
            setError(error.message || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-gray-900">Create New Group</h2>
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
                <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleCreateGroup} className="space-y-4">
                        {/* Group Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Group Name *
                            </label>
                            <input
                                type="text"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Enter group name"
                                maxLength={50}
                                required
                            />
                        </div>

                        {/* Group Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description (Optional)
                            </label>
                            <textarea
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                placeholder="Enter group description"
                                rows={3}
                                maxLength={200}
                            />
                        </div>

                        {/* Member Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Members ({selectedMembers.length} selected)
                            </label>

                            {contacts.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <p>No contacts available</p>
                                    <p className="text-sm">Add contacts first to create a group</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2">
                                    {contacts.map((contact) => {
                                        const contactUser = contact.user || contact; // Handle both structures
                                        const contactId = contactUser._id || contactUser.receiverId;
                                        const isSelected = selectedMembers.some(member => (member._id || member.receiverId) === contactId);

                                        return (
                                            <label
                                                key={contactId}
                                                className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleMember(contact)}
                                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                                />

                                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                                        {contactUser?.fullName?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-gray-900 truncate">
                                                            {contactUser?.fullName || 'Unknown'}
                                                        </p>
                                                        <p className="text-xs text-gray-500 truncate">
                                                            {contactUser?.phoneNumber || 'No phone'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Selected Members Preview */}
                        {selectedMembers.length > 0 && (
                            <div className="border-t pt-4">
                                <p className="text-sm font-medium text-gray-700 mb-2">Selected Members:</p>
                                <div className="flex flex-wrap gap-2">
                                    {selectedMembers.map((member) => {
                                        const memberId = member._id || member.receiverId;
                                        return (
                                            <span
                                                key={memberId}
                                                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                                            >
                                                {member.fullName || 'Unknown'}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        // Find the original contact to toggle
                                                        const originalContact = contacts.find(c =>
                                                            (c.user && (c.user._id === memberId || c.user.receiverId === memberId)) ||
                                                            (c._id === memberId || c.receiverId === memberId)
                                                        );
                                                        if (originalContact) toggleMember(originalContact);
                                                    }}
                                                    className="ml-1 hover:text-blue-600"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-4 border-t bg-gray-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateGroup}
                        disabled={loading || !groupName.trim() || selectedMembers.length === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupCreator;
