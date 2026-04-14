package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type LastMessage struct {
	Message        string             `bson:"message,omitempty" json:"message"`
	Sender         primitive.ObjectID `bson:"sender,omitempty" json:"sender"`
	Timestamp      time.Time          `bson:"timestamp,omitempty" json:"timestamp"`
	SequenceNumber int64              `bson:"sequenceNumber,omitempty" json:"sequenceNumber"`
}

type Conversation struct {
	ID          primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	Members     []primitive.ObjectID `bson:"members" json:"members"`
	IsGroup     bool                 `bson:"isGroup,omitempty" json:"isGroup"`
	GroupID     *primitive.ObjectID  `bson:"groupId,omitempty" json:"groupId,omitempty"`
	LastMessage *LastMessage         `bson:"lastMessage,omitempty" json:"lastMessage,omitempty"`
	CreatedAt   time.Time            `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt   time.Time            `bson:"updatedAt,omitempty" json:"updatedAt"`
}