const logger = require('../logger');
const Contacts = require('../models/Contacts');
const Groups = require('../models/Groups');
const GroupConversations = require('../models/GroupConversations');

class PresenceFilterService {
    constructor(natsService) {
        this.nats = natsService;
        this.jc = require('nats').JSONCodec();
        this.setupSubscriptions();
    }

    async setupSubscriptions() {
        // Subscribe to raw presence events and filter them
        this.nats.subscribe('presence.events.user_online', async (data) => {
            await this.filterAndBroadcastOnlineEvent(data);
        });

        this.nats.subscribe('presence.events.user_offline', async (data) => {
            await this.filterAndBroadcastOfflineEvent(data);
        });
    }

    /**
     * Filter and broadcast user online events based on contact relationships
     * @param {Object} eventData - Raw online event data
     */
    async filterAndBroadcastOnlineEvent(eventData) {
        try {
            const { userId, ...rest } = eventData;

            // Get all users who should see this user's online status
            const visibleTo = await this.getVisibleToUsers(userId);

            if (visibleTo.length > 0) {
                const filteredEvent = {
                    type: 'user_online',
                    userId,
                    visibleTo,
                    ...rest,
                    filtered: true
                };

                // Publish filtered event
                await this.nats.publish('presence.filtered.user_online', filteredEvent);

                logger.debug(`PresenceFilterService: Filtered online event for ${userId}, visible to ${visibleTo.length} users`);
            }
        } catch (error) {
            logger.error('PresenceFilterService: Error filtering online event:', error);
        }
    }

    /**
     * Filter and broadcast user offline events based on contact relationships
     * @param {Object} eventData - Raw offline event data
     */
    async filterAndBroadcastOfflineEvent(eventData) {
        try {
            const { userId, ...rest } = eventData;

            // Get all users who should see this user's offline status
            const visibleTo = await this.getVisibleToUsers(userId);

            if (visibleTo.length > 0) {
                const filteredEvent = {
                    type: 'user_offline',
                    userId,
                    visibleTo,
                    ...rest,
                    filtered: true
                };

                // Publish filtered event
                await this.nats.publish('presence.filtered.user_offline', filteredEvent);

                logger.debug(`PresenceFilterService: Filtered offline event for ${userId}, visible to ${visibleTo.length} users`);
            }
        } catch (error) {
            logger.error('PresenceFilterService: Error filtering offline event:', error);
        }
    }

    /**
     * Get list of users who should see the given user's presence
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    async getVisibleToUsers(userId) {
        try {
            const visibleUsers = new Set();

            // 1. Add users who have this user in their contacts
            const contactRelations = await Contacts.find({ contactUserId: userId });
            contactRelations.forEach(contact => {
                visibleUsers.add(contact.userId);
            });

            // 2. Add users who are in the same groups
            const groupMembers = await this.getSharedGroupMembers(userId);
            groupMembers.forEach(memberId => {
                visibleUsers.add(memberId);
            });

            // 3. Remove the user themselves (they don't need to see their own status)
            visibleUsers.delete(userId);

            return Array.from(visibleUsers);
        } catch (error) {
            logger.error('PresenceFilterService: Error getting visible users:', error);
            return [];
        }
    }

    /**
     * Get users who share groups with the given user
     * @param {string} userId 
     * @returns {Promise<Array>}
     */
    async getSharedGroupMembers(userId) {
        try {
            // Find all group conversations where this user is a member
            const userGroupConversations = await GroupConversations.find({
                members: userId
            }).populate('groupId');

            const sharedMembers = new Set();

            for (const groupConv of userGroupConversations) {
                if (groupConv.groupId) {
                    // Add all members of this group
                    groupConv.members.forEach(memberId => {
                        if (memberId.toString() !== userId) {
                            sharedMembers.add(memberId.toString());
                        }
                    });
                }
            }

            return Array.from(sharedMembers);
        } catch (error) {
            logger.error('PresenceFilterService: Error getting shared group members:', error);
            return [];
        }
    }

