package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Contact struct {
	ID                 primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID             primitive.ObjectID `bson:"userId" json:"userId"`
	ContactUserID      primitive.ObjectID `bson:"contactUserId" json:"contactUserId"`
	ContactPhoneNumber string             `bson:"contactPhoneNumber" json:"contactPhoneNumber"`
	ContactName        string             `bson:"contactName" json:"contactName"`
	AddedAt            time.Time          `bson:"addedAt,omitempty" json:"addedAt"`
	IsBlocked          bool               `bson:"isBlocked,omitempty" json:"isBlocked"`
	CreatedAt          time.Time          `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt          time.Time          `bson:"updatedAt,omitempty" json:"updatedAt"`
}