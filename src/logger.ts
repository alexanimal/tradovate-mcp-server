import fs from 'fs';
import path from 'path';

// Get directory name using process.cwd() instead of import.meta.url
const LOG_DIR = path.join(process.cwd(), 'logs');

// Log file path
const LOG_FILE = path.join(LOG_DIR, 'server.log');

// Ensure logs directory exists
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (err) {
  // Directory already exists, ignore
}

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Current log level
let currentLogLevel: LogLevel = LogLevel.INFO;

// Set log level
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

// Log message to file
function logToFile(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}\n`;
  
  fs.appendFileSync(LOG_FILE, logEntry);
}

// Logger functions
export function debug(message: string, ...args: any[]): void {
  if (currentLogLevel === LogLevel.DEBUG) {
    const formattedMessage = args.length ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}` : message;
    logToFile(LogLevel.DEBUG, formattedMessage);
  }
}

export function info(message: string, ...args: any[]): void {
  if (currentLogLevel === LogLevel.DEBUG || currentLogLevel === LogLevel.INFO) {
    const formattedMessage = args.length ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}` : message;
    logToFile(LogLevel.INFO, formattedMessage);
  }
}

export function warn(message: string, ...args: any[]): void {
  if (currentLogLevel !== LogLevel.ERROR) {
    const formattedMessage = args.length ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}` : message;
    logToFile(LogLevel.WARN, formattedMessage);
  }
}

export function error(message: string, ...args: any[]): void {
  const formattedMessage = args.length ? `${message} ${args.map(arg => JSON.stringify(arg)).join(' ')}` : message;
  logToFile(LogLevel.ERROR, formattedMessage);
}

// Console logger for critical startup messages that doesn't interfere with stdout/stderr
export function consoleError(message: string): void {
  process.stderr.write(`ERROR: ${message}\n`);
}