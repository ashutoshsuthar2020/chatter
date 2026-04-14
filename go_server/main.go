package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
	"github.com/nats-io/nats.go"
	"github.com/rs/cors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"golang.org/x/crypto/bcrypt"
)

// ============================================================================
// Models
// ============================================================================

type User struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	FullName     string             `bson:"fullName" json:"fullName"`
	PhoneNumber  string             `bson:"phoneNumber" json:"phoneNumber"`
	Password     string             `bson:"password" json:"-"`
	Picture      string             `bson:"picture" json:"picture,omitempty"`
	Bio          string             `bson:"bio" json:"bio,omitempty"`
	LastActiveAt time.Time          `bson:"lastActiveAt,omitempty" json:"lastActiveAt,omitempty"`
	CreatedAt    time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt    time.Time          `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

type Conversation struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Members     []string           `bson:"members" json:"members"`
	LastMessage *LastMessage       `bson:"lastMessage,omitempty" json:"lastMessage,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt   time.Time          `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

type LastMessage struct {
	Message        string    `bson:"message" json:"message"`
	Sender         string    `bson:"sender" json:"sender"`
	Timestamp      time.Time `bson:"timestamp" json:"timestamp"`
	SequenceNumber int64     `bson:"sequenceNumber,omitempty" json:"sequenceNumber,omitempty"`
}

type Group struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	Name           string             `bson:"name" json:"name"`
	Description    string             `bson:"description" json:"description,omitempty"`
	ProfilePicture string             `bson:"profilePicture" json:"profilePicture,omitempty"`
	CreatedBy      string             `bson:"createdBy" json:"createdBy"`
	Members        []GroupMember      `bson:"members" json:"members"`
	MaxMembers     int                `bson:"maxMembers" json:"maxMembers,omitempty"`
	LastMessage    *LastMessage       `bson:"lastMessage,omitempty" json:"lastMessage,omitempty"`
	CreatedAt      time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt      time.Time          `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

type GroupMember struct {
	User string `bson:"user" json:"user"`
	Role string `bson:"role" json:"role"`
}

type GroupConversation struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	GroupID     primitive.ObjectID `bson:"groupId" json:"groupId"`
	Members     []string           `bson:"members" json:"members"`
	LastMessage *LastMessage       `bson:"lastMessage,omitempty" json:"lastMessage,omitempty"`
	CreatedAt   time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt   time.Time          `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

type Message struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	ConversationID string             `bson:"conversationId" json:"conversationId"`
	SenderID       string             `bson:"senderId" json:"senderId"`
	Message        string             `bson:"message" json:"message"`
	SequenceNumber int64              `bson:"sequenceNumber,omitempty" json:"sequenceNumber,omitempty"`
	CreatedAt      time.Time          `bson:"createdAt,omitempty" json:"createdAt,omitempty"`
	UpdatedAt      time.Time          `bson:"updatedAt,omitempty" json:"updatedAt,omitempty"`
}

type Contact struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID             string             `bson:"userId" json:"userId"`
	ContactUserID      primitive.ObjectID `bson:"contactUserId" json:"contactUserId"`
	ContactPhoneNumber string             `bson:"contactPhoneNumber" json:"contactPhoneNumber"`
	ContactName        string             `bson:"contactName" json:"contactName"`
	IsBlocked          bool               `bson:"isBlocked" json:"isBlocked"`
	AddedAt            time.Time          `bson:"addedAt,omitempty" json:"addedAt,omitempty"`
}

type ReadReceipt struct {
	ID                primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID            string             `bson:"userId" json:"userId"`
	ConversationID    string             `bson:"conversationId" json:"conversationId"`
	LastSeenMessageID string             `bson:"lastSeenMessageId" json:"lastSeenMessageId"`
	LastSeenAt        time.Time          `bson:"lastSeenAt,omitempty" json:"lastSeenAt,omitempty"`
	IsGroup           bool               `bson:"isGroup" json:"isGroup"`
}

// ============================================================================
// Request / Response DTOs
// ============================================================================

type LoginRequest struct {
	PhoneNumber string `json:"phoneNumber"`
	Password    string `json:"password"`
}

type RegisterRequest struct {
	FullName    string `json:"fullName"`
	PhoneNumber string `json:"phoneNumber"`
	Password    string `json:"password"`
	Picture     string `json:"picture,omitempty"`
}

type CreateConversationRequest struct {
	SenderID   string `json:"senderId"`
	ReceiverID string `json:"receiverId"`
}

type SendMessageRequest struct {
	ConversationID string `json:"conversationId"`
	SenderID       string `json:"senderId"`
	Message        string `json:"message"`
	ReceiverID     string `json:"receiverId,omitempty"`
	IsGroup        bool   `json:"isGroup,omitempty"`
}

type AddContactRequest struct {
	UserID             string `json:"userId"`
	ContactPhoneNumber string `json:"contactPhoneNumber"`
}

type RemoveContactRequest struct {
	UserID string `json:"userId"`
}

type MarkReadRequest struct {
	UserID            string `json:"userId"`
	IsGroup           bool   `json:"isGroup,omitempty"`
	LastSeenMessageID string `json:"lastSeenMessageId,omitempty"`
}

type CreateGroupRequest struct {
	Name           string   `json:"name"`
	Description    string   `json:"description,omitempty"`
	ProfilePicture string   `json:"profilePicture,omitempty"`
	CreatedBy      string   `json:"createdBy"`
	Members        []string `json:"members,omitempty"`
}

type AddGroupMemberRequest struct {
	UserID  string `json:"userId"`
	AdminID string `json:"adminId"`
}

type RemoveGroupMemberRequest struct {
	AdminID string `json:"adminId"`
}

type UpdateGroupRequest struct {
	Name           string `json:"name,omitempty"`
	Description    string `json:"description,omitempty"`
	ProfilePicture string `json:"profilePicture,omitempty"`
	AdminID        string `json:"adminId"`
}

type UpdateUserRequest struct {
	FullName string `json:"fullName,omitempty"`
	Bio      string `json:"bio,omitempty"`
	Picture  string `json:"picture,omitempty"`
}

type SyncMessageRequest struct {
	ConversationID string `json:"conversationId"`
	SenderID       string `json:"senderId"`
	Message        string `json:"message"`
	Timestamp      string `json:"timestamp,omitempty"`
	SequenceNumber int64  `json:"sequenceNumber,omitempty"`
	LocalMessageID string `json:"localMessageId,omitempty"`
}

type SyncUpdateRequest struct {
	ConversationID string                 `json:"conversationId"`
	Updates        map[string]interface{} `json:"updates"`
}

type SyncDeleteRequest struct {
	ConversationID string `json:"conversationId"`
}

type DeleteConversationRequest struct {
	UserID string `json:"userId"`
}

// ============================================================================
// WebSocket types
// ============================================================================

type ActiveUser struct {
	UserID   string `json:"userId"`
	SocketID string `json:"socketId"`
}

type WSMessage struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

type SendWSMessage struct {
	SenderID       string `json:"senderId"`
	ReceiverID     string `json:"receiverId"`
	Message        string `json:"message"`
	ConversationID string `json:"conversationId"`
	IsGroup        bool   `json:"isGroup"`
}

type MessagePayload struct {
	MessageID      string      `json:"messageId"`
	SenderID       string      `json:"senderId"`
	Message        string      `json:"message"`
	ConversationID string      `json:"conversationId"`
	ReceiverID     string      `json:"receiverId"`
	IsGroup        bool        `json:"isGroup"`
	User           MessageUser `json:"user"`
}

type MessageUser struct {
	ID          string `json:"id"`
	FullName    string `json:"fullName"`
	PhoneNumber string `json:"phoneNumber"`
}

type ConversationData struct {
	User           *ConvUser    `json:"user,omitempty"`
	ConversationID string       `json:"conversationId"`
	IsGroup        bool         `json:"isGroup"`
	Group          *ConvGroup   `json:"group,omitempty"`
	LastMessage    *LastMessage `json:"lastMessage,omitempty"`
	UnreadCount    int64        `json:"unreadCount,omitempty"`
}

type ConvUser struct {
	ReceiverID string `json:"receiverId"`
	FullName   string `json:"fullName"`
}

type ConvGroup struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	ProfilePicture string `json:"profilePicture,omitempty"`
	MemberCount    int    `json:"memberCount"`
}

// ============================================================================
// App (holds all state and dependencies)
// ============================================================================

type App struct {
	Router    *mux.Router
	DB        *mongo.Database
	Hub       *Hub
	NATSSvc   *NATSService

	Users             *mongo.Collection
	Conversations     *mongo.Collection
	GroupConversations *mongo.Collection
	Groups            *mongo.Collection
	Messages          *mongo.Collection
	Contacts          *mongo.Collection
	ReadReceipts      *mongo.Collection
}

// ============================================================================
// NATS Service
// ============================================================================

type NATSService struct {
	nc   *nats.Conn
	subs []*nats.Subscription
	mu   sync.Mutex
}

func NewNATSService(url string) (*NATSService, error) {
	nc, err := nats.Connect(url,
		nats.ReconnectWait(2),
		nats.MaxReconnects(-1),
		nats.DisconnectErrHandler(func(nc *nats.Conn, err error) {
			log.Printf("[NATS] Disconnected: %v", err)
		}),
		nats.ReconnectHandler(func(nc *nats.Conn) {
			log.Printf("[NATS] Reconnected to %s", nc.ConnectedUrl())
		}),
		nats.ClosedHandler(func(nc *nats.Conn) {
			log.Println("[NATS] Connection closed")
		}),
	)
	if err != nil {
		return nil, err
	}
	return &NATSService{nc: nc}, nil
}

func (s *NATSService) Publish(subject string, data interface{}) error {
	if s == nil || s.nc == nil {
		return nil
	}
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	return s.nc.Publish(subject, b)
}

