import { connectDatabase } from "../src/config/database";
import { createServerlessApp } from "../src/serverless";

console.log("[vercel] Initializing API function");
const app = createServerlessApp({ connectDatabase });
console.log("[vercel] Express app initialized");

export default app;
