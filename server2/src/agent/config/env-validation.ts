export function validateEnvironmentVariables() {
  const requiredVars = [
    "MONGODB_ATLAS_URI",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "QDRANT_URL",
    "QDRANT_API_KEY",
  ];

  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  console.log("Environment variables validated successfully");
}
