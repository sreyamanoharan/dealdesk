
const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    try {
      // Get permissions from the logged-in user's role
      const permissions = req.user?.roleId?.permissions || [];

      // Check whether the user has the required permission
      if (!permissions.includes(requiredPermission)) {
        return res.status(403).json({
          message: "You do not have permission to perform this action",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        message: "Permission check failed",
      });
    }
  };
};

export default requirePermission;
