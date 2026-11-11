import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import ApprovalConfig from "../src/models/ApprovalConfig.js";
import Role from "../src/models/Role.js";

const seedApprovalConfig = async () => {
  const manager = await Role.findOne({ name: "sales_manager" });
  const finance = await Role.findOne({ name: "finance" });
  const admin = await Role.findOne({ name: "admin" });

  if (!manager || !finance || !admin) {
    throw new Error("Required approval roles not found");
  }

  await ApprovalConfig.findOneAndUpdate(
    { name: "discount_approval" },
    {
      name: "discount_approval",
      bands: [
        {
          minDiscount: 0,
          maxDiscount: 10,
          autoApprove: true,
          steps: [],
        },
        {
          minDiscount: 10,
          maxDiscount: 25,
          autoApprove: false,
          steps: [{ roleId: manager._id, order: 1 }],
        },
        {
          minDiscount: 25,
          maxDiscount: 40,
          autoApprove: false,
          steps: [
            { roleId: manager._id, order: 1 },
            { roleId: finance._id, order: 2 },
          ],
        },
        {
          minDiscount: 40,
          maxDiscount: 100,
          autoApprove: false,
          steps: [
            { roleId: manager._id, order: 1 },
            { roleId: finance._id, order: 2 },
            { roleId: admin._id, order: 3 },
          ],
        },
      ],
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );

  console.log("Approval configuration seeded successfully");
};

export default seedApprovalConfig;


const runApprovalConfigSeed = async () => {
  try {
    await connectDB();

    await seedApprovalConfig();

    console.log("Approval configuration completed!");
  } catch (error) {
    console.error("Approval configuration failed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

runApprovalConfigSeed();
