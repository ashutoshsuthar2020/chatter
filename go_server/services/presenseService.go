package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"
)

type PresenceData struct {
	Status            string                 `json:"status"`
	LastSeen          int64                  `json:"lastSeen"`
	ActiveConnections int64                  `json:"activeConnections"`
	Metadata          map[string]interface{} `json:"metadata,omitempty"`
}

type PresenceService struct {
	redis *redis.Client
	nats  *nats.Conn

	PresenceTTL       time.Duration
	HeartbeatInterval time.Duration
}

func NewPresenceService() *PresenceService {
	return &PresenceService{
		PresenceTTL:       60 * time.Second,
		HeartbeatInterval: 30 * time.Second,
	}
}

func (p *PresenceService) Initialize(ctx context.Context) error {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis://localhost:6379"
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return err
	}

	p.redis = redis.NewClient(opt)

	if err := p.redis.Ping(ctx).Err(); err != nil {
		return err
	}

	log.Println("PresenceService: Connected to Redis")

	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	p.nats, err = nats.Connect(natsURL)
	if err != nil {
		return err
	}

	log.Println("PresenceService: Connected to NATS")

	p.subscribeToPresenceEvents(ctx)

	log.Println("PresenceService: Initialized successfully")

	return nil
}

func (p *PresenceService) subscribeToPresenceEvents(ctx context.Context) {
	p.nats.Subscribe("presence.heartbeat", func(msg *nats.Msg) {
		var data map[string]interface{}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			p.HandleHeartbeat(ctx, data)
		}
	})

	p.nats.Subscribe("presence.connect", func(msg *nats.Msg) {
		var data map[string]interface{}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			p.HandleUserConnect(ctx, data)
		}
	})

	p.nats.Subscribe("presence.disconnect", func(msg *nats.Msg) {
		var data map[string]interface{}
		if err := json.Unmarshal(msg.Data, &data); err == nil {
			p.HandleUserDisconnect(ctx, data)
		}
	})

	log.Println("PresenceService: Subscribed to presence events")
}

func (p *PresenceService) HandleUserConnect(ctx context.Context, data map[string]interface{}) {
	userID := data["userId"].(string)
	connID := data["connId"].(string)

	metadata := map[string]interface{}{}
	if m, ok := data["metadata"].(map[string]interface{}); ok {
		metadata = m
	}

	now := time.Now().UnixMilli()

	connectionKey := fmt.Sprintf("connections:%s", userID)
	presenceKey := fmt.Sprintf("presence:%s", userID)

	connData, _ := json.Marshal(map[string]interface{}{
		"connectedAt": now,
		"lastSeen":    now,
		"metadata":    metadata,
	})

	p.redis.HSet(ctx, connectionKey, connID, connData)
	p.redis.Expire(ctx, connectionKey, p.PresenceTTL)

	connectionCount := p.redis.HLen(ctx, connectionKey).Val()

	presence := PresenceData{
		Status:            "online",
		LastSeen:          now,
		ActiveConnections: connectionCount,
		Metadata:          metadata,
	}

	presenceBytes, _ := json.Marshal(presence)

	p.redis.Set(ctx, presenceKey, presenceBytes, p.PresenceTTL)

	if connectionCount == 1 {
		p.PublishPresenceEvent("user_online", map[string]interface{}{
			"userId":    userID,
			"timestamp": now,
			"metadata":  metadata,
		})
	}

	log.Printf(
		"PresenceService: User %s connected (connID=%s active=%d)",
		userID,
		connID,
		connectionCount,
	)
}

