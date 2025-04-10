const fs = require("fs");
const path = require("path");

// Function to update contract address in the configuration file
function updateContractAddress(chainId, contractName, newAddress) {
  const configPath = path.join(
    __dirname,
    "../frontend/src/config/contracts.js"
  );

  // Read the current configuration file
  let configContent = fs.readFileSync(configPath, "utf8");

  // Create the new address entry
  const newAddressEntry = `    ${contractName}: '${newAddress}',`;

  // Find the network section and update the address
  const networkRegex = new RegExp(
    `(${chainId}: \\{[^}]*${contractName}: ')[^']*(',[^}]*\\})`
  );
  if (configContent.match(networkRegex)) {
    configContent = configContent.replace(networkRegex, `$1${newAddress}$2`);
  } else {
    // If the network doesn't exist, add it
    const networkSection = `  // Network ${chainId}\n  ${chainId}: {\n${newAddressEntry}\n  },`;
    configContent = configContent.replace(
      /const CONTRACT_ADDRESSES = {/,
      `const CONTRACT_ADDRESSES = {\n${networkSection}`
    );
  }

  // Write the updated configuration back to the file
  fs.writeFileSync(configPath, configContent);
  console.log(
    `Updated ${contractName} address to ${newAddress} for chain ID ${chainId}`
  );
}

// Example usage:
// updateContractAddress(5, 'TournamentPlatform', '0x123...');

module.exports = updateContractAddress;
