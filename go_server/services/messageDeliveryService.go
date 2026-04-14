package services
import (
	"encoding/json"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

type SocketData struct {
	SocketID string
}

type MessageData struct {
	MessageID      string      `json:"messageId"`
	ConversationID string      `json:"conversationId"`
	SenderID       string      `json:"senderId"`
	Message        string      `json:"message"`
	SequenceNumber int64       `json:"sequenceNumber"`
	Timestamp      string      `json:"timestamp"`
	IsGroup        bool        `json:"isGroup"`
	User           interface{} `json:"user,omitempty"`
}

type DeliveryResult struct {
	UserID string `json:"userId"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type SocketEmitter interface {
	EmitToSocket(socketID string, event string, payload interface{})
}

type MessageDeliveryService struct {
	io         SocketEmitter
	nc         *nats.Conn
	localUsers map[string]SocketData
	mu         sync.RWMutex
}

func NewMessageDeliveryService(io SocketEmitter, nc *nats.Conn) *MessageDeliveryService {
	s := &MessageDeliveryService{
		io:         io,
		nc:         nc,
		localUsers: make(map[string]SocketData),
	}

	s.subscribe()

	return s
}

func (s *MessageDeliveryService) subscribe() {
	_, err := s.nc.Subscribe("active_users.update", func(msg *nats.Msg) {
		var data struct {
			ActiveUsers []string `json:"activeUsers"`
			Contacts    []string `json:"contacts"`
		}

		if err := json.Unmarshal(msg.Data, &data); err != nil {
			log.Println("Failed to parse active_users.update:", err)
			return
		}

		s.HandleActiveUsersUpdate(data.ActiveUsers, data.Contacts)
	})

	if err != nil {
		log.Println("Subscription error:", err)
	}

	_, err = s.nc.Subscribe("message.send", func(msg *nats.Msg) {
		var data struct {
			UserID      string      `json:"userId"`
			MessageData MessageData `json:"messageData"`
		}

		if err := json.Unmarshal(msg.Data, &data); err != nil {
			log.Println("Failed to parse message.send:", err)
			return
		}

		s.HandleCrossServerMessage(data.UserID, data.MessageData)
	})

	if err != nil {
		log.Println("Subscription error:", err)
	}
}

func (s *MessageDeliveryService) publish(subject string, payload interface{}) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return s.nc.Publish(subject, data)
}

func (s *MessageDeliveryService) SetLocalUser(userID string, socketData SocketData, activeUsers, contacts []string) {
	s.mu.Lock()
	s.localUsers[userID] = socketData
	s.mu.Unlock()

	err := s.publish("active_users.update", map[string]interface{}{
		"activeUsers": activeUsers,
		"contacts":    contacts,
	})

	if err != nil {
		log.Println("Publish error:", err)
	}
}

func (s *MessageDeliveryService) RemoveLocalUser(userID string, activeUsers, contacts []string) {
	s.mu.Lock()
	delete(s.localUsers, userID)
	s.mu.Unlock()

	err := s.publish("active_users.update", map[string]interface{}{
		"activeUsers": activeUsers,
		"contacts":    contacts,
	})

	if err != nil {
		log.Println("Publish error:", err)
	}
}

func (s *MessageDeliveryService) GetUserLocation(userID string) (*SocketData, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	socketData, exists := s.localUsers[userID]
	if !exists {
		return nil, false
	}

	return &socketData, true
}

func (s *MessageDeliveryService) DeliverToRecipients(messageData MessageData, recipientIDs []string) []DeliveryResult {
	results := make([]DeliveryResult, 0)

	for _, userID := range recipientIDs {
		err := s.publish("message.send", map[string]interface{}{
			"userId":      userID,
			"messageData": messageData,
		})

		if err != nil {
			results = append(results, DeliveryResult{
				UserID: userID,
				Status: "error",
				Error:  err.Error(),
			})
		} else {
			results = append(results, DeliveryResult{
				UserID: userID,
				Status: "delivered_nats",
			})
		}
	}

	return results
}

func (s *MessageDeliveryService) HandleActiveUsersUpdate(activeUsers, contacts []string) {
	for _, contactID := range contacts {
		s.mu.RLock()
		session, exists := s.localUsers[contactID]
		s.mu.RUnlock()

		if exists {
			s.io.EmitToSocket(session.SocketID, "activeUsers", activeUsers)
		}
	}
}

func (s *MessageDeliveryService) HandleCrossServerMessage(userID string, messageData MessageData) {
	log.Printf("[NATS] Received message.send for userID=%s messageID=%s",
		userID, messageData.MessageID)

	s.mu.RLock()
	userSession, exists := s.localUsers[userID]
	s.mu.RUnlock()

	if !exists {
		log.Printf("[NATS] No local user found for userID=%s", userID)
		return
	}

	s.DeliverToLocalUser(userID, messageData, userSession)
}

func (s *MessageDeliveryService) DeliverToLocalUser(userID string, messageData MessageData, socketData SocketData) {
	s.io.EmitToSocket(socketData.SocketID, "getMessage", messageData)

	log.Printf("Delivered message to user=%s socket=%s",
		userID,
		socketData.SocketID)
}

func (s *MessageDeliveryService) ProcessUserQueueOnConnect(
	userID string,
	socketData SocketData,
	queuedMessages []MessageData,
) {
	sort.Slice(queuedMessages, func(i, j int) bool {
		if queuedMessages[i].ConversationID != queuedMessages[j].ConversationID {
			return queuedMessages[i].ConversationID < queuedMessages[j].ConversationID
		}

		return queuedMessages[i].SequenceNumber < queuedMessages[j].SequenceNumber
	})

	for i, msg := range queuedMessages {
		time.Sleep(time.Duration(i) * 100 * time.Millisecond)
		s.DeliverToLocalUser(userID, msg, socketData)
	}
}

func (s *MessageDeliveryService) SendConversationUpdate(
	userID string,
	conversations interface{},
) {
	s.mu.RLock()
	session, exists := s.localUsers[userID]
	s.mu.RUnlock()

	if !exists {
		return
	}

	s.io.EmitToSocket(session.SocketID, "conversationsListUpdated", map[string]interface{}{
		"conversations": conversations,
	})
}