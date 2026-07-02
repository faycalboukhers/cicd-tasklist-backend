pipeline {
    agent any

    tools {
        nodejs 'NodeJS'
    }

    environment {
        IMAGE_NAME = 'tasklist-backend'
        // Identifiants Docker Hub stockés dans Jenkins (jamais en clair)
        DOCKERHUB = credentials('dockerhub')
        // Chemin de l'outil SonarScanner configuré dans Jenkins
        SCANNER_HOME = tool 'SonarScanner'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                sh 'npm ci'
                sh 'npx prisma generate'
            }
        }

        stage('Tests & Couverture') {
            steps {
                sh 'npm run test:ci'
            }
            post {
                always {
                    junit 'reports/junit.xml'
                }
            }
        }

        stage('Analyse SonarQube') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh '"$SCANNER_HOME/bin/sonar-scanner"'
                }
            }
        }

        stage('Quality Gate') {
            steps {
                // Nécessite le webhook SonarQube -> Jenkins ; ne bloque pas le build ici
                timeout(time: 3, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: false
                }
            }
        }

        stage('Build image Docker') {
            steps {
                sh 'docker build -t "$DOCKERHUB_USR/$IMAGE_NAME:$BUILD_NUMBER" -t "$DOCKERHUB_USR/$IMAGE_NAME:latest" .'
            }
        }

        stage('SBOM & Scan Trivy') {
            steps {
                // Génération du SBOM au format SPDX
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v "$PWD":/out \
                      aquasec/trivy:latest image \
                      --format spdx-json --output /out/sbom-spdx.json \
                      "$DOCKERHUB_USR/$IMAGE_NAME:$BUILD_NUMBER"
                '''
                // Analyse des vulnérabilités de l'image (rapport, ne bloque pas)
                sh '''
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      aquasec/trivy:latest image \
                      --severity HIGH,CRITICAL --exit-code 0 \
                      "$DOCKERHUB_USR/$IMAGE_NAME:$BUILD_NUMBER"
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'sbom-spdx.json', allowEmptyArchive: true
                }
            }
        }

        stage('Publication Docker Hub') {
            steps {
                sh 'echo "$DOCKERHUB_PSW" | docker login -u "$DOCKERHUB_USR" --password-stdin'
                sh 'docker push "$DOCKERHUB_USR/$IMAGE_NAME:$BUILD_NUMBER"'
                sh 'docker push "$DOCKERHUB_USR/$IMAGE_NAME:latest"'
            }
        }
    }

    post {
        always {
            sh 'docker logout || true'
        }
    }
}
