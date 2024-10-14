# AWS CDK / Typescript / CI/CD AWS CodePipeline +
# NestJS - running inside a Lambda as our LambdaLinth

PLus more constructs and AWS resources such as API gateway, AWS Congnito, DynamoDB, and how they are all wired to with with NESTJS to create an API backend hosted on AWS

* nestjs-api folder contains the NestJS API code inside the AWS CDK project folder
* Always navigate to this folder first for any NestJS specific commands

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
