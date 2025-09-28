// Configuration constants
export const CONFIG = {
  // Timeout values (in milliseconds)
  MODEL_TIMEOUT: 10000,
  WORKFLOW_TIMEOUT: 30000,

  // Retry configuration
  MAX_MODEL_RETRIES: 3,
  MAX_WORKFLOW_RETRIES: 2,
  RETRY_FACTOR: 2,
  RETRY_MIN_TIMEOUT: 1000,
  RETRY_MAX_TIMEOUT: 5000,

  // Workflow limits
  RECURSION_LIMIT: 5,
  MAX_QUERY_LENGTH: 1000,
  MAX_THREAD_ID_LENGTH: 100,
} as const;
