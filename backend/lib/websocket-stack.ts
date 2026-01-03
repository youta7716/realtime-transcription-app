import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class WebSocketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // S3バケット追加
    const audioBucket = new s3.Bucket(this, 'AudioBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY, // PoC用途。運用時は慎重に設定
      autoDeleteObjects: true, // PoC用途。運用時は慎重に設定
    });

    const wsHandler = new lambda.Function(this, 'WsHandler', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'app.handler',
      code: lambda.Code.fromAsset('../backend/lambda/ws_handler'),
      environment: {
        AUDIO_BUCKET_NAME: audioBucket.bucketName,
      },
      timeout: cdk.Duration.minutes(1),
      memorySize: 512,
    });

    // LambdaからS3へのアクセス権限付与
    audioBucket.grantReadWrite(wsHandler);

    const api = new apigwv2.WebSocketApi(this, 'WebSocketApi', {
      connectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          'ConnectIntegration',
          wsHandler
        ),
      },
      disconnectRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          'DisconnectIntegration',
          wsHandler
        ),
      },
      defaultRouteOptions: {
        integration: new integrations.WebSocketLambdaIntegration(
          'DefaultIntegration',
          wsHandler
        ),
      },
    });

    new apigwv2.WebSocketStage(this, 'DevStage', {
      webSocketApi: api,
      stageName: 'dev',
      autoDeploy: true,
    });
  }
}
