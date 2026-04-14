package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Message struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	ConversationID string             `bson:"conversationId" json:"conversationId"`
	SenderID       string             `bson:"senderId" json:"senderId"`
	Message        string             `bson:"message" json:"message"`
	SequenceNumber int64              `bson:"sequenceNumber,omitempty" json:"sequenceNumber"`
	DeletedFor     []string           `bson:"deletedFor,omitempty" json:"deletedFor"`
	CreatedAt      time.Time          `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt,omitempty" json:"updatedAt"`
}