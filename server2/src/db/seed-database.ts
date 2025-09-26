import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { QdrantClient } from "@qdrant/js-client-rest";
import { MongoClient } from "mongodb";
import { z } from "zod";
import "dotenv/config";

const client = new MongoClient(process.env.MONGODB_ATLAS_URI as string);

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  apiKey: process.env.OPENAI_API_KEY,
});

const EmployeeSchema = z.object({
  employee_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  date_of_birth: z.string(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
    country: z.string(),
  }),
  contact_details: z.object({
    email: z.string().email(),
    phone_number: z.string(),
  }),
  job_details: z.object({
    job_title: z.string(),
    department: z.string(),
    hire_date: z.string(),
    employment_type: z.string(),
    salary: z.number(),
    currency: z.string(),
  }),
  work_location: z.object({
    nearest_office: z.string(),
    is_remote: z.boolean(),
  }),
  reporting_manager: z.string().nullable(),
  skills: z.array(z.string()),
  performance_reviews: z.array(
    z.object({
      review_date: z.string(),
      rating: z.number(),
      comments: z.string(),
    })
  ),
  benefits: z.object({
    health_insurance: z.string(),
    retirement_plan: z.string(),
    paid_time_off: z.number(),
  }),
  emergency_contact: z.object({
    name: z.string(),
    relationship: z.string(),
    phone_number: z.string(),
  }),
  notes: z.string(),
});

type Employee = z.infer<typeof EmployeeSchema>;

const parser = new JsonOutputParser();

async function generateSyntheticData(): Promise<Employee[]> {
  const prompt = `You are a helpful assistant that generates employee data. Generate 20 fictional employee records with EXACTLY these field structures:

Each employee must have:
- employee_id: string (like "E001")
- first_name: string
- last_name: string
- date_of_birth: string (YYYY-MM-DD format)
- address: object with {street: string, city: string, state: string, postal_code: string, country: string}
- contact_details: object with {email: string, phone_number: string}
- job_details: object with {job_title: string, department: string, hire_date: string (YYYY-MM-DD), employment_type: string, salary: number, currency: string}
- work_location: object with {nearest_office: string, is_remote: boolean}
- reporting_manager: string or null
- skills: array of strings
- performance_reviews: array of objects with {review_date: string (YYYY-MM-DD), rating: number, comments: string}
- benefits: object with {health_insurance: string, retirement_plan: string, paid_time_off: number}
- emergency_contact: object with {name: string, relationship: string, phone_number: string}
- notes: string

Ensure variety in departments, job titles, and realistic values. Return ONLY a valid JSON array of employee objects with no additional text or formatting.`;

  console.log("Generating synthetic data...");

  const response = await llm.invoke(prompt);
  const content = response.content as string;

  // Extract JSON from markdown code blocks if present
  let jsonString = content;
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonString = jsonMatch[1];
  } else {
    // Try to find JSON array directly
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonString = arrayMatch[0];
    }
  }

  // Parse the JSON response
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse LLM response as JSON:", error);
    console.error("Extracted content:", jsonString);
    console.error("Raw content:", content);
    throw new Error("LLM did not return valid JSON");
  }

  return z.array(EmployeeSchema).parse(parsed);
}

async function createEmployeeSummary(employee: Employee): Promise<string> {
  return new Promise((resolve) => {
    const jobDetails = `${employee.job_details.job_title} in ${employee.job_details.department}`;
    const skills = employee.skills.join(", ");
    const performanceReviews = employee.performance_reviews
      .map(
        (review) =>
          `Rated ${review.rating} on ${review.review_date}: ${review.comments}`
      )
      .join(" ");
    const basicInfo = `${employee.first_name} ${employee.last_name}, born on ${employee.date_of_birth}`;
    const workLocation = `Works at ${employee.work_location.nearest_office}, Remote: ${employee.work_location.is_remote}`;
    const notes = employee.notes;

    const summary = `${basicInfo}. Job: ${jobDetails}. Skills: ${skills}. Reviews: ${performanceReviews}. Location: ${workLocation}. Notes: ${notes}`;

    resolve(summary);
  });
}

async function seedDatabase(): Promise<void> {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    const db = client.db("hr_database");
    const collection = db.collection("employees");

    await collection.deleteMany({});

    const syntheticData = await generateSyntheticData();

    // Store full employee data in MongoDB
    await collection.insertMany(syntheticData);
    console.log("Employee data stored in MongoDB");

    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings();

    // Initialize Qdrant client
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
      apiKey: process.env.QDRANT_API_KEY,
    });

    // Create collection if it doesn't exist
    try {
      await qdrantClient.createCollection("employees", {
        vectors: { size: 1536, distance: "Cosine" }, // OpenAI embeddings are 1536 dimensions
      });
    } catch (error) {
      // Collection might already exist
      console.log("Collection might already exist:", error);
    }

    // Prepare points for Qdrant
    const points = [];
    for (let i = 0; i < syntheticData.length; i++) {
      const record = syntheticData[i];
      const summary = await createEmployeeSummary(record);
      const embedding = await embeddings.embedQuery(summary);

      points.push({
        id: i + 1, // Use index as ID
        vector: embedding,
        payload: {
          employee_id: record.employee_id,
          summary: summary,
        },
      });
    }

    // Upsert points to Qdrant
    await qdrantClient.upsert("employees", { points });

    console.log("Vector data stored in Qdrant");
    console.log("Database seeding completed");
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await client.close();
  }
}

seedDatabase().catch(console.error);
