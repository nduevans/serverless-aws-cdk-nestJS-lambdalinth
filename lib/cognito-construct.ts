import { CfnAuthorizer, CfnMethod, LambdaIntegration, RestApi } from "aws-cdk-lib/aws-apigateway";
import { OAuthScope, UserPool, UserPoolClient, UserPoolClientIdentityProvider, UserPoolDomain } from "aws-cdk-lib/aws-cognito";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Code, LayerVersion, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { resolve } from "path";


export interface CognitoProps {

}
export class Cognito extends Construct {
    constructor(scope: Construct, id: string, props: CognitoProps){
        super(scope, id);

        // COGNITO
        const userPool = new UserPool(this, 'ZikyUserPool', {
            autoVerify: {
              email: true,
            },
            standardAttributes: {
              email: {
                required: true,
              },
            },
            signInAliases: {
              email: true,
              username: true,
              preferredUsername: true,
            },
            selfSignUpEnabled: true,
          });

          const userPoolClient = new UserPoolClient(this, 'ZikyUserPoolClient', {
            userPool,
            userPoolClientName: 'Ziky Cognito App Client',
            authFlows: {
              userSrp: true,
            //   refreshToken: true,              
            },
            oAuth: {
              flows: {
                // it is recommended to not use implicitCodeGrant flow in general
                // see more https://oauth.net/2/grant-types/implicit/#:~:text=It%20is%20not%20recommended%20to,been%20received%20by%20the%20client.
                implicitCodeGrant: true,
              },
              scopes: [OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN],
              callbackUrls: ['ziky.win'],
            },
            supportedIdentityProviders: [UserPoolClientIdentityProvider.COGNITO],
            preventUserExistenceErrors: true,
          });

          const userPoolDomain = new UserPoolDomain(this, 'ZikyUserPoolDomain', {
            userPool,
            cognitoDomain: {
              // this will be used to create unique auth domain hosted on `auth.ap-southeast-2.amazoncognito.com`,
              domainPrefix: "ziky",
            },
          });
        
        // DYNAMO DB
        // add dynamo db table to store all user created todos
        const table = new Table(this, 'Table', {
            partitionKey: { name: 'PK', type: AttributeType.STRING },
            sortKey: { name: 'SK', type: AttributeType.STRING },
            billingMode: BillingMode.PAY_PER_REQUEST,
        });

          // LAMBDA STUFF
        // pack all external deps in layer
        const lambdaLayer = new LayerVersion(this, 'HandlerLayer', {
            code: Code.fromAsset(resolve(__dirname, '../api/node_modules')),
            compatibleRuntimes: [Runtime.NODEJS_18_X, Runtime.NODEJS_20_X],
            description: 'Api Handler Dependencies',
        });
        
        // add handler to respond to all our api requests
        const handler = new NodejsFunction(this, 'Handler', {
            code: Code.fromAsset(resolve(__dirname, '../api/dist'), {
            exclude: ['node_modules'],
            }),
            handler: 'main.api',
            runtime: Runtime.NODEJS_20_X,
            layers: [lambdaLayer],
            environment: {
            tableName: table.tableName,
            },
        });

        // grant api handler to read and write data to and from above table
        table.grantReadWriteData(handler);

        // REST API GATEWAY 
        // add api resource to handle all http traffic and pass it to our handler
        const api = new RestApi(this, 'ZikyApi', {
            deploy: true,
            defaultMethodOptions: {
            apiKeyRequired: true,
            },
            deployOptions: {
            stageName: 'v1',
            },
        });
    
        // add proxy resource to handle all api requests
        const apiResource = api.root.addProxy({
            defaultIntegration: new LambdaIntegration(handler),
        });
    
        // add api key to enable monitoring
        const apiKey = api.addApiKey('ApiKey');
        const usagePlan = api.addUsagePlan('UsagePlan', {
            // apiKey,
            name: 'Standard',
        });
        // you can also stage based api throttling
        usagePlan.addApiStage({
            stage: api.deploymentStage,
        });

        // add cognito authorizer
        const anyMethod = apiResource.anyMethod?.node.defaultChild as CfnMethod;
        const authorizer = new CfnAuthorizer (this, 'CognitoAuthorizer', {
        name: 'Ziky_Cognito_Authorizer',
        identitySource: 'method.request.header.Authorization',
        providerArns: [userPool.userPoolArn],
        restApiId: api.restApiId,
        type: 'COGNITO_USER_POOLS',
        });

        // add dependency to our api method, this helps cdk determine which resources needs to be created first
        anyMethod.node.addDependency(authorizer);
        anyMethod.addOverride('Properties.AuthorizerId', authorizer.ref);
    }
}