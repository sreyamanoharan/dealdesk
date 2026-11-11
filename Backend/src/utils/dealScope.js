
const buildDealScope = (user) => {
  const dataScope = user.roleId.dataScope;

  switch (dataScope) {
    case "own":
      return {
        ownerId: user._id,
        branchId: user.branchId,
      };

    case "branch":
      return {
        branchId: user.branchId,
      };

    case "all":
      return {};

    default:
      throw new Error("Invalid data scope configuration");
  }
};

export default buildDealScope;