func (s *NATSService) Subscribe(subject string, handler func(data []byte)) error {
	if s == nil || s.nc == nil {
		return nil
	}
	sub, err := s.nc.Subscribe(subject, func(msg *nats.Msg) {
		handler(msg.Data)
	})
	if err != nil {
		return err
	}
	s.mu.Lock()
	s.subs = append(s.subs, sub)
	s.mu.Unlock()
	return nil
}

func (s *NATSService) Close() {
	if s == nil || s.nc == nil {
		return
	}
	s.nc.Drain()
	s.nc.Close()
}

// ============================================================================
// WebSocket Hub & Client
// ============================================================================

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins; restrict in production
	},
}

type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	UserID   string
	SocketID string
	ConnID   string
}

type Hub struct {
	App               *App
	Clients           map[*Client]bool
	UserClients       map[string]*Client
	Register          chan *Client
	Unregister        chan *Client
	GlobalActiveUsers []ActiveUser
	mu                sync.RWMutex
}

func NewHub(app *App) *Hub {
	return &Hub{
		App:               app,
		Clients:           make(map[*Client]bool),
		UserClients:       make(map[string]*Client),
		Register:          make(chan *Client),
		Unregister:        make(chan *Client),
		GlobalActiveUsers: make([]ActiveUser, 0),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client] = true
			if client.UserID != "" {
				h.UserClients[client.UserID] = client
			}
			h.mu.Unlock()
			log.Printf("[HUB] Client registered: socketID=%s userID=%s", client.SocketID, client.UserID)

		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				if client.UserID != "" {
					delete(h.UserClients, client.UserID)
				}
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("[HUB] Client unregistered: socketID=%s userID=%s", client.SocketID, client.UserID)
		}
	}
}

func (h *Hub) SendToUser(userID string, event string, data interface{}) {
	h.mu.RLock()
	client, ok := h.UserClients[userID]
	h.mu.RUnlock()
	if !ok || client == nil {
		return
	}
	msg := WSMessage{Event: event, Data: data}
	b, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[HUB] Error marshaling message for user %s: %v", userID, err)
		return
	}
	select {
	case client.Send <- b:
		log.Printf("[HUB] Sent event '%s' to user %s", event, userID)
	default:
		log.Printf("[HUB] Send buffer full for user %s, dropping message", userID)
	}
}

func (h *Hub) BroadcastEvent(event string, data interface{}) {
	msg := WSMessage{Event: event, Data: data}
	b, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[HUB] Error marshaling broadcast: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for client := range h.Clients {
		select {
		case client.Send <- b:
		default:
		}
	}
}

func (h *Hub) GetActiveUsersList() []ActiveUser {
	h.mu.RLock()
	defer h.mu.RUnlock()
	users := make([]ActiveUser, 0, len(h.UserClients))
	for userID, client := range h.UserClients {
		users = append(users, ActiveUser{UserID: userID, SocketID: client.SocketID})
	}
	return users
}

func (app *App) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error: %v", err)
		return
	}
	socketID := generateSocketID()
	client := &Client{
		Hub:      app.Hub,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		SocketID: socketID,
	}
	app.Hub.Register <- client
	go client.writePump()
	go client.readPump(app)
}

func (c *Client) readPump(app *App) {
	defer func() {
		c.handleDisconnect(app)
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS] Read error: %v", err)
			}
			break
		}
		var wsMsg WSMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("[WS] Error parsing message: %v", err)
			continue
		}
		c.handleEvent(app, wsMsg)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) handleEvent(app *App, msg WSMessage) {
	switch msg.Event {
	case "addUser":
		c.handleAddUser(app, msg.Data)
	case "sendMessage":
		c.handleSendMessage(app, msg.Data)
	case "presence:heartbeat":
		c.handleHeartbeat(app, msg.Data)
	default:
		log.Printf("[WS] Unknown event: %s", msg.Event)
	}
}

func (c *Client) handleAddUser(app *App, data interface{}) {
	dataBytes, _ := json.Marshal(data)
	var payload struct {
		UserID string `json:"userId"`
	}
	if err := json.Unmarshal(dataBytes, &payload); err != nil || payload.UserID == "" {
		var userID string
		if err := json.Unmarshal(dataBytes, &userID); err != nil {
			log.Printf("[WS] Invalid addUser payload: %s", string(dataBytes))
			return
		}
		payload.UserID = userID
	}

	c.UserID = payload.UserID
	c.ConnID = c.SocketID + "_" + time.Now().Format("20060102150405")

	app.Hub.mu.Lock()
	app.Hub.UserClients[payload.UserID] = c
	app.Hub.mu.Unlock()

	log.Printf("[WS] addUser: userId=%s socketId=%s", payload.UserID, c.SocketID)

	// Emit current active users to this client
	app.Hub.SendToUser(payload.UserID, "activeUsers", app.Hub.GlobalActiveUsers)

	// Publish presence via NATS
	if app.NATSSvc != nil {
		app.NATSSvc.Publish("presence.connect", map[string]interface{}{
			"userId": payload.UserID,
			"connId": c.ConnID,
			"metadata": map[string]interface{}{
				"device":      "web",
				"socketId":    c.SocketID,
				"connectedAt": time.Now().UnixMilli(),
			},
		})
		activeUsers := app.Hub.GetActiveUsersList()
		merged := mergeActiveUsers(app.Hub.GlobalActiveUsers, activeUsers)
		app.NATSSvc.Publish("active_users.global", map[string]interface{}{"activeUsers": merged})
	}

	app.notifyContactsOnline(payload.UserID)
	go app.establishExistingConnections(payload.UserID, c.SocketID)
}

func (c *Client) handleSendMessage(app *App, data interface{}) {
	dataBytes, _ := json.Marshal(data)
	var msg SendWSMessage
	if err := json.Unmarshal(dataBytes, &msg); err != nil {
		log.Printf("[WS] Invalid sendMessage payload: %v", err)
		return
	}
	log.Printf("[WS] sendMessage: sender=%s receiver=%s conv=%s isGroup=%v",
		msg.SenderID, msg.ReceiverID, msg.ConversationID, msg.IsGroup)
	req := SendMessageRequest{
		ConversationID: msg.ConversationID,
		SenderID:       msg.SenderID,
		Message:        msg.Message,
		ReceiverID:     msg.ReceiverID,
		IsGroup:        msg.IsGroup,
	}
	go app.processWebSocketMessage(req)
}

func (c *Client) handleHeartbeat(app *App, data interface{}) {
	if app.NATSSvc == nil {
		return
	}
	dataBytes, _ := json.Marshal(data)
	var payload struct {
		UserID string `json:"userId"`
		ConnID string `json:"connId"`
	}
	if err := json.Unmarshal(dataBytes, &payload); err != nil {
		return
	}
	if payload.UserID != "" && payload.ConnID != "" {
		app.NATSSvc.Publish("presence.heartbeat", payload)
		log.Printf("[WS] Heartbeat from %s:%s", payload.UserID, payload.ConnID)
	}
}

func (c *Client) handleDisconnect(app *App) {
	if c.UserID == "" {
		return
	}
	log.Printf("[WS] User %s disconnected, connId: %s", c.UserID, c.ConnID)

	if app.NATSSvc != nil {
		app.NATSSvc.Publish("presence.disconnect", map[string]interface{}{
			"userId":    c.UserID,
			"connId":    c.ConnID,
			"timestamp": time.Now().UnixMilli(),
			"reason":    "client_disconnect",
		})
		activeUsers := app.Hub.GetActiveUsersList()
		filtered := make([]ActiveUser, 0)
		for _, u := range activeUsers {
			if u.UserID != c.UserID {
				filtered = append(filtered, u)
			}
		}
		merged := mergeActiveUsers(app.Hub.GlobalActiveUsers, filtered)
		merged = filterActiveUsers(merged, c.UserID)
		app.NATSSvc.Publish("active_users.global", map[string]interface{}{"activeUsers": merged})
	}

	app.notifyContactsOffline(c.UserID)
}

