package services

import (
	"log"
)

type ContactRepository interface {
	FindUsersWhoHaveContact(contactUserID string) ([]string, error)
	ContactExists(userID, contactUserID string) (bool, error)
}

type GroupConversationRepository interface {
	GetGroupMembersForUser(userID string) ([]string, error)
	GetSharedGroups(userA, userB string) ([]string, error)
}

type PresenceEvent struct {
	Type      string                 `json:"type"`
	UserID    string                 `json:"userId"`
	VisibleTo []string               `json:"visibleTo,omitempty"`
	Filtered  bool                   `json:"filtered"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

type PrivacySettings struct {
	ShowOnlineStatus  bool   `json:"showOnlineStatus"`
	ShowLastSeen      bool   `json:"showLastSeen"`
	WhoCanSeePresence string `json:"whoCanSeePresence"`
	ShowTypingStatus  bool   `json:"showTypingStatus"`
}

type PresenceFilterService struct {
	nats      *NatsService
	contacts  ContactRepository
	groupConv GroupConversationRepository
}

func NewPresenceFilterService(
	nats *NatsService,
	contacts ContactRepository,
	groupConv GroupConversationRepository,
) *PresenceFilterService {

	p := &PresenceFilterService{
		nats:      nats,
		contacts:  contacts,
		groupConv: groupConv,
	}

	p.setupSubscriptions()

	return p
}

func (p *PresenceFilterService) setupSubscriptions() {
	p.nats.Subscribe("presence.events.user_online", func(data map[string]interface{}) {
		p.FilterAndBroadcastOnlineEvent(data)
	})

	p.nats.Subscribe("presence.events.user_offline", func(data map[string]interface{}) {
		p.FilterAndBroadcastOfflineEvent(data)
	})
}

func (p *PresenceFilterService) FilterAndBroadcastOnlineEvent(eventData map[string]interface{}) {
	userID, ok := eventData["userId"].(string)
	if !ok {
		return
	}

	visibleTo, err := p.GetVisibleToUsers(userID)
	if err != nil {
		log.Printf("PresenceFilterService: Error filtering online event: %v", err)
		return
	}

	if len(visibleTo) == 0 {
		return
	}

	filteredEvent := PresenceEvent{
		Type:      "user_online",
		UserID:    userID,
		VisibleTo: visibleTo,
		Filtered:  true,
		Data:      eventData,
	}

	p.nats.Publish("presence.filtered.user_online", filteredEvent)

	log.Printf(
		"PresenceFilterService: Filtered online event for %s visible to %d users",
		userID,
		len(visibleTo),
	)
}

func (p *PresenceFilterService) FilterAndBroadcastOfflineEvent(eventData map[string]interface{}) {
	userID, ok := eventData["userId"].(string)
	if !ok {
		return
	}

	visibleTo, err := p.GetVisibleToUsers(userID)
	if err != nil {
		log.Printf("PresenceFilterService: Error filtering offline event: %v", err)
		return
	}

	if len(visibleTo) == 0 {
		return
	}

	filteredEvent := PresenceEvent{
		Type:      "user_offline",
		UserID:    userID,
		VisibleTo: visibleTo,
		Filtered:  true,
		Data:      eventData,
	}

	p.nats.Publish("presence.filtered.user_offline", filteredEvent)

	log.Printf(
		"PresenceFilterService: Filtered offline event for %s visible to %d users",
		userID,
		len(visibleTo),
	)
}

func (p *PresenceFilterService) GetVisibleToUsers(userID string) ([]string, error) {
	visibleUsers := make(map[string]bool)

	contactUsers, err := p.contacts.FindUsersWhoHaveContact(userID)
	if err != nil {
		return nil, err
	}

	for _, id := range contactUsers {
		visibleUsers[id] = true
	}

	groupMembers, err := p.GetSharedGroupMembers(userID)
	if err != nil {
		return nil, err
	}

	for _, id := range groupMembers {
		visibleUsers[id] = true
	}

	delete(visibleUsers, userID)

	result := make([]string, 0, len(visibleUsers))
	for id := range visibleUsers {
		result = append(result, id)
	}

	return result, nil
}

func (p *PresenceFilterService) GetSharedGroupMembers(userID string) ([]string, error) {
	return p.groupConv.GetGroupMembersForUser(userID)
}

func (p *PresenceFilterService) CanUserSeePresence(userA, userB string) (bool, error) {
	inContacts, err := p.contacts.ContactExists(userA, userB)
	if err != nil {
		return false, err
	}

	if inContacts {
		return true, nil
	}

	sharedGroups, err := p.GetSharedGroups(userA, userB)
	if err != nil {
		return false, err
	}

	return len(sharedGroups) > 0, nil
}

func (p *PresenceFilterService) GetSharedGroups(userA, userB string) ([]string, error) {
	return p.groupConv.GetSharedGroups(userA, userB)
}

func (p *PresenceFilterService) GetFilteredPresenceStatus(
	viewerUserID string,
	userIDs []string,
) []map[string]interface{} {

	result := make([]map[string]interface{}, 0)

	for _, userID := range userIDs {
		canSee, err := p.CanUserSeePresence(viewerUserID, userID)

		if err != nil {
			result = append(result, map[string]interface{}{
				"userId": userID,
				"visible": false,
				"reason": "error",
			})
			continue
		}

		if canSee {
			result = append(result, map[string]interface{}{
				"userId": userID,
				"visible": true,
			})
		} else {
			result = append(result, map[string]interface{}{
				"userId": userID,
				"visible": false,
				"reason": "not_in_contacts_or_groups",
			})
		}
	}

	return result
}

func (p *PresenceFilterService) GetUserPrivacySettings(userID string) PrivacySettings {
	return PrivacySettings{
		ShowOnlineStatus:  true,
		ShowLastSeen:      true,
		WhoCanSeePresence: "contacts_and_groups",
		ShowTypingStatus:  true,
	}
}

func (p *PresenceFilterService) FilterPresenceByPrivacy(
	userID string,
	viewerUserID string,
	presenceData map[string]interface{},
) map[string]interface{} {

	settings := p.GetUserPrivacySettings(userID)

	if !settings.ShowOnlineStatus {
		return nil
	}

	canSee, err := p.CanUserSeePresence(viewerUserID, userID)
	if err != nil {
		return nil
	}

	if !canSee && settings.WhoCanSeePresence != "everyone" {
		return nil
	}

	filtered := make(map[string]interface{})

	for k, v := range presenceData {
		filtered[k] = v
	}

	if !settings.ShowLastSeen {
		delete(filtered, "lastSeen")
	}

	if !settings.ShowTypingStatus {
		delete(filtered, "activity")
	}

	return filtered
}