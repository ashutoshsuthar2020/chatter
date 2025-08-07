import React, { useState } from 'react';
import Avatar from '../../assets/user.svg';
import config from '../../config';

const GroupMembersModal = ({ group, user, onClose, onMemberRemoved, onLeaveGroup, contacts }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showAddMember, setShowAddMember] = useState(false);
    const [availableContacts, setAvailableContacts] = useState([]);

    const isAdmin = group?.createdBy?._id === user?.id;

    // Get contacts that are not already in the group
    React.useEffect(() => {
        if (contacts && group?.members) {
            const existingMemberIds = group.members.map(member => member.user?._id);
            const available = contacts.filter(contact =>
                !existingMemberIds.includes(contact.user?.receiverId)
            );
            setAvailableContacts(available);
        }
    }, [contacts, group?.members]);

    const handleAddMember = async (contactId, contactName) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${config.API_URL}/api/groups/${group._id}/members`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: contactId,
                    adminId: user.id
                })
            });

            if (response.ok) {
                const updatedGroup = await response.json();
                onMemberRemoved(updatedGroup); // Reuse this callback to update the group
                setShowAddMember(false);
                alert(`${contactName} has been added to the group.`);

                // Update available contacts
                const existingMemberIds = updatedGroup.members.map(member => member.user?._id);
                const available = contacts.filter(contact =>
                    !existingMemberIds.includes(contact.user?.receiverId)
                );
                setAvailableContacts(available);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to add member');
            }
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Failed to add member. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveMember = async (memberId, memberName) => {
        if (!window.confirm(`Are you sure you want to remove ${memberName} from the group?`)) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${config.API_URL}/api/groups/${group._id}/members/${memberId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    adminId: user.id
                })
            });

            if (response.ok) {
                const updatedGroup = await response.json();
                onMemberRemoved(updatedGroup);
                alert(`${memberName} has been removed from the group.`);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to remove member');
            }
        } catch (error) {
            console.error('Error removing member:', error);
            alert('Failed to remove member. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLeaveGroup = async () => {
        if (!window.confirm('Are you sure you want to leave this group? You will no longer receive messages from this group.')) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`${config.API_URL}/api/groups/${group._id}/members/${user.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user.id
                })
            });

            if (response.ok) {
                onLeaveGroup(group._id);
                onClose();
                alert('You have left the group successfully.');
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to leave group');
            }
        } catch (error) {
            console.error('Error leaving group:', error);
            alert('Failed to leave group. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-neutral-200 bg-gradient-to-r from-primary-50 to-primary-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-primary-900">{group?.name}</h2>
                            <p className="text-sm text-primary-600">
                                {group?.members?.length} member{group?.members?.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Add Member Button (only for admin) */}
                            {isAdmin && availableContacts.length > 0 && (
                                <button
                                    onClick={() => setShowAddMember(!showAddMember)}
                                    className="p-2 hover:bg-primary-200 rounded-full transition-colors"
                                    disabled={isLoading}
                                    title="Add Member"
                                >
                                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-primary-200 rounded-full transition-colors"
                                disabled={isLoading}
                            >
                                <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Add Member Section (only visible when admin clicks add) */}
                {showAddMember && isAdmin && (
                    <div className="p-4 border-b border-neutral-200 bg-blue-50">
                        <h3 className="text-sm font-medium text-blue-900 mb-3">Add Members</h3>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {availableContacts.length > 0 ? (
                                availableContacts.map((contact) => (
                                    <div
                                        key={contact.user?.receiverId}
                                        className="flex items-center p-2 rounded-lg bg-white hover:bg-blue-100 transition-colors"
                                    >
                                        <img
                                            src={contact.user?.picture || Avatar}
                                            className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                                            alt={contact.user?.fullName}
                                        />
                                        <div className="ml-2 flex-1 min-w-0">
                                            <p className="text-sm font-medium text-neutral-900 truncate">
                                                {contact.user?.fullName}
                                            </p>
                                            <p className="text-xs text-neutral-500 truncate">
                                                {contact.user?.phoneNumber}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleAddMember(contact.user?.receiverId, contact.user?.fullName)}
                                            disabled={isLoading}
                                            className="ml-2 px-3 py-1 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 text-xs font-medium transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-neutral-500 text-center py-2">
                                    All your contacts are already in this group.
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Members List */}
                <div className="flex-1 overflow-y-auto max-h-96">
                    <div className="p-4">
                        <div className="space-y-2">
                            {group?.members?.map((member) => {
                                const isCurrentUser = member.user?._id === user?.id;
                                const isMemberAdmin = group?.createdBy?._id === member.user?._id;

                                return (
                                    <div
                                        key={member.user?._id}
                                        className="flex items-center p-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 transition-colors"
                                    >
                                        {/* Avatar */}
                                        <div className="relative">
                                            <img
                                                src={member.user?.picture || Avatar}
                                                className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                                                alt={member.user?.fullName}
                                            />
                                            {isMemberAdmin && (
                                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Member Info */}
                                        <div className="ml-3 flex-1 min-w-0">
                                            <div className="flex items-center space-x-2">
                                                <h3 className="text-sm font-medium text-neutral-900 truncate">
                                                    {member.user?.fullName}
                                                    {isCurrentUser && (
                                                        <span className="text-xs text-primary-600 ml-1">(You)</span>
                                                    )}
                                                </h3>
                                                {isMemberAdmin && (
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-neutral-500 truncate">
                                                {member.user?.phoneNumber}
                                            </p>
                                            <p className="text-xs text-neutral-400">
                                                Joined {new Date(member.joinedAt).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center space-x-1">
                                            {/* Admin can remove non-admin members (but not themselves) */}
                                            {isAdmin && !isMemberAdmin && !isCurrentUser && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.user._id, member.user.fullName)}
                                                    disabled={isLoading}
                                                    className="p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Remove Member"
                                                >
                                                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-neutral-200 bg-neutral-50">
                    <div className="flex justify-between items-center">
                        {/* Group Info */}
                        <div className="text-xs text-neutral-500">
                            Created by {group?.createdBy?.fullName}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-2">
                            {!isAdmin && (
                                <button
                                    onClick={handleLeaveGroup}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center space-x-2">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            <span>Leaving...</span>
                                        </div>
                                    ) : (
                                        'Leave Group'
                                    )}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="px-4 py-2 bg-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-300 disabled:opacity-50 transition-colors text-sm font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupMembersModal;