// ============================================================================
// main()
// ============================================================================

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	port := envOr("PORT", "8000")
	mongoURI := envOr("MONGODB_URI", "mongodb://localhost:27017")
	dbName := envOr("DB_NAME", "chatapp")
	natsURL := envOr("NATS_URL", "nats://localhost:4222")

	// Connect to MongoDB
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}
	log.Println("Connected to MongoDB")

	db := client.Database(dbName)

	app := &App{
		DB:                db,
		Users:             db.Collection("users"),
		Conversations:     db.Collection("conversations"),
		GroupConversations: db.Collection("groupconversations"),
		Groups:            db.Collection("groups"),
		Messages:          db.Collection("messages"),
		Contacts:          db.Collection("contacts"),
		ReadReceipts:      db.Collection("readreceipts"),
	}

	// Initialize WebSocket hub
	app.Hub = NewHub(app)
	go app.Hub.Run()

	// Initialize NATS service
	app.NATSSvc, err = NewNATSService(natsURL)
	if err != nil {
		log.Printf("WARNING: Failed to connect to NATS: %v — running in single-server mode", err)
	} else {
		log.Println("Connected to NATS")
		app.setupNATSSubscriptions()
	}

	// Setup routes
	app.Router = mux.NewRouter()
	app.setupRoutes()

	// Configure CORS
	isDev := os.Getenv("NODE_ENV") != "production"
	corsHandler := cors.New(cors.Options{
		AllowOriginFunc: func(origin string) bool {
			if origin == "" {
				return true
			}
			if isDev {
				return true
			}
			for _, o := range []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:3000"} {
				if o == origin {
					return true
				}
			}
			return false
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Requested-With", "Accept", "Accept-Language"},
		AllowCredentials: true,
	})

	handler := loggingMiddleware(corsHandler.Handler(app.Router))

	server := &http.Server{
		Addr:         "0.0.0.0:" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("HTTP and WebSocket server listening on port: %s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

// ============================================================================
// Routes
// ============================================================================

func (app *App) setupRoutes() {
	r := app.Router

	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("Hello")) }).Methods("GET")
	r.HandleFunc("/ws", app.HandleWebSocket).Methods("GET")

	r.HandleFunc("/api/active-users", app.HandleGetActiveUsers).Methods("GET")
	r.HandleFunc("/api/login", app.HandleLogin).Methods("POST")
	r.HandleFunc("/api/register", app.HandleRegister).Methods("POST")

	r.HandleFunc("/api/conversations", app.HandleCreateConversation).Methods("POST")
	r.HandleFunc("/api/conversations/{userId}", app.HandleGetConversations).Methods("GET")
	r.HandleFunc("/api/conversations/{conversationId}", app.HandleDeleteConversation).Methods("DELETE")

	r.HandleFunc("/api/message", app.HandleSendMessage).Methods("POST")
	r.HandleFunc("/api/message/{conversationId}", app.HandleGetMessages).Methods("GET")

	r.HandleFunc("/api/conversations/{conversationId}/read-receipt/{userId}", app.HandleGetReadReceipt).Methods("GET")
	r.HandleFunc("/api/conversations/{conversationId}/mark-read", app.HandleMarkRead).Methods("POST")

	r.HandleFunc("/api/contacts/{userId}", app.HandleGetContacts).Methods("GET")
	r.HandleFunc("/api/contacts", app.HandleAddContact).Methods("POST")
	r.HandleFunc("/api/contacts/{contactId}", app.HandleRemoveContact).Methods("DELETE")

	r.HandleFunc("/api/users/{userId}", app.HandleGetUsers).Methods("GET")
	r.HandleFunc("/api/users/{userId}", app.HandleUpdateUser).Methods("PUT")

	r.HandleFunc("/api/groups", app.HandleCreateGroup).Methods("POST")
	r.HandleFunc("/api/groups/{userId}", app.HandleGetGroups).Methods("GET")
	r.HandleFunc("/api/groups/{groupId}", app.HandleUpdateGroup).Methods("PUT")
	r.HandleFunc("/api/groups/{groupId}/members", app.HandleAddGroupMember).Methods("POST")
	r.HandleFunc("/api/groups/{groupId}/members/{userId}", app.HandleRemoveGroupMember).Methods("DELETE")

	r.HandleFunc("/api/message/sync", app.HandleSyncMessage).Methods("POST")
	r.HandleFunc("/api/message/{messageId}/sync", app.HandleSyncUpdateMessage).Methods("PUT")
	r.HandleFunc("/api/message/{messageId}/sync", app.HandleSyncDeleteMessage).Methods("DELETE")
	r.HandleFunc("/api/sync/config", app.HandleSyncConfig).Methods("GET")
}

// ============================================================================
// NATS Subscriptions
// ============================================================================

func (app *App) setupNATSSubscriptions() {
	if app.NATSSvc == nil {
		return
	}

	app.NATSSvc.Subscribe("active_users.global", func(data []byte) {
		var payload struct {
			ActiveUsers []ActiveUser `json:"activeUsers"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			log.Printf("Error unmarshaling active_users.global: %v", err)
			return
		}
		app.Hub.mu.Lock()
		app.Hub.GlobalActiveUsers = payload.ActiveUsers
		app.Hub.mu.Unlock()
		log.Printf("[NATS] Updated globalActiveUsers: %d users", len(payload.ActiveUsers))
		app.Hub.BroadcastEvent("activeUsers", payload.ActiveUsers)
	})

	app.NATSSvc.Subscribe("presence.events.user_online", func(data []byte) {
		var payload struct {
			UserID string `json:"userId"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		log.Printf("[NATS] User online event: %s", payload.UserID)
		app.Hub.mu.Lock()
		found := false
		for _, u := range app.Hub.GlobalActiveUsers {
			if u.UserID == payload.UserID {
				found = true
				break
			}
		}
		if !found {
			app.Hub.GlobalActiveUsers = append(app.Hub.GlobalActiveUsers, ActiveUser{UserID: payload.UserID})
		}
		app.Hub.mu.Unlock()
	})

	app.NATSSvc.Subscribe("presence.events.user_offline", func(data []byte) {
		var payload struct {
			UserID string `json:"userId"`
		}
		if err := json.Unmarshal(data, &payload); err != nil {
			return
		}
		log.Printf("[NATS] User offline event: %s", payload.UserID)
		app.Hub.mu.Lock()
		filtered := make([]ActiveUser, 0, len(app.Hub.GlobalActiveUsers))
		for _, u := range app.Hub.GlobalActiveUsers {
			if u.UserID != payload.UserID {
				filtered = append(filtered, u)
			}
		}
		app.Hub.GlobalActiveUsers = filtered
		app.Hub.mu.Unlock()
	})

	app.NATSSvc.Subscribe("socket_events", func(data []byte) {
		log.Printf("[NATS] Cross-server socket event received")
	})

	log.Println("NATS subscriptions initialized")

	// Periodic queue cleanup every 30 minutes
	go func() {
		ticker := time.NewTicker(30 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			log.Println("Performing periodic queue cleanup")
		}
	}()
}

// ============================================================================
// HTTP Handlers — Auth
// ============================================================================

func (app *App) HandleLogin(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.PhoneNumber == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Phone number and password are required")
		return
	}

	ctx := context.Background()
	var user User
	err := app.Users.FindOne(ctx, bson.M{"phoneNumber": req.PhoneNumber}).Decode(&user)
	if err == mongo.ErrNoDocuments {
		respondError(w, http.StatusNotFound, "User not found. Please register first.")
		return
	} else if err != nil {
		log.Printf("Login Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Server error during login")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		respondError(w, http.StatusUnauthorized, "Invalid password")
		return
	}

	app.Users.UpdateOne(ctx, bson.M{"_id": user.ID}, bson.M{"$set": bson.M{"lastActiveAt": time.Now()}})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"user": map[string]interface{}{
			"id": user.ID.Hex(), "phoneNumber": user.PhoneNumber,
			"fullName": user.FullName, "picture": user.Picture, "bio": user.Bio,
		},
	})
}

func (app *App) HandleRegister(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.FullName == "" || req.PhoneNumber == "" || req.Password == "" {
		respondError(w, http.StatusBadRequest, "Full name, phone number, and password are required")
		return
	}

	ctx := context.Background()
	var existing User
	err := app.Users.FindOne(ctx, bson.M{"phoneNumber": req.PhoneNumber}).Decode(&existing)
	if err == nil {
		respondError(w, http.StatusBadRequest, "User already exists with this phone number")
		return
	} else if err != mongo.ErrNoDocuments {
		log.Printf("Register Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Server error during registration")
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Server error during registration")
		return
	}

	newUser := User{
		FullName: req.FullName, PhoneNumber: req.PhoneNumber,
		Password: string(hashedPassword), Picture: req.Picture,
		CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	result, err := app.Users.InsertOne(ctx, newUser)
	if err != nil {
		log.Printf("Register Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Server error during registration")
		return
	}
	newUser.ID = result.InsertedID.(primitive.ObjectID)

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"user": map[string]interface{}{
			"id": newUser.ID.Hex(), "phoneNumber": newUser.PhoneNumber,
			"fullName": newUser.FullName, "picture": newUser.Picture, "bio": newUser.Bio,
		},
	})
}

// ============================================================================
// HTTP Handlers — Conversations
// ============================================================================

func (app *App) HandleCreateConversation(w http.ResponseWriter, r *http.Request) {
	var req CreateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := context.Background()
	var existing Conversation
	err := app.Conversations.FindOne(ctx, bson.M{
		"members": bson.M{"$all": bson.A{req.SenderID, req.ReceiverID}},
	}).Decode(&existing)
	if err == nil {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"message": "Conversation already exists", "conversationId": existing.ID.Hex(),
		})
		return
	}

	newConv := Conversation{Members: []string{req.SenderID, req.ReceiverID}, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	result, err := app.Conversations.InsertOne(ctx, newConv)
	if err != nil {
		log.Printf("Create Conversation Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create conversation")
		return
	}
	convID := result.InsertedID.(primitive.ObjectID).Hex()

	app.Hub.SendToUser(req.SenderID, "conversationCreated", map[string]interface{}{"conversationId": convID, "with": req.ReceiverID, "isGroup": false})
	app.Hub.SendToUser(req.ReceiverID, "conversationCreated", map[string]interface{}{"conversationId": convID, "with": req.SenderID, "isGroup": false})
	app.sendUpdatedConversations(req.SenderID, "conversationCreated", convID)
	app.sendUpdatedConversations(req.ReceiverID, "conversationCreated", convID)

	respondJSON(w, http.StatusOK, map[string]interface{}{"message": "Conversation created successfully", "conversationId": convID})
}

func (app *App) HandleGetConversations(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["userId"]
	ctx := context.Background()
	conversations, err := app.getUpdatedConversations(ctx, userID)
	if err != nil {
		log.Printf("Fetch Conversations Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to fetch conversations")
		return
	}
	respondJSON(w, http.StatusOK, conversations)
}

func (app *App) HandleDeleteConversation(w http.ResponseWriter, r *http.Request) {
	conversationID := mux.Vars(r)["conversationId"]
	var req DeleteConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	ctx := context.Background()
	objID, err := primitive.ObjectIDFromHex(conversationID)
	if err != nil {
		respondError(w, http.StatusBadRequest, "Invalid conversation ID")
		return
	}
	var conv Conversation
	err = app.Conversations.FindOne(ctx, bson.M{"_id": objID, "members": bson.M{"$in": bson.A{req.UserID}}}).Decode(&conv)
	if err != nil {
		respondError(w, http.StatusNotFound, "Conversation not found or access denied")
		return
	}
	app.Messages.DeleteMany(ctx, bson.M{"conversationId": conversationID})
	app.Conversations.DeleteOne(ctx, bson.M{"_id": objID})
	respondJSON(w, http.StatusOK, map[string]string{"message": "Conversation and all messages deleted successfully"})
}

