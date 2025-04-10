// Contract ABIs
import TournamentPlatform from "../contracts/contracts/TournamentPlatform.sol/TournamentPlatform.json";

// Try to import contract-data.json if it exists
let contractData = null;
try {
  contractData = require("./contracts-data.json");
} catch (error) {
  console.log("No contracts-data.json found, using default addresses");
}

// Contract addresses for different networks - single source of truth
const CONTRACT_ADDRESSES = contractData?.CONTRACT_ADDRESSES || {
  // Ethereum Mainnet (1)
  1: {
    TournamentPlatform: null,
  },
  // Goerli Testnet (5)
  5: {
    TournamentPlatform: null,
  },
  // Local Ganache (1337)
  1337: {
    TournamentPlatform: null,
  },
  // Local Hardhat Network (31337)
  31337: {
    TournamentPlatform: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
  // Sepolia Network (11155111)
  11155111: {
    TournamentPlatform: "0x4Ec3782816801C121CF0ce71D113bb67b7FE304D",
  },
};

// Export configuration
export const CONFIG = {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS: {
    TournamentPlatform: TournamentPlatform.abi,
  },
};

// Helper function to get contract address for current network
export const getContractAddress = (chainId, contractName) => {
  if (!CONTRACT_ADDRESSES[chainId]) {
    throw new Error(`No contract addresses configured for chain ID ${chainId}`);
  }
  const address = CONTRACT_ADDRESSES[chainId][contractName];
  if (!address || address === null) {
    throw new Error(
      `No address configured for ${contractName} on chain ID ${chainId}`
    );
  }
  return address;
};

// Helper function to update contract address and save it to local storage
export const updateContractAddress = (chainId, contractName, newAddress) => {
  if (!CONTRACT_ADDRESSES[chainId]) {
    CONTRACT_ADDRESSES[chainId] = {};
  }
  CONTRACT_ADDRESSES[chainId][contractName] = newAddress;

  // Save to local storage for persistence
  try {
    const contractAddresses = JSON.stringify(CONTRACT_ADDRESSES);
    localStorage.setItem("contractAddresses", contractAddresses);

    // Trigger a server-side update
    saveContractAddressesToFile(CONTRACT_ADDRESSES);
  } catch (error) {
    console.error("Failed to save contract addresses to local storage", error);
  }

  console.log(
    `Updated ${contractName} address to ${newAddress} for chain ID ${chainId}`
  );
};

// Function to save contract addresses to the data file
export const saveContractAddressesToFile = async (addresses) => {
  try {
    // Only run on the server or if in development
    if (
      typeof window === "undefined" ||
      process.env.NODE_ENV === "development"
    ) {
      return;
    }

    // Use a simple API call to trigger a server-side save
    const response = await fetch("/api/update-contract-addresses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "1.0.0",
        addresses,
        adminKey: localStorage.getItem("adminKey") || "",
      }),
    });

    const data = await response.json();
    if (data.success) {
      console.log("Contract addresses saved to file successfully");
    } else {
      console.error("Failed to save contract addresses to file:", data.error);
    }
  } catch (error) {
    console.error("Error saving contract addresses to file:", error);
  }
};

// Function to load saved addresses from local storage on startup
export const loadSavedAddresses = () => {
  try {
    const savedAddresses = localStorage.getItem("contractAddresses");
    if (savedAddresses) {
      const parsed = JSON.parse(savedAddresses);
      Object.keys(parsed).forEach((chainId) => {
        Object.keys(parsed[chainId]).forEach((contractName) => {
          CONTRACT_ADDRESSES[chainId] = CONTRACT_ADDRESSES[chainId] || {};
          CONTRACT_ADDRESSES[chainId][contractName] =
            parsed[chainId][contractName];
        });
      });
      console.log("Loaded saved contract addresses from local storage");
    }
  } catch (error) {
    console.error("Failed to load saved contract addresses", error);
  }
};

// Initialize by loading saved addresses
loadSavedAddresses();
