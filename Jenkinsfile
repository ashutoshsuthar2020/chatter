pipeline {
    agent any

    environment {
        DOCKERHUB_USER = 'ashu001'
        CLIENT_IMAGE = "ashu001/client:latest"
        SERVER_IMAGE = "ashu001/server:latest"
        KUBECONFIG = '/Users/assuthar/Desktop/ssl-keys/civo/civo-autumn-forest-28272333-kubeconfig' // Update this path
    }

    stages {
        stage('Build Client') {
            steps {
                dir('client') {
                    sh 'npm install'
                    sh 'npm run build'
                }
            }
        }
        stage('Build and Push Client Image') {
            steps {
                sh 'docker build -t $CLIENT_IMAGE ./client'
                sh 'docker push $CLIENT_IMAGE'
            }
        }
        stage('Build and Push Server Image') {
            steps {
                sh 'docker build -t $SERVER_IMAGE ./server'
                sh 'docker push $SERVER_IMAGE'
            }
        }
        stage('Helm Upgrade Client') {
            steps {
                sh 'helm upgrade --install chatter-client ./helm/client --values ./helm/client/values.yaml'
            }
        }
        stage('Helm Upgrade Server') {
            steps {
                sh 'helm upgrade --install chatter-server ./helm/server --values ./helm/server/values.yaml'
            }
        }
    }
}
