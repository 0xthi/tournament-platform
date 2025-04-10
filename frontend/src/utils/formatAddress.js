export const formatAddress = (address) => {
  // Debug logging to help diagnose issues
  console.log("formatAddress called with:", {
    address,
    type: typeof address,
    isNull: address === null,
    isUndefined: address === undefined,
  });

  if (!address) return "";

  // Ensure address is a string
  const addressStr = String(address);

  // Check if it's a valid Ethereum address format
  if (!addressStr.match(/^0x[a-fA-F0-9]{40}$/)) {
    console.warn(
      `formatAddress: Invalid Ethereum address format: ${addressStr}`
    );
    return addressStr; // Return as is if not a valid Ethereum address
  }

  const formatted = `${addressStr.slice(0, 6)}...${addressStr.slice(-4)}`;
  return formatted;
};
