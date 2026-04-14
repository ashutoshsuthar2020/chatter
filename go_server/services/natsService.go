package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

type NatsService struct {
	nc          *nats.Conn
	serverID    string
	isConnected bool
	mu          sync.RWMutex
}

func NewNatsService() *NatsService {
	serverID := os.Getenv("SERVER_ID")
	if serverID == "" {
		serverID = fmt.Sprintf("server-%d", time.Now().UnixMilli())
	}

	return &NatsService{
		serverID: serverID,
	}
}

// Connect establishes NATS connection
func (n *NatsService) Connect() error {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Printf("Failed to connect to NATS: %v", err)

		n.mu.Lock()
		n.isConnected = false
		n.mu.Unlock()

		return err
	}

	n.mu.Lock()
	n.nc = nc
	n.isConnected = true
	n.mu.Unlock()

	log.Println("NATS connected successfully")
	return nil
}

// Publish sends JSON message to subject
func (n *NatsService) Publish(subject string, message interface{}) bool {
	n.mu.RLock()
	connected := n.isConnected
	nc := n.nc
	n.mu.RUnlock()

	if !connected {
		log.Printf("[NATS] Tried to publish to %s but not connected", subject)
		return false
	}

	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling NATS message: %v", err)
		return false
	}

	err = nc.Publish(subject, payload)
	if err != nil {
		log.Printf("Error publishing to NATS: %v", err)
		return false
	}

	log.Printf("[NATS] Published to subject=%s payload=%s", subject, string(payload))

	return true
}

// Subscribe listens to subject and invokes callback
func (n *NatsService) Subscribe(
	subject string,
	callback func(map[string]interface{}),
) bool {

	n.mu.RLock()
	connected := n.isConnected
	nc := n.nc
	n.mu.RUnlock()

	if !connected {
		log.Printf("[NATS] Tried to subscribe to %s but not connected", subject)
		return false
	}

	_, err := nc.Subscribe(subject, func(msg *nats.Msg) {
		log.Printf("[NATS] Received message on %s: %s",
			subject,
			string(msg.Data),
		)

		var data map[string]interface{}

		if err := json.Unmarshal(msg.Data, &data); err != nil {
			log.Printf("Error decoding NATS message: %v", err)
			return
		}

		callback(data)
	})

	if err != nil {
		log.Printf("Error subscribing to NATS: %v", err)
		return false
	}

	log.Printf("[NATS] Subscribed to subject=%s", subject)

	return true
}

// Disconnect gracefully closes NATS connection
func (n *NatsService) Disconnect() {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.nc != nil {
		n.nc.Close()
		n.isConnected = false
		log.Println("NATS disconnected")
	}
}

// IsConnected returns connection status
func (n *NatsService) IsConnected() bool {
	n.mu.RLock()
	defer n.mu.RUnlock()

	return n.isConnected
}

// ServerID returns current server ID
func (n *NatsService) ServerID() string {
	return n.serverID
}