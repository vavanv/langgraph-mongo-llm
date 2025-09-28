// Custom error types for better error handling
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AgentError";
  }
}

export class ValidationError extends AgentError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 400);
    this.name = "ValidationError";
  }
}

export class ModelTimeoutError extends AgentError {
  constructor(message: string = "Model request timed out") {
    super(message, "MODEL_TIMEOUT", 504);
    this.name = "ModelTimeoutError";
  }
}

export class WorkflowError extends AgentError {
  constructor(message: string = "Workflow execution failed") {
    super(message, "WORKFLOW_ERROR", 500);
    this.name = "WorkflowError";
  }
}