// ============================================================================
// HTTP Handlers — Messages
// ============================================================================

func (app *App) HandleSendMessage(w http.ResponseWriter, r *http.Request) {
	var req SendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.SenderID == "" || req.Message == "" {
		respondError(w, http.StatusBadRequest, "Please fill all required fields.")
		return
	}

	ctx := context.Background()
	conversationID := req.ConversationID

	// Handle new conversation
	if conversationID == "new" && req.ReceiverID != "" && !req.IsGroup {
		convID, msgID, err := app.handleNewConversationMessage(ctx, req)
		if err != nil {
			log.Printf("Send Message Error: %v", err)
			respondError(w, http.StatusInternalServerError, "Failed to send message")
			return
		}
		respondJSON(w, http.StatusOK, map[string]interface{}{"message": "Message sent successfully", "messageId": msgID, "conversationId": convID})
		return
	}

	if conversationID == "" && req.ReceiverID == "" && !req.IsGroup {
		respondError(w, http.StatusBadRequest, "Please fill all required fields.")
		return
	}

	// Save message
	newMsg := Message{ConversationID: conversationID, SenderID: req.SenderID, Message: req.Message, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	result, err := app.Messages.InsertOne(ctx, newMsg)
	if err != nil {
		log.Printf("Send Message Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to send message")
		return
	}
	newMsg.ID = result.InsertedID.(primitive.ObjectID)

	now := time.Now()
	lastMsg := bson.M{"lastMessage.message": req.Message, "lastMessage.sender": req.SenderID, "lastMessage.timestamp": now}

	sender, _ := app.findUserByID(ctx, req.SenderID)
	msgPayload := MessagePayload{
		MessageID: newMsg.ID.Hex(), SenderID: req.SenderID, Message: req.Message,
		ConversationID: conversationID, ReceiverID: req.ReceiverID, IsGroup: req.IsGroup,
	}
	if sender != nil {
		msgPayload.User = MessageUser{ID: sender.ID.Hex(), FullName: sender.FullName, PhoneNumber: sender.PhoneNumber}
	}

	if req.IsGroup {
		convObjID, _ := primitive.ObjectIDFromHex(conversationID)
		app.GroupConversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": lastMsg})

		var groupConv GroupConversation
		if err := app.GroupConversations.FindOne(ctx, bson.M{"_id": convObjID}).Decode(&groupConv); err == nil {
			app.Groups.UpdateOne(ctx, bson.M{"_id": groupConv.GroupID}, bson.M{"$set": lastMsg})
		}

		var gc GroupConversation
		if err := app.GroupConversations.FindOne(ctx, bson.M{"_id": convObjID}).Decode(&gc); err == nil {
			for _, memberID := range gc.Members {
				if memberID != req.SenderID {
					app.autoAddContact(ctx, memberID, req.SenderID)
					app.autoAddContact(ctx, req.SenderID, memberID)
				}
			}
			for _, memberID := range gc.Members {
				app.Hub.SendToUser(memberID, "getMessage", msgPayload)
				app.sendUpdatedConversations(memberID, "messageReceived", conversationID)
			}
		}
	} else {
		convObjID, _ := primitive.ObjectIDFromHex(conversationID)
		app.Conversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": lastMsg})

		app.autoAddContact(ctx, req.ReceiverID, req.SenderID)
		app.autoAddContact(ctx, req.SenderID, req.ReceiverID)

		app.Hub.SendToUser(req.SenderID, "getMessage", msgPayload)
		app.Hub.SendToUser(req.SenderID, "conversationUpdated", map[string]interface{}{
			"conversationId": conversationID,
			"lastMessage":    map[string]interface{}{"message": req.Message, "sender": req.SenderID, "timestamp": now},
		})
		app.sendUpdatedConversations(req.SenderID, "messageSent", conversationID)

		app.Hub.SendToUser(req.ReceiverID, "getMessage", msgPayload)
		app.Hub.SendToUser(req.ReceiverID, "conversationConnectionEstablished", map[string]interface{}{
			"conversationId": conversationID, "with": req.SenderID, "isGroup": false,
		})
		app.Hub.SendToUser(req.ReceiverID, "messageReceived", map[string]interface{}{
			"senderId": req.SenderID, "senderName": msgPayload.User.FullName,
			"message": req.Message, "conversationId": conversationID, "isGroup": false,
		})
		app.Hub.SendToUser(req.ReceiverID, "conversationUpdated", map[string]interface{}{
			"conversationId": conversationID,
			"lastMessage":    map[string]interface{}{"message": req.Message, "sender": req.SenderID, "timestamp": now},
		})
		app.sendUpdatedConversations(req.ReceiverID, "messageReceived", conversationID)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"message": "Message sent successfully", "messageId": newMsg.ID.Hex(), "conversationId": conversationID})
}

func (app *App) handleNewConversationMessage(ctx context.Context, req SendMessageRequest) (string, string, error) {
	var conv Conversation
	err := app.Conversations.FindOne(ctx, bson.M{"members": bson.M{"$all": bson.A{req.SenderID, req.ReceiverID}}}).Decode(&conv)

	var targetConvID string
	isNewConversation := false

	if err == mongo.ErrNoDocuments {
		newConv := Conversation{Members: []string{req.SenderID, req.ReceiverID}, CreatedAt: time.Now(), UpdatedAt: time.Now()}
		result, err := app.Conversations.InsertOne(ctx, newConv)
		if err != nil {
			return "", "", err
		}
		targetConvID = result.InsertedID.(primitive.ObjectID).Hex()
		isNewConversation = true
		log.Printf("Created new conversation between %s and %s: %s", req.SenderID, req.ReceiverID, targetConvID)
		app.Hub.SendToUser(req.SenderID, "conversationCreated", map[string]interface{}{"conversationId": targetConvID, "with": req.ReceiverID, "isGroup": false})
		app.Hub.SendToUser(req.ReceiverID, "conversationCreated", map[string]interface{}{"conversationId": targetConvID, "with": req.SenderID, "isGroup": false})
	} else if err != nil {
		return "", "", err
	} else {
		targetConvID = conv.ID.Hex()
	}

	newMsg := Message{ConversationID: targetConvID, SenderID: req.SenderID, Message: req.Message, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	result, err := app.Messages.InsertOne(ctx, newMsg)
	if err != nil {
		return "", "", err
	}
	newMsg.ID = result.InsertedID.(primitive.ObjectID)

	convObjID, _ := primitive.ObjectIDFromHex(targetConvID)
	now := time.Now()
	app.Conversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": bson.M{
		"lastMessage.message": req.Message, "lastMessage.sender": req.SenderID, "lastMessage.timestamp": now,
	}})

	app.autoAddContact(ctx, req.ReceiverID, req.SenderID)
	app.autoAddContact(ctx, req.SenderID, req.ReceiverID)

	sender, _ := app.findUserByID(ctx, req.SenderID)
	msgPayload := MessagePayload{
		MessageID: newMsg.ID.Hex(), SenderID: req.SenderID, Message: req.Message,
		ConversationID: targetConvID, ReceiverID: req.ReceiverID, IsGroup: false,
	}
	if sender != nil {
		msgPayload.User = MessageUser{ID: sender.ID.Hex(), FullName: sender.FullName, PhoneNumber: sender.PhoneNumber}
	}

	app.Hub.SendToUser(req.SenderID, "getMessage", msgPayload)
	app.Hub.SendToUser(req.SenderID, "conversationUpdated", map[string]interface{}{
		"conversationId": targetConvID, "lastMessage": map[string]interface{}{"message": req.Message, "sender": req.SenderID, "timestamp": now},
	})
	app.sendUpdatedConversations(req.SenderID, "messageSent", targetConvID)

	app.Hub.SendToUser(req.ReceiverID, "getMessage", msgPayload)
	if isNewConversation {
		app.Hub.SendToUser(req.ReceiverID, "conversationCreated", map[string]interface{}{"conversationId": targetConvID, "with": req.SenderID, "isGroup": false})
	}
	app.Hub.SendToUser(req.ReceiverID, "newContactMessage", map[string]interface{}{
		"senderId": req.SenderID, "senderName": msgPayload.User.FullName, "message": req.Message,
		"conversationId": targetConvID, "isNewConversation": isNewConversation,
	})
	app.Hub.SendToUser(req.ReceiverID, "conversationUpdated", map[string]interface{}{
		"conversationId": targetConvID, "lastMessage": map[string]interface{}{"message": req.Message, "sender": req.SenderID, "timestamp": now},
	})
	app.sendUpdatedConversations(req.ReceiverID, "messageReceived", targetConvID)

	return targetConvID, newMsg.ID.Hex(), nil
}

func (app *App) HandleGetMessages(w http.ResponseWriter, r *http.Request) {
	conversationID := mux.Vars(r)["conversationId"]
	ctx := context.Background()

	if conversationID == "new" {
		senderID := r.URL.Query().Get("senderId")
		receiverID := r.URL.Query().Get("receiverId")
		var conv Conversation
		err := app.Conversations.FindOne(ctx, bson.M{"members": bson.M{"$all": bson.A{senderID, receiverID}}}).Decode(&conv)
		if err != nil {
			respondJSON(w, http.StatusOK, map[string]interface{}{"mssgData": []interface{}{}, "conversationId": conversationID})
			return
		}
		conversationID = conv.ID.Hex()
	}

	opts := options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}})
	cursor, err := app.Messages.Find(ctx, bson.M{"conversationId": conversationID}, opts)
	if err != nil {
		log.Printf("Get Message Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get messages")
		return
	}
	defer cursor.Close(ctx)

	var messages []Message
	if err := cursor.All(ctx, &messages); err != nil {
		log.Printf("Get Message Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get messages")
		return
	}

	mssgData := make([]map[string]interface{}, 0, len(messages))
	for _, msg := range messages {
		user, _ := app.findUserByID(ctx, msg.SenderID)
		entry := map[string]interface{}{"message": msg.Message, "timestamp": msg.CreatedAt, "messageId": msg.ID.Hex()}
		if user != nil {
			entry["user"] = map[string]interface{}{"id": user.ID.Hex(), "phoneNumber": user.PhoneNumber, "fullName": user.FullName}
		}
		mssgData = append(mssgData, entry)
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"mssgData": mssgData, "conversationId": conversationID})
}