    /**
     * Check if userA should see userB's presence
     * @param {string} userA 
     * @param {string} userB 
     * @returns {Promise<boolean>}
     */
    async canUserSeePresence(userA, userB) {
        try {
            // Check if userA has userB in contacts
            const contact = await Contacts.findOne({
                userId: userA,
                contactUserId: userB
            });

            if (contact) return true;

            // Check if they share any groups
            const sharedGroups = await this.getSharedGroups(userA, userB);
            return sharedGroups.length > 0;
        } catch (error) {
            logger.error('PresenceFilterService: Error checking presence visibility:', error);
            return false;
        }
    }

    /**
     * Get shared groups between two users
     * @param {string} userA 
     * @param {string} userB 
     * @returns {Promise<Array>}
     */
    async getSharedGroups(userA, userB) {
        try {
            const sharedGroups = await GroupConversations.find({
                members: { $all: [userA, userB] }
            }).populate('groupId');

            return sharedGroups.map(gc => gc.groupId);
        } catch (error) {
            logger.error('PresenceFilterService: Error getting shared groups:', error);
            return [];
        }
    }

    /**
     * Get filtered presence status for a list of users from the perspective of a viewer
     * @param {string} viewerUserId 
     * @param {Array} userIds 
     * @returns {Promise<Array>}
     */
    async getFilteredPresenceStatus(viewerUserId, userIds) {
        try {
            const filteredStatus = [];

            for (const userId of userIds) {
                const canSee = await this.canUserSeePresence(viewerUserId, userId);
                if (canSee) {
                    filteredStatus.push({
                        userId,
                        visible: true
                    });
                } else {
                    filteredStatus.push({
                        userId,
                        visible: false,
                        reason: 'not_in_contacts_or_groups'
                    });
                }
            }

            return filteredStatus;
        } catch (error) {
            logger.error('PresenceFilterService: Error getting filtered presence status:', error);
            return userIds.map(userId => ({ userId, visible: false, reason: 'error' }));
        }
    }

    /**
     * Get privacy settings for a user (extensible for future features)
     * @param {string} userId 
     * @returns {Promise<Object>}
     */
    async getUserPrivacySettings(userId) {
        try {
            // For now, return default settings
            // In the future, this could be stored in a UserSettings model
            return {
                showOnlineStatus: true,
                showLastSeen: true,
                whoCanSeePresence: 'contacts_and_groups', // 'everyone', 'contacts_only', 'contacts_and_groups', 'nobody'
                showTypingStatus: true
            };
        } catch (error) {
            logger.error('PresenceFilterService: Error getting privacy settings:', error);
            return {
                showOnlineStatus: false,
                showLastSeen: false,
                whoCanSeePresence: 'nobody',
                showTypingStatus: false
            };
        }
    }

    /**
     * Filter presence based on privacy settings
     * @param {string} userId 
     * @param {string} viewerUserId 
     * @param {Object} presenceData 
     * @returns {Promise<Object|null>}
     */
    async filterPresenceByPrivacy(userId, viewerUserId, presenceData) {
        try {
            const privacySettings = await this.getUserPrivacySettings(userId);

            if (!privacySettings.showOnlineStatus) {
                return null; // Don't show any presence
            }

            const canSee = await this.canUserSeePresence(viewerUserId, userId);
            if (!canSee && privacySettings.whoCanSeePresence !== 'everyone') {
                return null;
            }

            // Filter the presence data based on settings
            const filteredPresence = { ...presenceData };

            if (!privacySettings.showLastSeen) {
                delete filteredPresence.lastSeen;
            }

            if (!privacySettings.showTypingStatus) {
                delete filteredPresence.activity;
            }

            return filteredPresence;
        } catch (error) {
            logger.error('PresenceFilterService: Error filtering presence by privacy:', error);
            return null;
        }
    }
}

module.exports = PresenceFilterService;