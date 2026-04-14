package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type User struct {
	ID           primitive.ObjectID   `bson:"_id,omitempty" json:"id"`
	FullName     string               `bson:"fullName" json:"fullName"`
	PhoneNumber  string               `bson:"phoneNumber" json:"phoneNumber"`
	Password     string               `bson:"password" json:"password"`
	Picture      string               `bson:"picture,omitempty" json:"picture"`
	Bio          string               `bson:"bio,omitempty" json:"bio"`
	LastActiveAt time.Time            `bson:"lastActiveAt,omitempty" json:"lastActiveAt"`
	Friend       []primitive.ObjectID `bson:"friend,omitempty" json:"friend"`
	CreatedAt    time.Time            `bson:"createdAt,omitempty" json:"createdAt"`
	UpdatedAt    time.Time            `bson:"updatedAt,omitempty" json:"updatedAt"`
}