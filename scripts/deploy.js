const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper function for safe JSON stringification with BigInt support
function safeStringify(obj, indent = 2) {
  return JSON.stringify(
    obj,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    indent
  );
}

// Helper function to retry contract verification
async function verifyContract(address, args, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      console.log(
        `Attempting to verify contract (attempt ${
          retries + 1
        }/${maxRetries})...`
      );
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: args,
      });
      console.log("Contract verified successfully!");
      return true;
    } catch (error) {
      retries++;
      if (retries === maxRetries) {
        console.error("Verification failed after all retries:", error.message);
        return false;
      }
      console.log(
        `Verification attempt ${retries} failed. Retrying in 5 seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy TournamentPlatform
  const TournamentPlatform = await ethers.getContractFactory(
    "TournamentPlatform"
  );
  const tournamentPlatform = await TournamentPlatform.deploy();
  await tournamentPlatform.waitForDeployment();

  const address = await tournamentPlatform.getAddress();
  console.log("TournamentPlatform deployed to:", address);

  // Get the owner address
  const owner = await tournamentPlatform.owner();
  console.log("Contract owner:", owner);

  // Verify contract on Etherscan with retry logic
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Verifying contract on Etherscan...");
    await verifyContract(address, []);
  } else {
    console.log("Skipping verification on local network");
  }

  // Get the network chain ID
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: chainId.toString(),
    contract: "TournamentPlatform",
    address: address,
    owner: owner,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const deploymentFile = path.join(
    deploymentsDir,
    `${hre.network.name}-${Date.now()}.json`
  );
  fs.writeFileSync(deploymentFile, safeStringify(deploymentInfo, 2));
  console.log("Deployment info saved to:", deploymentFile);

  // Update the shared contract configuration
  updateContractConfig(
    chainId.toString(),
    "TournamentPlatform",
    address,
    hre.network.name
  );

  console.log("Deployment completed successfully!");
}

// Function to update the shared contract configuration
function updateContractConfig(chainId, contractName, address, networkName) {
  try {
    // Get the current configuration from the frontend
    const frontendConfigPath = path.join(
      __dirname,
      "../frontend/src/config/contracts-data.json"
    );
    let contractConfig = {};

    try {
      if (fs.existsSync(frontendConfigPath)) {
        contractConfig = JSON.parse(
          fs.readFileSync(frontendConfigPath, "utf8")
        );
      } else {
        console.log("Config file doesn't exist, creating new one");
        contractConfig = {
          VERSION: "1.0.0",
          CONTRACT_ADDRESSES: {},
        };
      }
    } catch (error) {
      console.error("Error reading existing config:", error);
      contractConfig = {
        VERSION: "1.0.0",
        CONTRACT_ADDRESSES: {},
      };
    }

    // Ensure the structure exists
    if (!contractConfig.CONTRACT_ADDRESSES) {
      contractConfig.CONTRACT_ADDRESSES = {};
    }

    if (!contractConfig.CONTRACT_ADDRESSES[chainId]) {
      contractConfig.CONTRACT_ADDRESSES[chainId] = {};
    }

    // Update the address
    contractConfig.CONTRACT_ADDRESSES[chainId][contractName] = address;

    // Save the updated config
    fs.writeFileSync(
      frontendConfigPath,
      JSON.stringify(contractConfig, null, 2)
    );

    console.log(
      `Updated contract address in frontend config file: ${address} for chain ID ${chainId}`
    );
  } catch (error) {
    console.error("Error updating contract config:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

// Export the updateContractConfig function for testing
module.exports = {
  updateContractConfig,
};