// ============================================================================
// HTTP Handlers — Read Receipts
// ============================================================================

func (app *App) HandleGetReadReceipt(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	conversationID, userID := vars["conversationId"], vars["userId"]
	if userID == "" || conversationID == "" {
		respondError(w, http.StatusBadRequest, "User ID and Conversation ID are required")
		return
	}
	ctx := context.Background()
	var receipt ReadReceipt
	err := app.ReadReceipts.FindOne(ctx, bson.M{"userId": userID, "conversationId": conversationID}).Decode(&receipt)
	if err == mongo.ErrNoDocuments {
		respondError(w, http.StatusNotFound, "No read receipt found")
		return
	} else if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch read receipt")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"lastSeenMessageId": receipt.LastSeenMessageID, "lastSeenAt": receipt.LastSeenAt, "isGroup": receipt.IsGroup,
	})
}

func (app *App) HandleMarkRead(w http.ResponseWriter, r *http.Request) {
	conversationID := mux.Vars(r)["conversationId"]
	var req MarkReadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.UserID == "" {
		respondError(w, http.StatusBadRequest, "User ID is required")
		return
	}

	ctx := context.Background()
	messageIDToMark := req.LastSeenMessageID
	if messageIDToMark == "" {
		opts := options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		var latestMsg Message
		err := app.Messages.FindOne(ctx, bson.M{"conversationId": conversationID}, opts).Decode(&latestMsg)
		if err == mongo.ErrNoDocuments {
			respondJSON(w, http.StatusOK, map[string]string{"message": "No messages to mark as read"})
			return
		} else if err != nil {
			respondError(w, http.StatusInternalServerError, "Failed to mark messages as read")
			return
		}
		messageIDToMark = latestMsg.ID.Hex()
	}

	upsertOpts := options.Update().SetUpsert(true)
	_, err := app.ReadReceipts.UpdateOne(ctx,
		bson.M{"userId": req.UserID, "conversationId": conversationID},
		bson.M{"$set": bson.M{"lastSeenMessageId": messageIDToMark, "lastSeenAt": time.Now(), "isGroup": req.IsGroup}},
		upsertOpts)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to mark messages as read")
		return
	}

	log.Printf("Marked conversation %s as read for user %s up to message %s", conversationID, req.UserID, messageIDToMark)
	app.sendUpdatedConversations(req.UserID, "markedAsRead", conversationID)
	respondJSON(w, http.StatusOK, map[string]interface{}{"message": "Messages marked as read successfully", "lastSeenMessageId": messageIDToMark})
}

// ============================================================================
// HTTP Handlers — Contacts
// ============================================================================

func (app *App) HandleGetContacts(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["userId"]
	ctx := context.Background()
	opts := options.Find().SetSort(bson.D{{Key: "addedAt", Value: -1}})
	cursor, err := app.Contacts.Find(ctx, bson.M{"userId": userID}, opts)
	if err != nil {
		log.Printf("Error fetching contacts: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to fetch contacts")
		return
	}
	defer cursor.Close(ctx)

	var contacts []Contact
	if err := cursor.All(ctx, &contacts); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch contacts")
		return
	}

	contactsData := make([]map[string]interface{}, 0, len(contacts))
	for _, c := range contacts {
		user, _ := app.findUserByObjID(ctx, c.ContactUserID)
		if user != nil {
			contactsData = append(contactsData, map[string]interface{}{
				"contactId": c.ID.Hex(),
				"user": map[string]interface{}{
					"phoneNumber": user.PhoneNumber, "fullName": user.FullName,
					"picture": user.Picture, "bio": user.Bio, "receiverId": user.ID.Hex(),
				},
				"addedAt": c.AddedAt, "isBlocked": c.IsBlocked,
			})
		}
	}
	respondJSON(w, http.StatusOK, contactsData)
}

func (app *App) HandleAddContact(w http.ResponseWriter, r *http.Request) {
	var req AddContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.UserID == "" || req.ContactPhoneNumber == "" {
		respondError(w, http.StatusBadRequest, "User ID and contact phone number are required")
		return
	}

	ctx := context.Background()
	var contactUser User
	if err := app.Users.FindOne(ctx, bson.M{"phoneNumber": req.ContactPhoneNumber}).Decode(&contactUser); err != nil {
		respondError(w, http.StatusNotFound, "User with this phone number not found")
		return
	}
	if contactUser.ID.Hex() == req.UserID {
		respondError(w, http.StatusBadRequest, "You cannot add yourself as a contact")
		return
	}
	count, _ := app.Contacts.CountDocuments(ctx, bson.M{"userId": req.UserID, "contactUserId": contactUser.ID})
	if count > 0 {
		respondError(w, http.StatusBadRequest, "Contact already exists")
		return
	}

	newContact := Contact{
		UserID: req.UserID, ContactUserID: contactUser.ID,
		ContactPhoneNumber: contactUser.PhoneNumber, ContactName: contactUser.FullName, AddedAt: time.Now(),
	}
	result, err := app.Contacts.InsertOne(ctx, newContact)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to add contact")
		return
	}
	newContact.ID = result.InsertedID.(primitive.ObjectID)

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Contact added successfully",
		"contact": map[string]interface{}{
			"contactId": newContact.ID.Hex(),
			"user": map[string]interface{}{
				"phoneNumber": contactUser.PhoneNumber, "fullName": contactUser.FullName,
				"picture": contactUser.Picture, "receiverId": contactUser.ID.Hex(),
			},
			"addedAt": newContact.AddedAt,
		},
	})
}

func (app *App) HandleRemoveContact(w http.ResponseWriter, r *http.Request) {
	contactID := mux.Vars(r)["contactId"]
	var req RemoveContactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	ctx := context.Background()
	objID, _ := primitive.ObjectIDFromHex(contactID)
	result, err := app.Contacts.DeleteOne(ctx, bson.M{"_id": objID, "userId": req.UserID})
	if err != nil || result.DeletedCount == 0 {
		respondError(w, http.StatusNotFound, "Contact not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Contact removed successfully"})
}

// ============================================================================
// HTTP Handlers — Users
// ============================================================================

func (app *App) HandleGetUsers(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["userId"]
	ctx := context.Background()
	objID, _ := primitive.ObjectIDFromHex(userID)
	cursor, err := app.Users.Find(ctx, bson.M{"_id": bson.M{"$ne": objID}})
	if err != nil {
		log.Printf("Get Users Error: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to get users")
		return
	}
	defer cursor.Close(ctx)

	var users []User
	if err := cursor.All(ctx, &users); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get users")
		return
	}
	usersData := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		usersData = append(usersData, map[string]interface{}{
			"user": map[string]interface{}{"fullName": u.FullName, "receiverId": u.ID.Hex()},
		})
	}
	respondJSON(w, http.StatusOK, usersData)
}

func (app *App) HandleUpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["userId"]
	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	ctx := context.Background()
	objID, _ := primitive.ObjectIDFromHex(userID)

	update := bson.M{"updatedAt": time.Now()}
	if req.FullName != "" {
		update["fullName"] = req.FullName
	}
	if req.Bio != "" {
		update["bio"] = req.Bio
	}
	if req.Picture != "" {
		update["picture"] = req.Picture
	}

	result := app.Users.FindOneAndUpdate(ctx, bson.M{"_id": objID}, bson.M{"$set": update},
		options.FindOneAndUpdate().SetReturnDocument(options.After))
	var updatedUser User
	if err := result.Decode(&updatedUser); err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id": updatedUser.ID.Hex(), "fullName": updatedUser.FullName, "bio": updatedUser.Bio, "picture": updatedUser.Picture,
	})
}

// ============================================================================
// HTTP Handlers — Groups
// ============================================================================

