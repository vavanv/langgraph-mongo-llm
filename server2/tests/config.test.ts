import { CONFIG } from "../src/agent/config/config";

describe("Config", () => {
  test("should have all required configuration values", () => {
    expect(CONFIG.DATABASE_NAME).toBe("hr_database");
    expect(CONFIG.MODEL_TIMEOUT).toBeGreaterThan(0);
    expect(CONFIG.WORKFLOW_TIMEOUT).toBeGreaterThan(0);
    expect(CONFIG.MAX_MODEL_RETRIES).toBeGreaterThan(0);
    expect(CONFIG.MAX_WORKFLOW_RETRIES).toBeGreaterThan(0);
    expect(CONFIG.RECURSION_LIMIT).toBeGreaterThan(0);
    expect(CONFIG.MAX_QUERY_LENGTH).toBeGreaterThan(0);
    expect(CONFIG.MAX_THREAD_ID_LENGTH).toBeGreaterThan(0);
  });

  test("should have reasonable timeout values", () => {
    expect(CONFIG.MODEL_TIMEOUT).toBe(10000); // 10 seconds
    expect(CONFIG.WORKFLOW_TIMEOUT).toBe(30000); // 30 seconds
  });

  test("should have reasonable retry configuration", () => {
    expect(CONFIG.MAX_MODEL_RETRIES).toBe(3);
    expect(CONFIG.MAX_WORKFLOW_RETRIES).toBe(2);
    expect(CONFIG.RETRY_FACTOR).toBe(2);
    expect(CONFIG.RETRY_MIN_TIMEOUT).toBe(1000);
    expect(CONFIG.RETRY_MAX_TIMEOUT).toBe(5000);
  });

  test("should have reasonable limits", () => {
    expect(CONFIG.RECURSION_LIMIT).toBe(5);
    expect(CONFIG.MAX_QUERY_LENGTH).toBe(1000);
    expect(CONFIG.MAX_THREAD_ID_LENGTH).toBe(100);
  });
});
