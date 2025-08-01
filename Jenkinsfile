pipeline {
    agent {
        label 'small-ec2-fleet'
    }

    stages {
        stage('Install dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Publish') {
            steps {
                withCredentials([string(credentialsId: 'npm-token', variable: 'NPM_TOKEN')]) {
                    sh '''
                        echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc
                        npm publish
                    '''
                }
            }
        }
    }
    post {
        always {
            cleanWs()
        }
    }
}
