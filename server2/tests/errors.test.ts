import {
  AgentError,
  ValidationError,
  ModelTimeoutError,
  WorkflowError,
} from "../src/agent/config/errors";

describe("Error Classes", () => {
  describe("AgentError", () => {
    test("should create error with message, code, and statusCode", () => {
      const error = new AgentError("Test message", "TEST_CODE", 404);

      expect(error.message).toBe("Test message");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("AgentError");
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AgentError).toBe(true);
    });

    test("should use default statusCode of 500", () => {
      const error = new AgentError("Test message", "TEST_CODE");

      expect(error.statusCode).toBe(500);
    });

    test("should be instanceof Error", () => {
      const error = new AgentError("Test", "CODE");

      expect(error instanceof Error).toBe(true);
      expect(error instanceof AgentError).toBe(true);
    });
  });

  describe("ValidationError", () => {
    test("should create validation error with correct defaults", () => {
      const error = new ValidationError("Invalid input");

      expect(error.message).toBe("Invalid input");
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AgentError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    test("should inherit from AgentError", () => {
      const error = new ValidationError("Test");

      expect(error instanceof AgentError).toBe(true);
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.statusCode).toBe(400);
    });
  });

  describe("ModelTimeoutError", () => {
    test("should create timeout error with custom message", () => {
      const error = new ModelTimeoutError("Custom timeout message");

      expect(error.message).toBe("Custom timeout message");
      expect(error.code).toBe("MODEL_TIMEOUT");
      expect(error.statusCode).toBe(504);
      expect(error.name).toBe("ModelTimeoutError");
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AgentError).toBe(true);
      expect(error instanceof ModelTimeoutError).toBe(true);
    });

    test("should use default message when none provided", () => {
      const error = new ModelTimeoutError();

      expect(error.message).toBe("Model request timed out");
      expect(error.code).toBe("MODEL_TIMEOUT");
      expect(error.statusCode).toBe(504);
    });

    test("should inherit from AgentError", () => {
      const error = new ModelTimeoutError();

      expect(error instanceof AgentError).toBe(true);
      expect(error.code).toBe("MODEL_TIMEOUT");
      expect(error.statusCode).toBe(504);
    });
  });

  describe("WorkflowError", () => {
    test("should create workflow error with custom message", () => {
      const error = new WorkflowError("Custom workflow error");

      expect(error.message).toBe("Custom workflow error");
      expect(error.code).toBe("WORKFLOW_ERROR");
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe("WorkflowError");
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AgentError).toBe(true);
      expect(error instanceof WorkflowError).toBe(true);
    });

    test("should use default message when none provided", () => {
      const error = new WorkflowError();

      expect(error.message).toBe("Workflow execution failed");
      expect(error.code).toBe("WORKFLOW_ERROR");
      expect(error.statusCode).toBe(500);
    });

    test("should inherit from AgentError", () => {
      const error = new WorkflowError();

      expect(error instanceof AgentError).toBe(true);
      expect(error.code).toBe("WORKFLOW_ERROR");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("Error Hierarchy", () => {
    test("all error types should inherit from Error", () => {
      const agentError = new AgentError("test", "code");
      const validationError = new ValidationError("test");
      const timeoutError = new ModelTimeoutError();
      const workflowError = new WorkflowError();

      expect(agentError instanceof Error).toBe(true);
      expect(validationError instanceof Error).toBe(true);
      expect(timeoutError instanceof Error).toBe(true);
      expect(workflowError instanceof Error).toBe(true);
    });

    test("derived errors should inherit from AgentError", () => {
      const validationError = new ValidationError("test");
      const timeoutError = new ModelTimeoutError();
      const workflowError = new WorkflowError();

      expect(validationError instanceof AgentError).toBe(true);
      expect(timeoutError instanceof AgentError).toBe(true);
      expect(workflowError instanceof AgentError).toBe(true);
    });

    test("should have correct inheritance chain", () => {
      const validationError = new ValidationError("test");

      expect(validationError instanceof Error).toBe(true);
      expect(validationError instanceof AgentError).toBe(true);
      expect(validationError instanceof ValidationError).toBe(true);
    });
  });
});
