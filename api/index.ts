import express from "express";
import { registerApiRoutes } from "../server/routes.js";

const app = express();

// Register the API routes under /api
registerApiRoutes(app);

// Export the Express app for Vercel Serverless
export default app;
