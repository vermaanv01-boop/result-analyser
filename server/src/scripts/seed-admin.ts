import bcrypt from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../config/database";
import { User } from "../models/user.model";

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@karvaan.org";
  const password = process.env.ADMIN_PASSWORD || "Admin@Karvaan2026!";
  const name = process.env.ADMIN_NAME || "KARVAAN Administrator";

  console.log(`[seed] Connecting to database...`);
  await connectDatabase();

  try {
    const existing = await User.findOne({ email });
    const passwordHash = await bcrypt.hash(password, 10);

    if (existing) {
      existing.name = name;
      existing.passwordHash = passwordHash;
      existing.role = "admin";
      existing.isActive = true;
      await existing.save();
      console.log(`[seed] Updated existing administrator user: ${email}`);
    } else {
      await User.create({
        name,
        email,
        passwordHash,
        role: "admin",
        isActive: true,
      });
      console.log(`[seed] Created initial administrator user: ${email}`);
    }

    console.log(`[seed] Admin provisioning complete. You can now log in at /login`);
  } catch (err) {
    console.error(`[seed] Failed to provision admin:`, err);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

seedAdmin();
