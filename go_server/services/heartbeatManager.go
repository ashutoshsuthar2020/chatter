package services

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/nats-io/nats.go"
)

type HeartbeatData struct {
	UserID    string                 `json:"userId"`
	ConnID    string                 `json:"connId"`
	Timestamp int64                  `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata"`
}

type HeartbeatManager struct {
	nc                *nats.Conn
	heartbeatInterval time.Duration

	mu        sync.Mutex
	cancelMap map[string]context.CancelFunc // connId -> cancel func
}

func NewHeartbeatManager(nc *nats.Conn) *HeartbeatManager {
	return &HeartbeatManager{
		nc:                nc,
		heartbeatInterval: 30 * time.Second,
		cancelMap:         make(map[string]context.CancelFunc),
	}
}

func (h *HeartbeatManager) StartHeartbeat(userID, connID string, metadata map[string]interface{}) {
	h.StopHeartbeat(connID)

	ctx, cancel := context.WithCancel(context.Background())

	h.mu.Lock()
	h.cancelMap[connID] = cancel
	h.mu.Unlock()

	ticker := time.NewTicker(h.heartbeatInterval)

	go func() {
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				err := h.SendHeartbeat(userID, connID, metadata)
				if err != nil {
					log.Printf("HeartbeatManager: Error sending heartbeat for %s:%s: %v",
						userID, connID, err)
					h.StopHeartbeat(connID)
					return
				}

			case <-ctx.Done():
				return
			}
		}
	}()

	log.Printf("HeartbeatManager: Started heartbeat for %s:%s", userID, connID)
}

func (h *HeartbeatManager) StopHeartbeat(connID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	cancel, exists := h.cancelMap[connID]
	if exists {
		cancel()
		delete(h.cancelMap, connID)
		log.Printf("HeartbeatManager: Stopped heartbeat for connID %s", connID)
	}
}

func (h *HeartbeatManager) SendHeartbeat(userID, connID string, metadata map[string]interface{}) error {
	if metadata == nil {
		metadata = make(map[string]interface{})
	}

	count, ok := metadata["heartbeatCount"].(int)
	if !ok {
		count = 0
	}
	metadata["heartbeatCount"] = count + 1

	data := HeartbeatData{
		UserID:    userID,
		ConnID:    connID,
		Timestamp: time.Now().UnixMilli(),
		Metadata:  metadata,
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}

	err = h.nc.Publish("presence.heartbeat", payload)
	if err != nil {
		return err
	}

	log.Printf("HeartbeatManager: Sent heartbeat for %s:%s", userID, connID)
	return nil
}

func (h *HeartbeatManager) GetActiveConnections() []string {
	h.mu.Lock()
	defer h.mu.Unlock()

	conns := make([]string, 0, len(h.cancelMap))
	for connID := range h.cancelMap {
		conns = append(conns, connID)
	}

	return conns
}

func (h *HeartbeatManager) StopAllHeartbeats() {
	h.mu.Lock()
	defer h.mu.Unlock()

	for connID, cancel := range h.cancelMap {
		cancel()
		delete(h.cancelMap, connID)
	}

	log.Println("HeartbeatManager: Stopped all heartbeats")
}