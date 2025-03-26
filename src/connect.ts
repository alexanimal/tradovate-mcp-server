import WebSocket from 'ws';
import { getTradovateMdApiUrl, isTokenValid, getAccessToken } from './auth.js';
import * as logger from './logger.js';

function prepareMsg(raw: any) {
    logger.info(`Preparing message: ${raw}`);

    // const T = raw.slice(0, 1)
    // let payload = null
    // const data = raw.slice(1)
    // if(data) {
    //     payload = JSON.parse(data)
    // }
    return [null, null]
}

export function connect(ws: WebSocket): Promise<WebSocket> {
    logger.info('Connecting to Tradovate Websocket...');
    
    return new Promise((resolve, reject) => {
        // Set a connection timeout to prevent hanging
        const timeoutId = setTimeout(() => {
            reject(new Error('WebSocket connection timeout after 15 seconds'));
        }, 15000);
        
        // Handle successful connection
        ws.on('open', () => {
            logger.info('Opened connection to Tradovate Websocket');
            clearTimeout(timeoutId);
            
            // Set up message handler
            ws.on('message', async (message) => {
                try {
                    logger.info(`Receiving message from Tradovate Websocket: ${message.toString()}`);
                    const { accessToken, expiresAt } = await getAccessToken();
                    logger.info(`Access token: ${accessToken.substring(0, 10)}..., Expires at: ${expiresAt}, isTokenValid: ${isTokenValid(expiresAt)}`);
                    const [T, data] = prepareMsg((message as any).data!);
                } catch (error) {
                    logger.error('Error processing WebSocket message:', error);
                }
            });
            
            // Connection is ready, resolve promise
            resolve(ws);
        });
        
        // Handle connection errors
        ws.on('error', (error) => {
            logger.error('WebSocket connection error:', error);
            clearTimeout(timeoutId);
            reject(error);
        });
        
        // Handle connection close
        ws.on('close', (code, reason) => {
            logger.info(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
        });
    });
}

export function teardown(ws: WebSocket) {
    ws.close();
}

export async function query(ws: WebSocket, endpoint: string, data?: any) {
    return new Promise((resolve, reject) => {
        try {
            logger.info(`Sending message to ${endpoint}: ${JSON.stringify(data)}`);
            
            // Create a one-time message handler to receive the response
            const messageHandler = (message: WebSocket.MessageEvent) => {
                try {
                    const messageData = message.toString();
                    logger.info(`Received response from ${endpoint}: ${messageData}`);
                    ws.removeListener('message', messageHandler);
                    
                    // Try to parse JSON response
                    try {
                        const jsonData = JSON.parse(messageData);
                        resolve(jsonData);
                    } catch (parseError) {
                        // If not valid JSON, return as string
                        resolve(messageData);
                    }
                } catch (error) {
                    logger.error(`Error processing WebSocket response: ${error}`);
                    reject(error);
                }
            };
            
            // Add a timeout to prevent hanging
            const timeoutId = setTimeout(() => {
                ws.removeListener('message', messageHandler);
                reject(new Error(`Request to ${endpoint} timed out after 10 seconds`));
            }, 10000);
            
            // Add message handler
            ws.addListener('message', messageHandler);
            
            // Send the actual request
            ws.send(`${endpoint}${data ? '\n' + JSON.stringify(data) : ''}`);
            
            // Handle errors
            ws.once('error', (error) => {
                clearTimeout(timeoutId);
                ws.removeListener('message', messageHandler);
                reject(error);
            });
            
            // Handle close
            ws.once('close', () => {
                clearTimeout(timeoutId);
                ws.removeListener('message', messageHandler);
                reject(new Error('WebSocket closed before response was received'));
            });
        } catch (error) {
            logger.error(`Error querying WebSocket: ${error}`);
            reject(error);
        }
    });
}