func (p *PresenceService) HandleUserDisconnect(ctx context.Context, data map[string]interface{}) {
	userID := data["userId"].(string)
	connID := data["connId"].(string)

	now := time.Now().UnixMilli()

	connectionKey := fmt.Sprintf("connections:%s", userID)
	presenceKey := fmt.Sprintf("presence:%s", userID)

	p.redis.HDel(ctx, connectionKey, connID)

	remaining := p.redis.HLen(ctx, connectionKey).Val()

	if remaining == 0 {
		presence := PresenceData{
			Status:            "offline",
			LastSeen:          now,
			ActiveConnections: 0,
		}

		bytes, _ := json.Marshal(presence)

		p.redis.Set(ctx, presenceKey, bytes, p.PresenceTTL*10)

		p.PublishPresenceEvent("user_offline", map[string]interface{}{
			"userId":    userID,
			"timestamp": now,
		})

		p.redis.Del(ctx, connectionKey)
	} else {
		presence := PresenceData{
			Status:            "online",
			LastSeen:          now,
			ActiveConnections: remaining,
		}

		bytes, _ := json.Marshal(presence)
		p.redis.Set(ctx, presenceKey, bytes, p.PresenceTTL)
	}

	log.Printf(
		"PresenceService: User %s disconnected (connID=%s remaining=%d)",
		userID,
		connID,
		remaining,
	)
}

func (p *PresenceService) HandleHeartbeat(ctx context.Context, data map[string]interface{}) {
	userID := data["userId"].(string)
	connID := data["connId"].(string)

	now := time.Now().UnixMilli()

	connectionKey := fmt.Sprintf("connections:%s", userID)
	presenceKey := fmt.Sprintf("presence:%s", userID)

	exists := p.redis.HExists(ctx, connectionKey, connID).Val()
	if !exists {
		log.Printf(
			"PresenceService: Heartbeat from unknown connection %s for user %s",
			connID,
			userID,
		)
		return
	}

	raw := p.redis.HGet(ctx, connectionKey, connID).Val()

	var connData map[string]interface{}
	json.Unmarshal([]byte(raw), &connData)

	connData["lastSeen"] = now

	updatedConnData, _ := json.Marshal(connData)

	p.redis.HSet(ctx, connectionKey, connID, updatedConnData)
	p.redis.Expire(ctx, connectionKey, p.PresenceTTL)

	rawPresence := p.redis.Get(ctx, presenceKey).Val()

	var presence PresenceData
	json.Unmarshal([]byte(rawPresence), &presence)

	presence.LastSeen = now

	updatedPresence, _ := json.Marshal(presence)

	p.redis.Set(ctx, presenceKey, updatedPresence, p.PresenceTTL)

	log.Printf(
		"PresenceService: Heartbeat from user %s connID=%s",
		userID,
		connID,
	)
}

func (p *PresenceService) PublishPresenceEvent(eventType string, data map[string]interface{}) {
	event := map[string]interface{}{
		"type": eventType,
	}

	for k, v := range data {
		event[k] = v
	}

	bytes, _ := json.Marshal(event)

	p.nats.Publish(fmt.Sprintf("presence.events.%s", eventType), bytes)
	p.nats.Publish("presence.events", bytes)
}

func (p *PresenceService) IsUserOnline(ctx context.Context, userID string) bool {
	presence, err := p.GetUserPresence(ctx, userID)
	if err != nil || presence == nil {
		return false
	}

	return presence.Status == "online" && presence.ActiveConnections > 0
}

func (p *PresenceService) GetUserPresence(
	ctx context.Context,
	userID string,
) (*PresenceData, error) {

	key := fmt.Sprintf("presence:%s", userID)

	raw, err := p.redis.Get(ctx, key).Result()
	if err != nil {
		return nil, err
	}

	var presence PresenceData
	err = json.Unmarshal([]byte(raw), &presence)

	if err != nil {
		return nil, err
	}

	return &presence, nil
}

func (p *PresenceService) Shutdown() {
	if p.nats != nil {
		p.nats.Close()
		log.Println("PresenceService: NATS closed")
	}

	if p.redis != nil {
		p.redis.Close()
		log.Println("PresenceService: Redis closed")
	}
}