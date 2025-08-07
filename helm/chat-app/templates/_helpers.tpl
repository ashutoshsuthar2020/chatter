{{/*
Expand the name of the chart.
*/}}
{{- define "chat-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "chat-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "chat-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chat-app.labels" -}}
helm.sh/chart: {{ include "chat-app.chart" . }}
{{ include "chat-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chat-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chat-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "chat-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "chat-app.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Server specific helpers
*/}}
{{- define "chat-app.server.fullname" -}}
{{- printf "%s-%s" (include "chat-app.fullname" .) .Values.server.name }}
{{- end }}

{{- define "chat-app.server.labels" -}}
{{ include "chat-app.labels" . }}
app.kubernetes.io/component: {{ .Values.server.name }}
{{- end }}

{{- define "chat-app.server.selectorLabels" -}}
{{ include "chat-app.selectorLabels" . }}
app.kubernetes.io/component: {{ .Values.server.name }}
{{- end }}

{{/*
Client specific helpers
*/}}
{{- define "chat-app.client.fullname" -}}
{{- printf "%s-%s" (include "chat-app.fullname" .) .Values.client.name }}
{{- end }}

{{- define "chat-app.client.labels" -}}
{{ include "chat-app.labels" . }}
app.kubernetes.io/component: {{ .Values.client.name }}
{{- end }}

{{- define "chat-app.client.selectorLabels" -}}
{{ include "chat-app.selectorLabels" . }}
app.kubernetes.io/component: {{ .Values.client.name }}
{{- end }}

{{/*
Image registry helpers
*/}}
{{- define "chat-app.server.image" -}}
{{- $registry := .Values.server.image.registry -}}
{{- if .Values.global.imageRegistry -}}
{{- $registry = .Values.global.imageRegistry -}}
{{- end -}}
{{- printf "%s/%s:%s" $registry .Values.server.image.repository .Values.server.image.tag -}}
{{- end }}

{{- define "chat-app.client.image" -}}
{{- $registry := .Values.client.image.registry -}}
{{- if .Values.global.imageRegistry -}}
{{- $registry = .Values.global.imageRegistry -}}
{{- end -}}
{{- printf "%s/%s:%s" $registry .Values.client.image.repository .Values.client.image.tag -}}
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "chat-app.redis.host" -}}
{{- if .Values.redis.enabled -}}
{{- printf "%s-redis-master" .Release.Name -}}
{{- else -}}
{{- .Values.externalRedis.host -}}
{{- end -}}
{{- end }}

{{- define "chat-app.redis.port" -}}
{{- if .Values.redis.enabled -}}
{{- .Values.redis.master.service.ports.redis -}}
{{- else -}}
{{- .Values.externalRedis.port -}}
{{- end -}}
{{- end }}

{{/*
MongoDB connection string
*/}}
{{- define "chat-app.mongodb.host" -}}
{{- if .Values.mongodb.enabled -}}
{{- printf "%s-mongodb" .Release.Name -}}
{{- else -}}
{{- .Values.externalMongodb.host -}}
{{- end -}}
{{- end }}

{{- define "chat-app.mongodb.port" -}}
{{- if .Values.mongodb.enabled -}}
{{- 27017 -}}
{{- else -}}
{{- .Values.externalMongodb.port -}}
{{- end -}}
{{- end }}

{{- define "chat-app.mongodb.database" -}}
{{- if .Values.mongodb.enabled -}}
{{- .Values.mongodb.auth.database -}}
{{- else -}}
{{- .Values.externalMongodb.database -}}
{{- end -}}
{{- end }}

{{/*
MongoDB URI
*/}}
{{- define "chat-app.mongodb.uri" -}}
{{- printf "mongodb://%s:%s/%s" (include "chat-app.mongodb.host" .) (include "chat-app.mongodb.port" .) (include "chat-app.mongodb.database" .) -}}
{{- end }}
