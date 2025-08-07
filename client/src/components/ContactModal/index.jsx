import React, { useState } from 'react';
import config from '../../config';

const AddContactModal = ({ user, contacts, onClose, onContactAdded }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAddContact = async (e) => {
        e.preventDefault();

        if (!phoneNumber.trim()) {
            setError('Phone number is required');
            return;
        }

        // Check if contact already exists
        if (contacts.some(contact => contact.user?.phoneNumber === phoneNumber.trim())) {
            setError('This contact already exists');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${config.API_URL}/api/contacts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: user?.id,
                    contactPhoneNumber: phoneNumber.trim()
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to add contact');
            }

            onContactAdded(data.contact);
            onClose();

        } catch (error) {
            console.error('Add contact error:', error);
            setError(error.message || 'Failed to add contact');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-200">
                    <h2 className="text-xl font-semibold text-neutral-900">Add New Contact</h2>
                    <button
                        onClick={onClose}
                        className="text-neutral-400 hover:text-neutral-600 p-1"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleAddContact} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full px-4 py-3 border border-neutral-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Enter phone number (e.g., +1234567890)"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="flex items-center justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !phoneNumber.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Adding...' : 'Add Contact'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AddContactModal;
