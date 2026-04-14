package services

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

type QueuedMessage struct {
	ConversationID string      `json:"conversationId"`
	SenderID       string      `json:"senderId"`
	ReceiverIDs    []string    `json:"receiverIds,omitempty"`
	Message        string      `json:"message"`
	IsGroup        bool        `json:"isGroup"`
	SequenceNumber int64       `json:"sequenceNumber"`
	QueuedAt       string      `json:"queuedAt"`
	Timestamp      string      `json:"timestamp,omitempty"`
	User           interface{} `json:"user,omitempty"`
}

type MessageQueueService struct {
	nc *nats.Conn

	mu               sync.Mutex
	processingQueues map[string]bool
}

func NewMessageQueueService(nc *nats.Conn) *MessageQueueService {
	return &MessageQueueService{
		nc:               nc,
		processingQueues: make(map[string]bool),
	}
}

// QueueMessage adds message to NATS queue with ordering support
func (m *MessageQueueService) QueueMessage(messageData QueuedMessage) (int64, QueuedMessage, error) {
	sequenceNumber := time.Now().UnixMilli()

	messageData.SequenceNumber = sequenceNumber
	messageData.QueuedAt = time.Now().Format(time.RFC3339)

	payload, err := json.Marshal(messageData)
	if err != nil {
		return 0, QueuedMessage{}, err
	}

	err = m.nc.Publish("message_queue", payload)
	if err != nil {
		return 0, QueuedMessage{}, err
	}

	return sequenceNumber, messageData, nil
}

// ProcessUserQueue processes queued messages when user comes online
// NATS-based approach means no local queue
func (m *MessageQueueService) ProcessUserQueue(userID string) ([]QueuedMessage, error) {
	return []QueuedMessage{}, nil
}

// PersistQueuedMessages saves offline queued messages to MongoDB
func (m *MessageQueueService) PersistQueuedMessages(
	ctx context.Context,
	userID string,
	queuedMessages []QueuedMessage,
) (int, error) {

	if len(queuedMessages) == 0 {
		return 0, nil
	}

	// Group by conversation
	messagesByConversation := make(map[string][]QueuedMessage)

	for _, msg := range queuedMessages {
		messagesByConversation[msg.ConversationID] =
			append(messagesByConversation[msg.ConversationID], msg)
	}

	savedCount := 0

	for conversationID, messages := range messagesByConversation {
		for _, msg := range messages {
			// TODO:
			// Replace this with real MongoDB duplicate check:
			//
			// existing := messagesCollection.FindOne(...)
			//
			duplicateExists := false

			if duplicateExists {
				continue
			}

			// TODO:
			// Save message to MongoDB here
			//
			// _, err := messagesCollection.InsertOne(...)

			log.Printf(
				"Persisting queued message conversation=%s sender=%s seq=%d",
				conversationID,
				msg.SenderID,
				msg.SequenceNumber,
			)

			savedCount++

			// TODO:
			// Update conversation/group conversation lastMessage here
			if msg.IsGroup {
				log.Printf("Update GroupConversation lastMessage for %s", conversationID)
			} else {
				log.Printf("Update Conversation lastMessage for %s", conversationID)
			}
		}
	}

	return savedCount, nil
}

// CleanupOldQueues for periodic cleanup
func (m *MessageQueueService) CleanupOldQueues() {
	// No-op for NATS-based queueing
}