package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type ReadReceipt struct {
	ID                primitive.ObjectID  `bson:"_id,omitempty" json:"id"`
	UserID            primitive.ObjectID  `bson:"userId" json:"userId"`
	ConversationID    string              `bson:"conversationId" json:"conversationId"`
	LastSeenMessageID *primitive.ObjectID `bson:"lastSeenMessageId,omitempty" json:"lastSeenMessageId,omitempty"`
	LastSeenAt        time.Time           `bson:"lastSeenAt,omitempty" json:"lastSeenAt"`
	IsGroup           bool                `bson:"isGroup,omitempty" json:"isGroup"`
	CreatedAt         time.Time           `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt         time.Time           `bson:"updatedAt,omitempty" json:"updatedAt"`
}