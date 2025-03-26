/**
 * Global teardown for Jest tests
 * This file runs once after all tests complete
 */

module.exports = async () => {
  // Clean up any remaining timers
  if (global._activeTimers && global._activeTimers.size > 0) {
    console.log(`Cleaning up ${global._activeTimers.size} active timers`);
    for (const id of global._activeTimers) {
      global._originalClearTimeout(id);
    }
    global._activeTimers.clear();
  }

  // Restore original timer functions
  if (global._originalSetTimeout) {
    global.setTimeout = global._originalSetTimeout;
    global.setInterval = global._originalSetInterval;
    global.clearTimeout = global._originalClearTimeout;
    global.clearInterval = global._originalClearInterval;
  }

  // Restore console.error if we overrode it
  if (global._originalConsoleError) {
    console.error = global._originalConsoleError;
  }

  // Force garbage collection if available (Node.js with --expose-gc flag)
  if (global.gc) {
    global.gc();
  }

  // Return a message to indicate teardown is complete
  return 'Global teardown complete';
}; 