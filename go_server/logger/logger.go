package logger

import (
	"log/slog"
	"os"
)

var Log = slog.New(
	slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}),
).With("service", "chat-server")
