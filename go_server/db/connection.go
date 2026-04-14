package db

import (
	"context"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var Client *mongo.Client

func InitMongo() {

	uri := os.Getenv("MONGODB_URI")
	log.Printf("MongoDB URI: %s\n", uri)

	// Set client options
	clientOptions := options.Client().ApplyURI(uri)

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Connect to MongoDB
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatalf("Connection error with MongoDB: %v", err)
	}

	// Ping to verify connection
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatalf("MongoDB ping failed: %v", err)
	}

	Client = client

	log.Println("Connected successfully with MongoDB")
}
