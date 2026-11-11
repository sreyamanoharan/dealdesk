
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const authenticateUser = async (req, res, next) => {
  try {
    // 1. Get token from request header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find user and populate their role
    const user = await User.findById(decoded.userId)
      .populate("roleId");

    if (!user || !user.isActive || !user.roleId || !user.roleId.isActive) {
      return res.status(401).json({
        message: "Invalid or inactive user",
      });
    }

    // 4. Attach user information to request
    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

export default authenticateUser;
