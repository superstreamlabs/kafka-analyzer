@Library('shared-library') _

pipeline {

    agent {
        label 'small-ec2-fleet'
    }

    environment {
            HOME           = '/tmp'
            SLACK_CHANNEL  = '#jenkins-events'
    }

    stages {
        stage('Extract Version') {
            steps {
                script {
                    def pkgVersion = sh(script: "jq -r .version package.json", returnStdout: true).trim()
                    env.versionTag = "v${pkgVersion}"
                }
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm install'
                sh 'npm pack'
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

        stage('Create Release'){      
            steps {                               
                sh """
                    curl -L https://github.com/cli/cli/releases/download/v2.40.0/gh_2.40.0_linux_amd64.tar.gz -o gh.tar.gz 
                    tar -xvf gh.tar.gz
                    mv gh_2.40.0_linux_amd64/bin/gh /usr/local/bin 
                    rm -rf gh_2.40.0_linux_amd64 gh.tar.gz
                """
                withCredentials([sshUserPrivateKey(keyFileVariable:'check',credentialsId: 'main-github')]) {
                sh """
                GIT_SSH_COMMAND='ssh -i $check -o StrictHostKeyChecking=no' git config --global user.email "jenkins@superstream.ai"
                GIT_SSH_COMMAND='ssh -i $check -o StrictHostKeyChecking=no' git config --global user.name "Jenkins"                
                GIT_SSH_COMMAND='ssh -i $check -o StrictHostKeyChecking=no' git tag -a $versionTag -m "$versionTag"
                GIT_SSH_COMMAND='ssh -i $check -o StrictHostKeyChecking=no' git push origin $versionTag
                """
                }                
                withCredentials([string(credentialsId: 'gh_token', variable: 'GH_TOKEN')]) {
                sh """
                gh release upload $versionTag superstream-kafka-analyzer-${env.versionTag}.tgz  --generate-notes
                """
                }                
            }
        }         
    }
    post {
        always {
            cleanWs()
        }
        success {
            script {  
                sendSlackNotification('SUCCESS')         
                notifySuccessful()
            }
        }
        
        failure {
            script {
                if (env.GIT_BRANCH == 'latest') { 
                    sendSlackNotification('FAILURE')              
                    notifyFailed()
                }
            }            
        }
        aborted {
            script {
                if (env.BRANCH_NAME == 'latest') {
                    sendSlackNotification('ABORTED')
                }
                // Get the build log to check for the specific exception and retry job
                AgentOfflineException()
            }          
        }        
    }
}

def notifySuccessful() {
    emailext (
        subject: "SUCCESSFUL: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
        body: """SUCCESSFUL: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':
        Check console output and connection attributes at ${env.BUILD_URL}""",
        to: 'tech-leads@superstream.ai'
    )
}
def notifyFailed() {
    emailext (
        subject: "FAILED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'",
        body: """FAILED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':
        Check console output at ${env.BUILD_URL}""",
        to: 'tech-leads@superstream.ai'
    )
}
