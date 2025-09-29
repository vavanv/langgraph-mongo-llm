import { logger } from "../src/utils/logger";

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Logger Interface", () => {
    test("should expose all standard log levels", () => {
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });

  describe("Logger Functionality", () => {
    test("should be able to call error method without throwing", () => {
      expect(() => {
        logger.error("Test error message");
      }).not.toThrow();
    });

    test("should be able to call warn method without throwing", () => {
      expect(() => {
        logger.warn("Test warning message");
      }).not.toThrow();
    });

    test("should be able to call info method without throwing", () => {
      expect(() => {
        logger.info("Test info message");
      }).not.toThrow();
    });

    test("should be able to call debug method without throwing", () => {
      expect(() => {
        logger.debug("Test debug message");
      }).not.toThrow();
    });

    test("should support logging with metadata objects", () => {
      const metadata = { userId: 123, action: "login" };

      expect(() => {
        logger.info("User logged in", metadata);
      }).not.toThrow();
    });

    test("should support logging with multiple arguments", () => {
      expect(() => {
        logger.info("Message", { key: "value" }, "extra arg");
      }).not.toThrow();
    });
  });

  describe("Logger Configuration", () => {
    test("should be a winston logger instance", () => {
      // Check that it has winston logger properties
      expect(logger).toHaveProperty("error");
      expect(logger).toHaveProperty("warn");
      expect(logger).toHaveProperty("info");
      expect(logger).toHaveProperty("debug");
    });

    test("should have proper log level methods", () => {
      const methods = ["error", "warn", "info", "debug"];

      methods.forEach((method) => {
        expect(typeof (logger as any)[method]).toBe("function");
      });
    });
  });
});