func (app *App) HandleCreateGroup(w http.ResponseWriter, r *http.Request) {
	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" || req.CreatedBy == "" {
		respondError(w, http.StatusBadRequest, "Group name and creator are required")
		return
	}

	ctx := context.Background()
	groupMembers := []GroupMember{{User: req.CreatedBy, Role: "admin"}}
	for _, mid := range req.Members {
		groupMembers = append(groupMembers, GroupMember{User: mid, Role: "member"})
	}

	newGroup := Group{
		Name: req.Name, Description: req.Description, ProfilePicture: req.ProfilePicture,
		CreatedBy: req.CreatedBy, Members: groupMembers, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	result, err := app.Groups.InsertOne(ctx, newGroup)
	if err != nil {
		log.Printf("Error creating group: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create group")
		return
	}
	newGroup.ID = result.InsertedID.(primitive.ObjectID)

	allMemberIDs := uniqueStrings(append([]string{req.CreatedBy}, req.Members...))
	groupConv := GroupConversation{GroupID: newGroup.ID, Members: allMemberIDs, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	convResult, err := app.GroupConversations.InsertOne(ctx, groupConv)
	if err != nil {
		log.Printf("Error creating group conversation: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to create group")
		return
	}
	groupConv.ID = convResult.InsertedID.(primitive.ObjectID)

	populatedMembers := app.populateGroupMembers(ctx, groupMembers)
	groupData := map[string]interface{}{"id": newGroup.ID.Hex(), "name": newGroup.Name, "profilePicture": newGroup.ProfilePicture, "memberCount": len(groupMembers)}
	convData := map[string]interface{}{"conversationId": groupConv.ID.Hex(), "isGroup": true, "group": groupData}

	for _, memberID := range allMemberIDs {
		isCreator := memberID == req.CreatedBy
		msg := "You have been added to the group \"" + newGroup.Name + "\""
		if isCreator {
			msg = "Group \"" + newGroup.Name + "\" created successfully"
		}
		app.Hub.SendToUser(memberID, "groupCreated", map[string]interface{}{
			"group": map[string]interface{}{"_id": newGroup.ID.Hex(), "name": newGroup.Name, "members": populatedMembers},
			"conversation": convData, "message": msg, "isCreator": isCreator,
		})
		app.Hub.SendToUser(memberID, "groupConnectionEstablished", map[string]interface{}{
			"groupId": newGroup.ID.Hex(), "conversationId": groupConv.ID.Hex(), "groupName": newGroup.Name, "members": populatedMembers,
		})
		app.sendUpdatedConversations(memberID, "groupCreated", groupConv.ID.Hex())
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{"group": newGroup, "conversationId": groupConv.ID.Hex()})
}

func (app *App) HandleGetGroups(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["userId"]
	ctx := context.Background()
	opts := options.Find().SetSort(bson.D{{Key: "updatedAt", Value: -1}})
	cursor, err := app.Groups.Find(ctx, bson.M{"members.user": userID}, opts)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch groups")
		return
	}
	defer cursor.Close(ctx)
	var groups []Group
	if err := cursor.All(ctx, &groups); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to fetch groups")
		return
	}
	respondJSON(w, http.StatusOK, groups)
}

func (app *App) HandleAddGroupMember(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["groupId"]
	var req AddGroupMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := context.Background()
	groupObjID, _ := primitive.ObjectIDFromHex(groupID)
	var group Group
	if err := app.Groups.FindOne(ctx, bson.M{"_id": groupObjID}).Decode(&group); err != nil {
		respondError(w, http.StatusNotFound, "Group not found")
		return
	}

	isCreator := group.CreatedBy == req.AdminID
	isAdmin := false
	for _, m := range group.Members {
		if m.User == req.AdminID && m.Role == "admin" {
			isAdmin = true
			break
		}
	}
	if !isCreator && !isAdmin {
		respondError(w, http.StatusForbidden, "Only admins can add members")
		return
	}
	for _, m := range group.Members {
		if m.User == req.UserID {
			respondError(w, http.StatusBadRequest, "User is already a member")
			return
		}
	}
	if group.MaxMembers > 0 && len(group.Members) >= group.MaxMembers {
		respondError(w, http.StatusBadRequest, "Group is at maximum capacity")
		return
	}

	app.Groups.UpdateOne(ctx, bson.M{"_id": groupObjID}, bson.M{"$push": bson.M{"members": GroupMember{User: req.UserID, Role: "member"}}})
	app.GroupConversations.UpdateOne(ctx, bson.M{"groupId": groupObjID}, bson.M{"$push": bson.M{"members": req.UserID}})

	var updatedGroup Group
	app.Groups.FindOne(ctx, bson.M{"_id": groupObjID}).Decode(&updatedGroup)

	var groupConv GroupConversation
	app.GroupConversations.FindOne(ctx, bson.M{"groupId": groupObjID}).Decode(&groupConv)

	app.Hub.SendToUser(req.UserID, "addedToGroup", map[string]interface{}{
		"group": updatedGroup, "message": "You have been added to the group \"" + updatedGroup.Name + "\"",
	})
	app.Hub.SendToUser(req.UserID, "groupConnectionEstablished", map[string]interface{}{
		"groupId": groupID, "conversationId": groupConv.ID.Hex(), "groupName": updatedGroup.Name,
		"members": app.populateGroupMembers(ctx, updatedGroup.Members),
	})

	newMemberUser, _ := app.findUserByID(ctx, req.UserID)
	for _, m := range updatedGroup.Members {
		if m.User != req.UserID {
			memberName := req.UserID
			if newMemberUser != nil {
				memberName = newMemberUser.FullName
			}
			app.Hub.SendToUser(m.User, "groupMemberAdded", map[string]interface{}{
				"groupId": groupID, "newMember": map[string]interface{}{"user": map[string]interface{}{"fullName": memberName}, "role": "member"},
				"group": updatedGroup, "message": memberName + " has been added to the group",
			})
		}
	}
	respondJSON(w, http.StatusOK, updatedGroup)
}

func (app *App) HandleRemoveGroupMember(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID, userID := vars["groupId"], vars["userId"]
	var req RemoveGroupMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := context.Background()
	groupObjID, _ := primitive.ObjectIDFromHex(groupID)
	var group Group
	if err := app.Groups.FindOne(ctx, bson.M{"_id": groupObjID}).Decode(&group); err != nil {
		respondError(w, http.StatusNotFound, "Group not found")
		return
	}

	memberFound := false
	for _, m := range group.Members {
		if m.User == userID {
			memberFound = true
			break
		}
	}
	if !memberFound {
		respondError(w, http.StatusNotFound, "User is not a member of this group")
		return
	}
	if userID == group.CreatedBy {
		respondError(w, http.StatusBadRequest, "Group creator cannot be removed or leave the group")
		return
	}

	isAuthorized := false
	if req.AdminID == userID {
		isAuthorized = true
	} else {
		isCreator := group.CreatedBy == req.AdminID
		isAdmin := false
		for _, m := range group.Members {
			if m.User == req.AdminID && m.Role == "admin" {
				isAdmin = true
				break
			}
		}
		isAuthorized = isCreator || isAdmin
	}
	if !isAuthorized {
		respondError(w, http.StatusForbidden, "Insufficient permissions to remove this member")
		return
	}

	newMembers := make([]GroupMember, 0)
	for _, m := range group.Members {
		if m.User != userID {
			newMembers = append(newMembers, m)
		}
	}
	app.Groups.UpdateOne(ctx, bson.M{"_id": groupObjID}, bson.M{"$set": bson.M{"members": newMembers}})
	app.GroupConversations.UpdateOne(ctx, bson.M{"groupId": groupObjID}, bson.M{"$pull": bson.M{"members": userID}})

	removedUser, _ := app.findUserByID(ctx, userID)
	removedName := "Unknown User"
	if removedUser != nil {
		removedName = removedUser.FullName
	}
	isLeaving := req.AdminID == userID

	leaveMsg := "You have been removed from the group \"" + group.Name + "\""
	if isLeaving {
		leaveMsg = "You have left the group \"" + group.Name + "\""
	}
	app.Hub.SendToUser(userID, "removedFromGroup", map[string]interface{}{
		"groupId": groupID, "groupName": group.Name, "isLeaving": isLeaving, "message": leaveMsg,
	})

	for _, m := range newMembers {
		memberMsg := removedName + " has been removed from the group"
		if isLeaving {
			memberMsg = removedName + " has left the group"
		}
		app.Hub.SendToUser(m.User, "groupMemberRemoved", map[string]interface{}{
			"groupId": groupID, "removedUserId": userID, "removedUserName": removedName,
			"isLeaving": isLeaving, "message": memberMsg,
		})
	}

	var updatedGroup Group
	app.Groups.FindOne(ctx, bson.M{"_id": groupObjID}).Decode(&updatedGroup)
	respondJSON(w, http.StatusOK, updatedGroup)
}

func (app *App) HandleUpdateGroup(w http.ResponseWriter, r *http.Request) {
	groupID := mux.Vars(r)["groupId"]
	var req UpdateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	ctx := context.Background()
	groupObjID, _ := primitive.ObjectIDFromHex(groupID)
	var group Group
	if err := app.Groups.FindOne(ctx, bson.M{"_id": groupObjID}).Decode(&group); err != nil {
		respondError(w, http.StatusNotFound, "Group not found")
		return
	}

	isCreator := group.CreatedBy == req.AdminID
	isAdmin := false
	for _, m := range group.Members {
		if m.User == req.AdminID && m.Role == "admin" {
			isAdmin = true
			break
		}
	}
	if !isCreator && !isAdmin {
		respondError(w, http.StatusForbidden, "Only admins can update group details")
		return
	}

	update := bson.M{"updatedAt": time.Now()}
	if req.Name != "" {
		update["name"] = req.Name
	}
	if req.Description != "" {
		update["description"] = req.Description
	}
	if req.ProfilePicture != "" {
		update["profilePicture"] = req.ProfilePicture
	}
	app.Groups.UpdateOne(ctx, bson.M{"_id": groupObjID}, bson.M{"$set": update})

	var updatedGroup Group
	app.Groups.FindOne(ctx, bson.M{"_id": groupObjID}).Decode(&updatedGroup)
	respondJSON(w, http.StatusOK, updatedGroup)
}

// ============================================================================
// HTTP Handlers — Sync
// ============================================================================

