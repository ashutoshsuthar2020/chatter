package middleware

import (
	"context"
	"encoding/json"
	"errors"
	"go_server/models"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type contextKey string

const UserContextKey contextKey = "user"

type JWTClaims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

func AuthenticateJWT(userCollection *mongo.Collection, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		parts := strings.Split(authHeader, " ")

		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"message": "Access token required",
			})
			return
		}

		tokenString := parts[1]

		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			jwtSecret = "THIS_IS_A_JWT_SECRET_KEY"
		}

		claims := &JWTClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(jwtSecret), nil
		})

		if err != nil || !token.Valid {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"message": "Invalid token",
			})
			return
		}

		userID, err := primitive.ObjectIDFromHex(claims.UserID)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"message": "Invalid token",
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		var user models.User
		err = userCollection.FindOne(
			ctx,
			bson.M{"_id": userID},
		).Decode(&user)

		if err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"message": "User not found",
				})
				return
			}

			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"message": "Invalid token",
			})
			return
		}

		user.Password = ""

		ctxWithUser := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctxWithUser))
	})
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
