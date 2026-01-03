#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { WebSocketStack } from '../lib/websocket-stack';

const app = new cdk.App();
new WebSocketStack(app, 'RealtimeTranscriptionWsStack');