func (app *App) HandleSyncMessage(w http.ResponseWriter, r *http.Request) {
	var req SyncMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ConversationID == "" || req.SenderID == "" || req.Message == "" {
		respondError(w, http.StatusBadRequest, "Missing required fields")
		return
	}
	if req.ConversationID == "new" {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"localMessageId": req.LocalMessageID, "synced": false, "skipped": true,
			"reason": "conversationId is \"new\" - message should use proper conversation ID",
		})
		return
	}

	ctx := context.Background()
	var ts time.Time
	if req.Timestamp != "" {
		ts, _ = time.Parse(time.RFC3339, req.Timestamp)
	} else {
		ts = time.Now()
	}
	startTime := ts.Add(-5 * time.Second)
	endTime := ts.Add(5 * time.Second)

	var existingMsg Message
	found := false
	if req.SequenceNumber > 0 {
		err := app.Messages.FindOne(ctx, bson.M{"conversationId": req.ConversationID, "sequenceNumber": req.SequenceNumber}).Decode(&existingMsg)
		found = err == nil
	}
	if !found {
		err := app.Messages.FindOne(ctx, bson.M{
			"conversationId": req.ConversationID, "senderId": req.SenderID, "message": req.Message,
			"createdAt": bson.M{"$gte": startTime, "$lte": endTime},
		}).Decode(&existingMsg)
		found = err == nil
	}
	if found {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"messageId": existingMsg.ID.Hex(), "localMessageId": req.LocalMessageID, "synced": true,
			"timestamp": existingMsg.CreatedAt, "sequenceNumber": existingMsg.SequenceNumber, "duplicate": true,
		})
		return
	}

	newMsg := Message{
		ConversationID: req.ConversationID, SenderID: req.SenderID, Message: req.Message,
		SequenceNumber: req.SequenceNumber, CreatedAt: ts, UpdatedAt: time.Now(),
	}
	result, err := app.Messages.InsertOne(ctx, newMsg)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to sync message to MongoDB")
		return
	}
	newMsg.ID = result.InsertedID.(primitive.ObjectID)

	convObjID, _ := primitive.ObjectIDFromHex(req.ConversationID)
	app.Conversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": bson.M{
		"lastMessage.message": req.Message, "lastMessage.sender": req.SenderID,
		"lastMessage.timestamp": newMsg.CreatedAt, "lastMessage.sequenceNumber": newMsg.SequenceNumber,
	}})

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"messageId": newMsg.ID.Hex(), "localMessageId": req.LocalMessageID, "synced": true,
		"timestamp": newMsg.CreatedAt, "sequenceNumber": newMsg.SequenceNumber,
	})
}

func (app *App) HandleSyncUpdateMessage(w http.ResponseWriter, r *http.Request) {
	messageID := mux.Vars(r)["messageId"]
	var req SyncUpdateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if messageID == "" || req.Updates == nil {
		respondError(w, http.StatusBadRequest, "Missing required fields")
		return
	}
	ctx := context.Background()
	objID, _ := primitive.ObjectIDFromHex(messageID)
	result := app.Messages.FindOneAndUpdate(ctx, bson.M{"_id": objID}, bson.M{"$set": req.Updates},
		options.FindOneAndUpdate().SetReturnDocument(options.After))
	var updatedMsg Message
	if err := result.Decode(&updatedMsg); err != nil {
		respondError(w, http.StatusNotFound, "Message not found")
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"messageId": updatedMsg.ID.Hex(), "synced": true, "updatedMessage": updatedMsg})
}

func (app *App) HandleSyncDeleteMessage(w http.ResponseWriter, r *http.Request) {
	messageID := mux.Vars(r)["messageId"]
	var req SyncDeleteRequest
	json.NewDecoder(r.Body).Decode(&req)
	if messageID == "" {
		respondError(w, http.StatusBadRequest, "Message ID required")
		return
	}
	ctx := context.Background()
	objID, _ := primitive.ObjectIDFromHex(messageID)
	result, err := app.Messages.DeleteOne(ctx, bson.M{"_id": objID})
	if err != nil || result.DeletedCount == 0 {
		respondError(w, http.StatusNotFound, "Message not found")
		return
	}
	if req.ConversationID != "" {
		opts := options.FindOne().SetSort(bson.D{{Key: "createdAt", Value: -1}})
		var lastMsg Message
		err := app.Messages.FindOne(ctx, bson.M{"conversationId": req.ConversationID}, opts).Decode(&lastMsg)
		if err == nil {
			convObjID, _ := primitive.ObjectIDFromHex(req.ConversationID)
			app.Conversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": bson.M{
				"lastMessage.message": lastMsg.Message, "lastMessage.sender": lastMsg.SenderID, "lastMessage.timestamp": lastMsg.CreatedAt,
			}})
		} else {
			convObjID, _ := primitive.ObjectIDFromHex(req.ConversationID)
			app.Conversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$unset": bson.M{"lastMessage": ""}})
		}
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"messageId": messageID, "deleted": true, "synced": true})
}

func (app *App) HandleSyncConfig(w http.ResponseWriter, r *http.Request) {
	syncInterval := 5
	if v := os.Getenv("SYNC_INTERVAL_MINUTES"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			syncInterval = parsed
		}
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"syncIntervalMinutes": syncInterval, "syncEnabled": true, "serverTime": time.Now().Format(time.RFC3339),
	})
}

// ============================================================================
// HTTP Handlers — Active Users
// ============================================================================

func (app *App) HandleGetActiveUsers(w http.ResponseWriter, r *http.Request) {
	userIDsStr := r.URL.Query().Get("userIds")
	if userIDsStr == "" {
		respondError(w, http.StatusBadRequest, "Missing userIds")
		return
	}
	userIDs := strings.Split(userIDsStr, ",")
	for i := range userIDs {
		userIDs[i] = strings.TrimSpace(userIDs[i])
	}

	app.Hub.mu.RLock()
	defer app.Hub.mu.RUnlock()
	status := make([]map[string]interface{}, 0, len(userIDs))
	for _, uid := range userIDs {
		online := false
		for _, u := range app.Hub.GlobalActiveUsers {
			if u.UserID == uid {
				online = true
				break
			}
		}
		status = append(status, map[string]interface{}{"userId": uid, "online": online})
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"status": status})
}

// ============================================================================
// Helpers
// ============================================================================

func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if payload != nil {
		json.NewEncoder(w).Encode(payload)
	}
}

func respondError(w http.ResponseWriter, status int, msg string) {
	respondJSON(w, status, map[string]string{"message": msg})
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "none"
		}
		log.Printf("%s - %s %s - Origin: %s", time.Now().Format(time.RFC3339), r.Method, r.URL.Path, origin)
		next.ServeHTTP(w, r)
	})
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func uniqueStrings(ss []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(ss))
	for _, s := range ss {
		if !seen[s] {
			seen[s] = true
			result = append(result, s)
		}
	}
	return result
}

func generateSocketID() string {
	return time.Now().Format("20060102150405.000000") + randString(8)
}

func randString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[time.Now().UnixNano()%int64(len(letters))]
		time.Sleep(1)
	}
	return string(b)
}

func mergeActiveUsers(global []ActiveUser, local []ActiveUser) []ActiveUser {
	merged := make([]ActiveUser, len(global))
	copy(merged, global)
	for _, lu := range local {
		found := false
		for i, gu := range merged {
			if gu.UserID == lu.UserID {
				merged[i].SocketID = lu.SocketID
				found = true
				break
			}
		}
		if !found {
			merged = append(merged, lu)
		}
	}
	result := make([]ActiveUser, 0, len(merged))
	for _, u := range merged {
		if u.SocketID != "" {
			result = append(result, u)
		}
	}
	return result
}

func filterActiveUsers(users []ActiveUser, excludeUserID string) []ActiveUser {
	result := make([]ActiveUser, 0, len(users))
	for _, u := range users {
		if u.UserID != excludeUserID {
			result = append(result, u)
		}
	}
	return result
}

// ============================================================================
// DB Helpers
// ============================================================================

