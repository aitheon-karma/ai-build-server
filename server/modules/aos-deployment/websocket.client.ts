import * as Websocket from 'websocket';
import { WebSocketOptions } from './websocket-options';
import * as events from 'events';
import { DeviceInfo } from './device-info';


/**
 * Websocket client
 */
export class WebSocketClient extends events.EventEmitter {

  client!: Websocket.client;
  connection?: Websocket.connection;
  reconnectTime: number = 5; // seconds
  reconnectTimeout?: NodeJS.Timer;
  isDeviceSimulator?: boolean;

  device: DeviceInfo;
  options!: WebSocketOptions;

  constructor(device: DeviceInfo) {
    super();

    this.device = device;
    this.options = new WebSocketOptions();

    this.init();
  }

  private connect() {
    const url = `${ this.options.secure ? 'wss' : 'ws'}://${ this.options.domain }/device-manager`;
    this.isDeviceSimulator = !!this.device.serialNumber;
    if (!this.isDeviceSimulator) {
      return this.logs('Running without device.');
    }
    this.logs(`connecting to: ${ url }; SimulatorId: ${ this.options.simulator._id }`);
    this.client.connect(url, 'aos-protocol-simulator', undefined, { 'token': this.device.aosToken, 'simulator-id': this.options.simulator._id });
  }

  /**
   * Connect to device manager
   */
  private init() {
    this.client = new Websocket.client({
      maxReceivedMessageSize: this.options.maxMessageSize,
      maxReceivedFrameSize: 512000,
      fragmentationThreshold: 512000 // 512Kb
    });

    this.connect();

    this.client.on('connectFailed', (err: any) => {
      this.logs(`Connect Error: ${ JSON.stringify(err) }`);
      this.reconnect();
    });

    this.client.on('connect', (conn: Websocket.connection) => {

      this.connection = conn;
      this.logs(`Client Connected. Serial Number: ${ this.device.serialNumber };`);

      // this.sendResponseMessage(`Service UP.`, 'INFO');
      // this.servicesDetail({ namespace: 'aos-system' });

      if (this.reconnectTimeout) {
        clearInterval(this.reconnectTimeout);
      }
      this.reconnectTimeout = undefined;

      this.connection.on('error', (err: any) => {
        this.logs(`Connection Error: ${ JSON.stringify(err) }`);
      });
      this.connection.on('close', (reasonCode, description) => {
        this.logs(`Connection Closed; ${ reasonCode } ${ description}`, );
        this.reconnect();
      });
      this.connection.on('message', (message: any) => {
        if (message.type === 'utf8') {
          const body = JSON.parse(message.utf8Data);
          this.parseMessage(body);
        }
      });
    });
  }

  private reconnect() {
    this.connection = undefined;
    // prevent double reconnect
    if (this.reconnectTimeout) {
      return;
    }
    this.logs(`Waiting reconnect in ${ this.reconnectTime } seconds`);
    this.reconnectTimeout = setTimeout(() => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      this.reconnectTimeout = undefined;
      if (this.connection && this.connection.state === 'closed' || !this.connection) {
        this.logs('Reconnecting...');
        this.connect();
      }
    }, this.reconnectTime * 1000);
  }

  private parseMessage(body: { type: string, data: any, clientId: string }) {
    const data = body.data;
    switch (body.type) {
      case 'PACKAGE.LOGS':
        this.packageLogs(data);
        break;
      case 'PACKAGE.EXIT':
        this.packageExit(data);
      case 'PACKAGE.STOPED':
        this.logs('Package stopped.');
        break;
      default:
        this.logs('Message not supported');
        break;
    }
  }

  logs(stdout: string, newLine: boolean = true) {
    this.emit('LOGS', newLine ? `${ stdout }\r\n` : stdout);
  }

  async packageLogs(data: { stdout: any }) {
    this.emit('PACKAGE.LOGS', data.stdout);
  }

  async packageExit(data: { stdout: any, stderr: any, exitCode: number }) {
    this.logs(data.stdout);
    this.logs(`EXIT Code: ${ data.exitCode}`);
  }

  async send(message: any) {
    try {
      if (this.connection && this.connection.connected) {
        this.connection.sendUTF(JSON.stringify(message));
      } else {
        this.logs(`Waiting for connection to send`);
        setTimeout(() => {
          return this.send(message);
        }, (this.reconnectTime + 1) * 1000);
      }
    } catch (err) {
      console.error('[send]', err);
    }
    // console.debug(`Sending [${ message.type }] to [${ message.clientId }]`);
  }

  async sendBytes(buffer: Buffer) {
    try {
     if (this.connection && this.connection.connected) {
      this.connection.sendBytes(buffer);
     } else {
      this.logs(`Waiting for connection to send package`);
      setTimeout(() => {
        return this.sendBytes(buffer);
      }, (this.reconnectTime + 1) * 1000);
     }
    } catch (err) {
      console.error('[sendBytes]', err);
    }
  }
}
