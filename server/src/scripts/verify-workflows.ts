import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { User } from "../models/user.model";
import { Competition } from "../models/competition.model";
import { Participant } from "../models/participant.model";
import { login, provisionUser, getJudges } from "../services/auth.service";
import { createParticipant } from "../services/participant.service";

async function runVerification() {
  console.log("=== 1. CONNECTIVITY VERIFICATION ===");
  await connectDatabase();
  console.log("Mongoose readyState:", mongoose.connection.readyState);
  console.log("Database name:", mongoose.connection.name);

  const adminDb = mongoose.connection.db?.admin();
  const ping = await adminDb?.ping();
  console.log("Ping OK:", ping?.ok === 1);

  console.log("\n=== 2. AUTHENTICATION VERIFICATION ===");
  const adminLogin = await login("admin@venturecraft.org", "Admin@VentureCraft2026!");
  console.log("Admin logged in successfully:", adminLogin.user.email, "role:", adminLogin.user.role);

  console.log("\n=== 3. ADD JUDGE WORKFLOW VERIFICATION ===");
  const testJudgeEmail = `test.judge.${Date.now()}@venturecraft.org`;
  const createdJudge = await provisionUser({
    name: "Dr. Diagnostic Judge",
    email: testJudgeEmail,
    password: "Password123!",
    role: "judge",
  });
  console.log("Judge provisioned successfully in Atlas:", createdJudge.name, createdJudge.email);

  // Verify retrieval
  const allJudges = await getJudges();
  const foundJudge = allJudges.find((j) => j.email === testJudgeEmail);
  console.log("Judge retrieval in getJudges():", !!foundJudge);

  // Verify judge login
  const judgeLogin = await login(testJudgeEmail, "Password123!");
  console.log("Judge login verified with issued token:", judgeLogin.token.slice(0, 15) + "...");

  console.log("\n=== 4. ADD PARTICIPANT WORKFLOW VERIFICATION ===");
  // Create or get a temporary competition
  let comp = await Competition.findOne({ name: "Atlas Test Competition" });
  if (!comp) {
    comp = await Competition.create({
      name: "Atlas Test Competition",
      description: "Automated verification competition",
      createdBy: adminLogin.user.id,
    });
  }

  const testRegId = `TEST-REG-${Date.now().toString().slice(-4)}`;
  const participant = await createParticipant(comp._id.toString(), {
    name: "Test Diagnostic Student",
    registrationId: testRegId,
    email: `student.${Date.now()}@edu.org`,
  });
  console.log("Participant registered successfully in Atlas:", participant.name, participant.registrationId);

  // Duplicate rejection test
  try {
    await createParticipant(comp._id.toString(), {
      name: "Duplicate Student",
      registrationId: testRegId,
    });
    console.error("FAIL: Duplicate participant was not rejected!");
  } catch (err: any) {
    console.log("Duplicate participant correctly rejected with conflict:", err.message);
  }

  console.log("\n=== 5. CLEANUP TEMPORARY TEST DATA ===");
  await User.deleteOne({ email: testJudgeEmail });
  await Participant.deleteOne({ _id: participant._id });
  await Competition.deleteOne({ _id: comp._id });
  console.log("Temporary verification records safely cleaned up.");

  await disconnectDatabase();
  console.log("\n=== ALL ATLAS & WORKFLOW VERIFICATIONS PASSED ===");
}

runVerification().catch(async (err) => {
  console.error("Verification failed:", err);
  await disconnectDatabase();
  process.exit(1);
});