func (app *App) findUserByID(ctx context.Context, userID string) (*User, error) {
	objID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		return nil, err
	}
	var user User
	err = app.Users.FindOne(ctx, bson.M{"_id": objID}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (app *App) findUserByObjID(ctx context.Context, id primitive.ObjectID) (*User, error) {
	var user User
	err := app.Users.FindOne(ctx, bson.M{"_id": id}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (app *App) autoAddContact(ctx context.Context, userID, contactUserID string) {
	if userID == contactUserID {
		return
	}
	contactObjID, err := primitive.ObjectIDFromHex(contactUserID)
	if err != nil {
		return
	}
	count, _ := app.Contacts.CountDocuments(ctx, bson.M{"userId": userID, "contactUserId": contactObjID})
	if count > 0 {
		return
	}
	contactUser, err := app.findUserByObjID(ctx, contactObjID)
	if err != nil {
		return
	}
	newContact := Contact{
		UserID: userID, ContactUserID: contactObjID,
		ContactPhoneNumber: contactUser.PhoneNumber, ContactName: contactUser.FullName, AddedAt: time.Now(),
	}
	if _, err = app.Contacts.InsertOne(ctx, newContact); err != nil {
		log.Printf("Error auto-adding contact: %v", err)
		return
	}
	log.Printf("Auto-added contact: %s (%s) for user %s", contactUser.FullName, contactUserID, userID)
}

func (app *App) getUpdatedConversations(ctx context.Context, userID string) ([]ConversationData, error) {
	type timestampedConv struct {
		Timestamp time.Time
		Data      ConversationData
	}
	allConvs := make([]timestampedConv, 0)

	// Regular conversations
	opts := options.Find().SetSort(bson.D{{Key: "lastMessage.timestamp", Value: -1}, {Key: "updatedAt", Value: -1}})
	cursor, err := app.Conversations.Find(ctx, bson.M{"members": bson.M{"$in": bson.A{userID}}}, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	var regularConversations []Conversation
	if err := cursor.All(ctx, &regularConversations); err != nil {
		return nil, err
	}

	for _, conv := range regularConversations {
		receiverID := ""
		for _, member := range conv.Members {
			if member != userID {
				receiverID = member
				break
			}
		}
		user, _ := app.findUserByID(ctx, receiverID)
		if user == nil {
			continue
		}
		unreadCount := app.getUnreadCount(ctx, userID, conv.ID.Hex(), false)
		ts := conv.UpdatedAt
		if conv.LastMessage != nil {
			ts = conv.LastMessage.Timestamp
		}
		allConvs = append(allConvs, timestampedConv{Timestamp: ts, Data: ConversationData{
			User: &ConvUser{ReceiverID: user.ID.Hex(), FullName: user.FullName},
			ConversationID: conv.ID.Hex(), IsGroup: false, LastMessage: conv.LastMessage, UnreadCount: unreadCount,
		}})
	}

	// Group conversations
	gcOpts := options.Find().SetSort(bson.D{{Key: "lastMessage.timestamp", Value: -1}, {Key: "updatedAt", Value: -1}})
	gcCursor, err := app.GroupConversations.Find(ctx, bson.M{"members": bson.M{"$in": bson.A{userID}}}, gcOpts)
	if err != nil {
		return nil, err
	}
	defer gcCursor.Close(ctx)
	var groupConversations []GroupConversation
	if err := gcCursor.All(ctx, &groupConversations); err != nil {
		return nil, err
	}

	for _, gc := range groupConversations {
		var group Group
		if err := app.Groups.FindOne(ctx, bson.M{"_id": gc.GroupID}).Decode(&group); err != nil {
			continue
		}
		unreadCount := app.getUnreadCount(ctx, userID, gc.ID.Hex(), true)
		ts := gc.UpdatedAt
		if gc.LastMessage != nil {
			ts = gc.LastMessage.Timestamp
		}
		allConvs = append(allConvs, timestampedConv{Timestamp: ts, Data: ConversationData{
			ConversationID: gc.ID.Hex(), IsGroup: true,
			Group: &ConvGroup{ID: group.ID.Hex(), Name: group.Name, ProfilePicture: group.ProfilePicture, MemberCount: len(group.Members)},
			LastMessage: gc.LastMessage, UnreadCount: unreadCount,
		}})
	}

	sort.Slice(allConvs, func(i, j int) bool { return allConvs[i].Timestamp.After(allConvs[j].Timestamp) })
	result := make([]ConversationData, len(allConvs))
	for i, c := range allConvs {
		result[i] = c.Data
	}
	return result, nil
}

func (app *App) getUnreadCount(ctx context.Context, userID, conversationID string, isGroup bool) int64 {
	var receipt ReadReceipt
	err := app.ReadReceipts.FindOne(ctx, bson.M{"userId": userID, "conversationId": conversationID}).Decode(&receipt)
	if err != nil || receipt.LastSeenMessageID == "" {
		count, _ := app.Messages.CountDocuments(ctx, bson.M{"conversationId": conversationID})
		return count
	}
	lastSeenObjID, err := primitive.ObjectIDFromHex(receipt.LastSeenMessageID)
	if err != nil {
		count, _ := app.Messages.CountDocuments(ctx, bson.M{"conversationId": conversationID})
		return count
	}
	var lastSeenMsg Message
	if err := app.Messages.FindOne(ctx, bson.M{"_id": lastSeenObjID}).Decode(&lastSeenMsg); err != nil {
		count, _ := app.Messages.CountDocuments(ctx, bson.M{"conversationId": conversationID})
		return count
	}
	count, _ := app.Messages.CountDocuments(ctx, bson.M{"conversationId": conversationID, "createdAt": bson.M{"$gt": lastSeenMsg.CreatedAt}})
	return count
}

func (app *App) sendUpdatedConversations(userID, action, conversationID string) {
	ctx := context.Background()
	conversations, err := app.getUpdatedConversations(ctx, userID)
	if err != nil {
		log.Printf("Error getting updated conversations for %s: %v", userID, err)
		return
	}
	app.Hub.SendToUser(userID, "conversationsListUpdated", map[string]interface{}{
		"conversations": conversations, "action": action, "updatedConversationId": conversationID,
	})
}

func (app *App) processWebSocketMessage(req SendMessageRequest) {
	ctx := context.Background()
	conversationID := req.ConversationID

	if !req.IsGroup && (conversationID == "" || conversationID == "new") && req.ReceiverID != "" {
		var conv Conversation
		err := app.Conversations.FindOne(ctx, bson.M{"members": bson.M{"$all": bson.A{req.SenderID, req.ReceiverID}}}).Decode(&conv)
		if err != nil {
			newConv := Conversation{Members: []string{req.SenderID, req.ReceiverID}, CreatedAt: time.Now(), UpdatedAt: time.Now()}
			result, err := app.Conversations.InsertOne(ctx, newConv)
			if err != nil {
				log.Printf("[WS] Error creating conversation: %v", err)
				return
			}
			conversationID = result.InsertedID.(primitive.ObjectID).Hex()
		} else {
			conversationID = conv.ID.Hex()
		}
	}
	if conversationID == "" || conversationID == "new" {
		log.Printf("[WS] Invalid conversationId after processing")
		return
	}

	newMsg := Message{ConversationID: conversationID, SenderID: req.SenderID, Message: req.Message, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	result, err := app.Messages.InsertOne(ctx, newMsg)
	if err != nil {
		log.Printf("[WS] Error saving message: %v", err)
		return
	}
	newMsg.ID = result.InsertedID.(primitive.ObjectID)

	now := time.Now()
	lastMsgUpdate := bson.M{"lastMessage.message": req.Message, "lastMessage.sender": req.SenderID, "lastMessage.timestamp": now}

	sender, _ := app.findUserByID(ctx, req.SenderID)
	msgPayload := MessagePayload{
		MessageID: newMsg.ID.Hex(), SenderID: req.SenderID, Message: req.Message,
		ConversationID: conversationID, ReceiverID: req.ReceiverID, IsGroup: req.IsGroup,
	}
	if sender != nil {
		msgPayload.User = MessageUser{ID: sender.ID.Hex(), FullName: sender.FullName, PhoneNumber: sender.PhoneNumber}
	}

	if req.IsGroup {
		convObjID, _ := primitive.ObjectIDFromHex(conversationID)
		app.GroupConversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": lastMsgUpdate})
		var gc GroupConversation
		if err := app.GroupConversations.FindOne(ctx, bson.M{"_id": convObjID}).Decode(&gc); err == nil {
			app.Groups.UpdateOne(ctx, bson.M{"_id": gc.GroupID}, bson.M{"$set": lastMsgUpdate})
			for _, memberID := range gc.Members {
				app.Hub.SendToUser(memberID, "getMessage", msgPayload)
			}
		}
	} else {
		convObjID, _ := primitive.ObjectIDFromHex(conversationID)
		app.Conversations.UpdateOne(ctx, bson.M{"_id": convObjID}, bson.M{"$set": lastMsgUpdate})
		app.autoAddContact(ctx, req.ReceiverID, req.SenderID)
		app.autoAddContact(ctx, req.SenderID, req.ReceiverID)
		app.Hub.SendToUser(req.SenderID, "getMessage", msgPayload)
		app.Hub.SendToUser(req.ReceiverID, "getMessage", msgPayload)
	}
	log.Printf("[WS] Message processed: id=%s conv=%s", newMsg.ID.Hex(), conversationID)
}

func (app *App) notifyContactsOnline(userID string) {
	ctx := context.Background()
	cursor, err := app.Contacts.Find(ctx, bson.M{"userId": userID})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)
	var contacts []Contact
	cursor.All(ctx, &contacts)
	for _, c := range contacts {
		app.Hub.SendToUser(c.ContactUserID.Hex(), "contactOnline", map[string]string{"userId": userID})
	}
}

func (app *App) notifyContactsOffline(userID string) {
	ctx := context.Background()
	cursor, err := app.Contacts.Find(ctx, bson.M{"contactUserId": userID})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)
	var contacts []Contact
	cursor.All(ctx, &contacts)
	for _, c := range contacts {
		app.Hub.SendToUser(c.UserID, "contactOffline", map[string]string{"userId": userID})
	}
}

func (app *App) establishExistingConnections(userID, socketID string) {
	ctx := context.Background()
	log.Printf("Establishing existing connections for user: %s", userID)

	cursor, err := app.Conversations.Find(ctx, bson.M{"members": bson.M{"$in": bson.A{userID}}})
	if err != nil {
		log.Printf("Error establishing connections: %v", err)
		return
	}
	defer cursor.Close(ctx)
	var conversations []Conversation
	cursor.All(ctx, &conversations)

	for _, conv := range conversations {
		otherMember := ""
		for _, m := range conv.Members {
			if m != userID {
				otherMember = m
				break
			}
		}
		if otherMember != "" {
			otherUser, _ := app.findUserByID(ctx, otherMember)
			if otherUser != nil {
				app.Hub.SendToUser(userID, "conversationConnectionEstablished", map[string]interface{}{
					"conversationId": conv.ID.Hex(), "with": otherUser.ID.Hex(), "withName": otherUser.FullName, "isGroup": false,
				})
			}
		}
	}

	gcCursor, err := app.GroupConversations.Find(ctx, bson.M{"members": bson.M{"$in": bson.A{userID}}})
	if err != nil {
		return
	}
	defer gcCursor.Close(ctx)
	var groupConvs []GroupConversation
	gcCursor.All(ctx, &groupConvs)

	for _, gc := range groupConvs {
		var group Group
		if err := app.Groups.FindOne(ctx, bson.M{"_id": gc.GroupID}).Decode(&group); err != nil {
			continue
		}
		populatedMembers := app.populateGroupMembers(ctx, group.Members)
		app.Hub.SendToUser(userID, "groupConnectionEstablished", map[string]interface{}{
			"groupId": group.ID.Hex(), "conversationId": gc.ID.Hex(), "groupName": group.Name, "members": populatedMembers,
		})
	}

	log.Printf("Established connections: %d conversations, %d groups for user %s", len(conversations), len(groupConvs), userID)
}

func (app *App) populateGroupMembers(ctx context.Context, members []GroupMember) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(members))
	for _, m := range members {
		user, _ := app.findUserByID(ctx, m.User)
		name := m.User
		if user != nil {
			name = user.FullName
		}
		result = append(result, map[string]interface{}{"id": m.User, "name": name, "role": m.Role})
	}
	return result
}
