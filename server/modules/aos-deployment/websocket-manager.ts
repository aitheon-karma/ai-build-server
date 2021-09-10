import { Service } from 'typedi';
import { WebSocketClient } from './websocket.client';
import { DeviceInfo } from './device-info';
import { logger } from '@aitheon/core-server';

export interface DeviceMessageSender {
  logs(device: DeviceInfo, stdout: string, newLine: boolean): void;
  packageLogs(device: DeviceInfo, data: { stdout: any }): void;
  packageExit(device: DeviceInfo, data: { stdout: any, stderr: any, exitCode: number }): void;
  send(device: DeviceInfo, message: any): void;
  sendBytes(device: DeviceInfo, buffer: Buffer): void;
}

@Service()
export class WebSocketManager implements DeviceMessageSender {

  logs(device: DeviceInfo, stdout: string, newLine: boolean = true) {
    this.getWebsocketClient(device).logs(stdout, newLine);
  }

  async packageLogs(device: DeviceInfo, data: { stdout: any }) {
    this.getWebsocketClient(device).packageLogs(data);
  }

  async packageExit(device: DeviceInfo, data: { stdout: any, stderr: any, exitCode: number }) {
    this.getWebsocketClient(device).packageExit(data);
  }

  async send(device: DeviceInfo, message: any) {
    this.getWebsocketClient(device).send(message);
  }

  async sendBytes(device: DeviceInfo, buffer: Buffer) {
    this.getWebsocketClient(device).sendBytes(buffer);
  }

  async createWebsocketClient(device: DeviceInfo) {
    if (!this.websocketsMap.has(device._id)) {
      this.websocketsMap.set(device._id, new WebSocketClient(device));
    } else {
      logger.info(`Websocket connection for device: ${device._id} already exists`);
    }
  }

  hasConnectionToDevice(deviceId: string): boolean {
    return this.websocketsMap.has(deviceId);
  }

  getWebsocketClient(device: DeviceInfo): WebSocketClient {
    let websocketClient = this.websocketsMap.get(device._id);
    if (!websocketClient) {
      logger.info(`Websocket connection with device: ${device._id} doesn't exist. Create a new one.`);
      websocketClient = new WebSocketClient(device);
      this.websocketsMap.set(device._id, websocketClient);
    }
    return websocketClient;
  }

  removeWebsocketClient(deviceId: string) {
    this.websocketsMap.delete(deviceId);
  }

  private websocketsMap: Map<string, WebSocketClient> = new Map();
}