
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import Branch from "../src/models/Branch.js";
import Role from "../src/models/Role.js";
import User from "../src/models/User.js";
import Customer from "../src/models/Customer.js";
import Product from "../src/models/Product.js";
import seedApprovalConfig from "./approvalConfig.js";

const seedDatabase = async () => {
  try {
    await connectDB();

    // 1. Create branches
    const branches = await Promise.all([
      Branch.findOneAndUpdate(
        { code: "KOC" },
        {
          $set: {
            name: "Kochi Branch",
            location: "Kochi",
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      ),

      Branch.findOneAndUpdate(
        { code: "BLR" },
        {
          $set: {
            name: "Bangalore Branch",
            location: "Bangalore",
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      ),
    ]);

    const [kochiBranch, bangaloreBranch] = branches;

    // 2. Create roles with permissions
    const roleData = [
      {
        name: "sales_exec",
        permissions: ["deal.view", "deal.edit", "chat.send"],
        dataScope: "own",
      },
      {
        name: "sales_manager",
        permissions: [
          "deal.view",
          "deal.edit",
          "discount.approve",
          "chat.send",
        ],
        dataScope: "branch",
      },
      {
        name: "finance",
        permissions: [
          "deal.view",
          "discount.approve",
          "invoice.issue",
          "invoice.cancel",
          "chat.send",
        ],
        dataScope: "all",
      },
      {
        name: "admin",
        permissions: [
          "deal.view",
          "deal.edit",
          "discount.approve",
          "invoice.issue",
          "invoice.cancel",
          "chat.send",
        ],
        dataScope: "all",
      },
    ];

    const roles = {};

    for (const role of roleData) {
      roles[role.name] = await Role.findOneAndUpdate(
        { name: role.name },
        { $set: role },
        { upsert: true, new: true, runValidators: true }
      );
    }

    // 3. Hash sample users' passwords
    const hashedPassword = await bcrypt.hash("Demo@12345", 10);

    // 4. Create five sample users
    const users = [
      {
        name: "Alice",
        email: "alice@dealdesk.com",
        branchId: kochiBranch._id,
        roleId: roles.sales_exec._id,
      },
      {
        name: "Bob",
        email: "bob@dealdesk.com",
        branchId: bangaloreBranch._id,
        roleId: roles.sales_exec._id,
      },
      {
        name: "Charlie",
        email: "charlie@dealdesk.com",
        branchId: kochiBranch._id,
        roleId: roles.sales_manager._id,
      },
      {
        name: "David",
        email: "david@dealdesk.com",
        branchId: kochiBranch._id,
        roleId: roles.finance._id,
      },
      {
        name: "Emma",
        email: "emma@dealdesk.com",
        branchId: bangaloreBranch._id,
        roleId: roles.admin._id,
      },
    ];

    for (const user of users) {
      await User.findOneAndUpdate(
        { email: user.email },
        {
          $set: {
            ...user,
            password: hashedPassword,
            isActive: true,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    // 5. Create three customers
    const customers = [
      {
        name: "John Mathew",
        email: "john@gmail.com",
        phone: "9876543210",
        address: "Kochi, Kerala",
        outstandingBalance: 50000,
      },
      {
        name: "Anjali Nair",
        email: "anjali@gmail.com",
        phone: "9876543211",
        address: "Trivandrum, Kerala",
        outstandingBalance: 75000,
      },
      {
        name: "Rahul Kumar",
        email: "rahul@gmail.com",
        phone: "9876543212",
        address: "Bangalore, Karnataka",
        outstandingBalance: 25000,
      },
    ];

    for (const customer of customers) {
      await Customer.findOneAndUpdate(
        { email: customer.email },
        { $set: customer },
        { upsert: true, new: true, runValidators: true }
      );
    }

    // 6. Create three products
    const products = [
      {
        name: "Dell Laptop",
        sku: "DELL-001",
        description: "Dell business laptop",
        price: 65000,
        stock: 10,
      },
      {
        name: "HP Desktop",
        sku: "HP-001",
        description: "HP business desktop computer",
        price: 55000,
        stock: 15,
      },
      {
        name: "Canon Printer",
        sku: "CANON-001",
        description: "Canon office printer",
        price: 18000,
        stock: 20,
      },
    ];

    for (const product of products) {
      await Product.findOneAndUpdate(
        { sku: product.sku },
        { $set: product },
        { upsert: true, new: true, runValidators: true }
      );
    }
await seedApprovalConfig();
    // 7. Success messages
    console.log("\nDatabase seeded successfully!");
    console.log("2 branches created/updated");
    console.log("4 roles created/updated");
    console.log("5 users created/updated");
    console.log("3 customers created/updated");
    console.log("3 products created/updated");
    console.log("Sample password: Demo@12345");

  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log("MongoDB connection closed");
    }
  }
};

seedDatabase();
