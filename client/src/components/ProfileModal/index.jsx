import React, { useState } from 'react';
import config from '../../config';

const ProfileModal = ({ user, onClose, onUpdateProfile }) => {
    const [formData, setFormData] = useState({
        fullName: user?.fullName || '',
        bio: user?.bio || '',
        picture: user?.picture || ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessingImage, setIsProcessingImage] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const token = localStorage.getItem('user:token');
            const response = await fetch(`${config.API_URL}/api/users/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const updatedUser = await response.json();

                // Update localStorage
                localStorage.setItem('user:detail', JSON.stringify(updatedUser));

                // Call callback to update parent component
                onUpdateProfile(updatedUser);
                onClose();
            } else {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.message.includes('too large')) {
                alert('Image is too large. Please select a smaller image.');
            } else {
                alert(`Failed to update profile: ${error.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Check file size (limit to 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert('Please select an image smaller than 5MB');
                return;
            }

            // Check file type
            if (!file.type.startsWith('image/')) {
                alert('Please select a valid image file');
                return;
            }

            setIsProcessingImage(true);

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // Create canvas to resize image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Set max dimensions
                    const maxWidth = 400;
                    const maxHeight = 400;

                    let { width, height } = img;

                    // Calculate new dimensions
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw and compress image
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8); // 80% quality

                    setFormData(prev => ({
                        ...prev,
                        picture: compressedDataUrl
                    }));

                    setIsProcessingImage(false);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold text-neutral-900">Edit Profile</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Profile Picture */}
                        <div className="flex flex-col items-center space-y-4">
                            <div className="relative">
                                <img
                                    src={formData.picture || '/default-avatar.png'}
                                    alt="Profile"
                                    className="w-24 h-24 rounded-full object-cover border-4 border-primary-200"
                                />
                                {isProcessingImage && (
                                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                    </div>
                                )}
                                <label className={`absolute bottom-0 right-0 bg-primary-500 hover:bg-primary-600 rounded-full p-2 cursor-pointer transition-colors ${isProcessingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        disabled={isProcessingImage}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-neutral-500">
                                {isProcessingImage ? 'Processing image...' : 'Click camera icon to upload new photo (max 5MB)'}
                            </p>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                placeholder="Enter your full name"
                            />
                        </div>

                        {/* Bio */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">
                                Bio
                            </label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                rows={3}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                placeholder="Tell others about yourself..."
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
