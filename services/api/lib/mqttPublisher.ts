import mqtt, { IClientOptions } from 'mqtt';
import { CommandPayload } from '@smart-terrarium/shared-types';
import dotenv from 'dotenv';
import { sanitizeCommandPayload } from './mistSafety';

dotenv.config();

type MqttProtocol = 'mqtt' | 'mqtts';

function parseMqttProtocol(raw: string | undefined): MqttProtocol {
  if (!raw) return 'mqtts';
  return raw.trim().toLowerCase() === 'mqtt' ? 'mqtt' : 'mqtts';
}

function buildMqttOptions(
  protocol: MqttProtocol,
  username: string,
  password: string,
  caCert: string | undefined,
): IClientOptions {
  const options: IClientOptions = {
    clientId: `api-publisher-${Math.random().toString(16).slice(2, 8)}`,
    rejectUnauthorized: protocol === 'mqtts',
    reconnectPeriod: 0,
    connectTimeout: 5000,
  };

  if (username) {
    options.username = username;
  }

  if (password) {
    options.password = password;
  }

  if (protocol === 'mqtts' && caCert) {
    options.ca = caCert;
  }

  return options;
}

export async function publishCommand(deviceId: string, payload: CommandPayload): Promise<void> {
  const protocol = parseMqttProtocol(process.env.MQTT_PROTOCOL);
  const host = process.env.MQTT_BROKER || '';
  const defaultPort = protocol === 'mqtts' ? '8883' : '1883';
  const port = process.env.MQTT_PORT || defaultPort;
  const username = process.env.MQTT_USER || '';
  const password = process.env.MQTT_PASS || '';
  const caCert = process.env.MQTT_CA_CERT?.replace(/\\n/g, '\n');

  if (!host) {
    throw new Error('Missing MQTT configuration. Check MQTT_BROKER.');
  }

  const client = mqtt.connect(
    `${protocol}://${host}:${port}`,
    buildMqttOptions(protocol, username, password, caCert),
  );

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.end(true);
      reject(new Error('MQTT publish timeout'));
    }, 5000);

    client.on('connect', () => {
      const topic = `terrarium/commands/${deviceId}`;
      const message = JSON.stringify(sanitizeCommandPayload(payload));

      client.publish(topic, message, { qos: 1 }, (err) => {
        clearTimeout(timeout);
        client.end();
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      client.end(true);
      reject(err);
    });
  });
}
