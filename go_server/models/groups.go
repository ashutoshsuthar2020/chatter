package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GroupMember struct {
	User     primitive.ObjectID `bson:"user" json:"user"`
	Role     string             `bson:"role,omitempty" json:"role"`
	JoinedAt time.Time          `bson:"joinedAt,omitempty" json:"joinedAt"`
}

type GroupLastMessage struct {
	Message   string             `bson:"message,omitempty" json:"message"`
	Sender    primitive.ObjectID `bson:"sender,omitempty" json:"sender"`
	Timestamp time.Time          `bson:"timestamp,omitempty" json:"timestamp"`
}

type Group struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Name           string             `bson:"name" json:"name"`
	Description    string             `bson:"description,omitempty" json:"description"`
	ProfilePicture string             `bson:"profilePicture,omitempty" json:"profilePicture"`
	CreatedBy      primitive.ObjectID `bson:"createdBy" json:"createdBy"`
	Members        []GroupMember      `bson:"members" json:"members"`
	IsPrivate      bool               `bson:"isPrivate,omitempty" json:"isPrivate"`
	InviteLink     *string            `bson:"inviteLink,omitempty" json:"inviteLink,omitempty"`
	MaxMembers     int32              `bson:"maxMembers,omitempty" json:"maxMembers"`
	LastMessage    *GroupLastMessage  `bson:"lastMessage,omitempty" json:"lastMessage,omitempty"`
	CreatedAt      time.Time          `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt      time.Time          `bson:"updatedAt,omitempty" json:"updatedAt"`
}