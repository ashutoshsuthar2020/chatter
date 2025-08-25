
import React, { useState } from 'react';
import Button from '../Button';
import Input from '../Input';
import config from '../../config';

const ContactManager = ({ user, onContactAdded, onContactRemoved, onChatDeleted }) => {
    const [newContactPhoneNumber, setNewContactPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const addContact = async (e) => {
        e.preventDefault();
        if (!newContactPhoneNumber.trim()) return;

        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`${config.API_URL}/api/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.id,
                    contactPhoneNumber: newContactPhoneNumber.trim()
                })
            });

            const data = await res.json();

            if (res.ok) {
                setSuccess('Contact added successfully!');
                setNewContactPhoneNumber('');
                onContactAdded && onContactAdded(data.contact);
            } else {
                setError(data.error || 'Failed to add contact');
            }
        } catch (error) {
            console.error('Error adding contact:', error);
            setError('Failed to add contact. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const removeContact = async (contactId) => {
        if (!window.confirm('Are you sure you want to remove this contact?')) return;

        try {
            const res = await fetch(`${config.API_URL}/api/contacts/${contactId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.id
                })
            });

            const data = await res.json();

            if (res.ok) {
                onContactRemoved && onContactRemoved(contactId);
            } else {
                setError(data.error || 'Failed to remove contact');
            }
        } catch (error) {
            console.error('Error removing contact:', error);
            setError('Failed to remove contact. Please try again.');
        }
    };

    const deleteChat = async (conversationId) => {
        if (!window.confirm('Are you sure you want to delete this entire chat? This action cannot be undone.')) return;

        try {
            const res = await fetch(`${config.API_URL}/api/conversations/${conversationId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.id
                })
            });

            const data = await res.json();

            if (res.ok) {
                onChatDeleted && onChatDeleted(conversationId);
            } else {
                setError(data.error || 'Failed to delete chat');
            }
        } catch (error) {
            console.error('Error deleting chat:', error);
            setError('Failed to delete chat. Please try again.');
        }
    };

    return {
        addContact,
        removeContact,
        deleteChat,
        newContactPhoneNumber,
        setNewContactPhoneNumber,
        isLoading,
        error,
        success,
        setError,
        setSuccess
    };
};

const AddContactForm = ({ user, onContactAdded }) => {
    const {
        addContact,
        newContactPhoneNumber,
        setNewContactPhoneNumber,
        isLoading,
        error,
        success,
        setError,
        setSuccess
    } = ContactManager({ user, onContactAdded });

    // Clear messages after 3 seconds
    React.useEffect(() => {
        if (error || success) {
            const timer = setTimeout(() => {
                setError('');
                setSuccess('');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [error, success, setError, setSuccess]);

    return (
        <div className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-800 mb-3">Add New Contact</h3>

            <form onSubmit={addContact} className="space-y-3">
                <Input
                    type="tel"
                    placeholder="Enter contact's phone number"
                    value={newContactPhoneNumber}
                    onChange={(e) => setNewContactPhoneNumber(e.target.value)}
                    disabled={isLoading}
                    className="w-full"
                />

                <Button
                    type="submit"
                    disabled={isLoading || !newContactPhoneNumber.trim()}
                    className="w-full"
                    variant="primary"
                    label={isLoading ? 'Adding...' : 'Add Contact'}
                />
            </form>

            {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                </div>
            )}

            {success && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-600">{success}</p>
                </div>
            )}
        </div>
    );
};

export { ContactManager, AddContactForm };
export default ContactManager;
