package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GroupConversationLastMessage struct {
	Message   string             `bson:"message,omitempty" json:"message"`
	Sender    primitive.ObjectID `bson:"sender,omitempty" json:"sender"`
	Timestamp time.Time          `bson:"timestamp,omitempty" json:"timestamp"`
}

type GroupConversation struct {
	ID          primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	GroupID     primitive.ObjectID   `bson:"groupId" json:"groupId"`
	Members     []primitive.ObjectID `bson:"members" json:"members"`
	LastMessage *GroupConversationLastMessage `bson:"lastMessage,omitempty" json:"lastMessage,omitempty"`
	CreatedAt   time.Time            `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt   time.Time            `bson:"updatedAt,omitempty" json:"updatedAt"`
}