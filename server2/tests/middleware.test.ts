import { Request, Response, NextFunction } from "express";
import {
  requestLogger,
  corsMiddleware,
  responseFormatter,
  errorHandler,
} from "../src/middleware";

// Mock the logger
jest.mock("../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { logger } from "../src/utils/logger";

describe("Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      method: "GET",
      url: "/test",
      ip: "127.0.0.1",
      get: jest.fn().mockImplementation((header: string) => {
        if (header === "User-Agent") return "test-agent";
        return undefined;
      }) as any,
      body: { test: "data" },
    };

    mockRes = {
      statusCode: 200,
      on: jest.fn().mockImplementation((event: string, callback: Function) => {
        if (event === "finish") {
          callback();
        }
      }) as any,
      header: jest.fn(),
      sendStatus: jest.fn(),
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe("requestLogger", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test("should log request details", () => {
      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith("GET /test", {
        ip: "127.0.0.1",
        userAgent: "test-agent",
        body: undefined, // GET request, so body should be undefined
      });

      expect(mockNext).toHaveBeenCalled();
    });

    test("should log request body for non-GET methods", () => {
      mockReq.method = "POST";

      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith("POST /test", {
        ip: "127.0.0.1",
        userAgent: "test-agent",
        body: JSON.stringify({ test: "data" }),
      });
    });

    test("should log response when finished", () => {
      // Mock the 'on' method to simulate response finish
      (mockRes.on as jest.Mock).mockImplementation((event, callback) => {
        if (event === "finish") {
          // Simulate response finish after some time
          jest.advanceTimersByTime(100);
          callback();
        }
      });

      requestLogger(mockReq as Request, mockRes as Response, mockNext);

      expect(logger.info).toHaveBeenCalledWith("GET /test 200 - 100ms", {
        statusCode: 200,
        duration: 100,
      });
    });
  });

  describe("corsMiddleware", () => {
    test("should set CORS headers for regular requests", () => {
      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "*"
      );
      expect(mockRes.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      expect(mockRes.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.sendStatus).not.toHaveBeenCalled();
    });

    test("should handle OPTIONS preflight requests", () => {
      mockReq.method = "OPTIONS";

      corsMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "*"
      );
      expect(mockRes.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      expect(mockRes.header).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      expect(mockRes.sendStatus).toHaveBeenCalledWith(200);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("responseFormatter", () => {
    test("should override res.json method", () => {
      const originalJson = jest.fn();
      mockRes.json = originalJson;

      responseFormatter(mockReq as Request, mockRes as Response, mockNext);

      expect(typeof mockRes.json).toBe("function");
      expect(mockNext).toHaveBeenCalled();
    });

    test("should call original json for API routes", () => {
      const originalJson = jest.fn();
      mockRes.json = originalJson;

      mockReq.url = "/chat";

      responseFormatter(mockReq as Request, mockRes as Response, mockNext);

      const newJson = mockRes.json;
      newJson({ test: "data" });

      expect(originalJson).toHaveBeenCalledWith({ test: "data" });
    });

    test("should call original json for health routes", () => {
      const originalJson = jest.fn();
      mockRes.json = originalJson;

      mockReq.url = "/health";

      responseFormatter(mockReq as Request, mockRes as Response, mockNext);

      const newJson = mockRes.json;
      newJson({ status: "healthy" });

      expect(originalJson).toHaveBeenCalledWith({ status: "healthy" });
    });

    test("should call original json for other routes", () => {
      const originalJson = jest.fn();
      mockRes.json = originalJson;

      mockReq.url = "/other";

      responseFormatter(mockReq as Request, mockRes as Response, mockNext);

      const newJson = mockRes.json;
      newJson({ message: "test" });

      expect(originalJson).toHaveBeenCalledWith({ message: "test" });
    });
  });

  describe("errorHandler", () => {
    test("should log error and return generic message in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const testError = new Error("Test error");

      errorHandler(
        testError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith("Unhandled error:", testError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: "Something went wrong",
      });

      process.env.NODE_ENV = originalEnv;
    });

    test("should include error details in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const testError = new Error("Test error message");

      errorHandler(
        testError,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith("Unhandled error:", testError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: "Test error message",
      });

      process.env.NODE_ENV = originalEnv;
    });

    test("should handle non-Error objects", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const testError = "String error";

      errorHandler(
        testError as any,
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(logger.error).toHaveBeenCalledWith("Unhandled error:", testError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Internal server error",
        message: undefined, // String objects don't have a message property
      });

      process.env.NODE_ENV = originalEnv;
    });
  });
});
