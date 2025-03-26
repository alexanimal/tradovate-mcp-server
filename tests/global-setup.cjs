/**
 * Global setup for Jest tests
 * This file runs once before all tests start
 */

module.exports = async () => {
  // Track unhandled promises in the global scope
  process.on('unhandledRejection', (reason, promise) => {
    console.warn('Unhandled Rejection during tests:', reason);
  });

  // Prevent unnecessary warnings from WebSocket
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Filter out specific WebSocket-related errors when they're expected in tests
    const errStr = args.length > 0 ? String(args[0]) : '';
    if (
      errStr.includes('ECONNREFUSED') ||
      errStr.includes('WebSocket') ||
      errStr.includes('TLSWRAP') ||
      errStr.includes('HTTPCLIENTREQUEST')
    ) {
      // These are expected in tests where we're not actually connecting
      return;
    }
    originalConsoleError(...args);
  };

  // Store the original timer functions
  global._originalSetTimeout = global.setTimeout;
  global._originalSetInterval = global.setInterval;
  global._originalClearTimeout = global.clearTimeout;
  global._originalClearInterval = global.clearInterval;

  // Keep track of active timers for cleanup
  global._activeTimers = new Set();

  // Override setTimeout to track timers
  global.setTimeout = (fn, ms, ...args) => {
    const timerId = global._originalSetTimeout(fn, ms, ...args);
    global._activeTimers.add(timerId);
    return timerId;
  };

  // Override clearTimeout to remove from tracking
  global.clearTimeout = (id) => {
    global._activeTimers.delete(id);
    return global._originalClearTimeout(id);
  };

  // Return a message to indicate setup is complete
  return 'Global setup complete';
}; 