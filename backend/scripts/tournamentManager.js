require("dotenv").config({ path: "../.env" });
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Import contract config from the frontend directory
const contractConfig = require("../../frontend/src/config/contracts-data.json");

// Contract setup
let provider;
let wallet;
let tournamentContract;

// Function to get contract address from chainId
const getContractAddress = (chainId) => {
  try {
    if (!contractConfig.CONTRACT_ADDRESSES[chainId]) {
      throw new Error(`No contract addresses found for chain ID ${chainId}`);
    }

    const address =
      contractConfig.CONTRACT_ADDRESSES[chainId].TournamentPlatform;

    if (!address || address === null) {
      throw new Error(
        `Tournament Platform contract address not configured for chain ID ${chainId}`
      );
    }

    return address;
  } catch (error) {
    console.error("Error getting contract address:", error);
    return null;
  }
};

/**
 * Initialize the contract connection
 * @returns {Promise<boolean>} Success status
 */
const initializeContract = async () => {
  try {
    console.log("Initializing contract connection...");
    // Check if we're using a local network or a testnet
    const isLocal = process.env.NETWORK === "localhost";
    const chainId = isLocal ? "31337" : "11155111"; // Default to Sepolia if not local

    if (isLocal) {
      provider = new ethers.providers.JsonRpcProvider(
        process.env.RPC_URL || "http://localhost:8545"
      );
    } else {
      provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    }

    // Setup wallet for signing transactions
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log(`Using wallet address: ${wallet.address}`);

    // Get contract address from config
    const contractAddress = getContractAddress(chainId);

    if (!contractAddress) {
      throw new Error(`No contract address configured for chain ID ${chainId}`);
    }

    console.log(
      `Using contract address from config: ${contractAddress} (Chain ID: ${chainId})`
    );

    // Load contract ABI
    const contractAbiPath = path.join(
      __dirname,
      "..",
      "..",
      "artifacts",
      "contracts",
      "TournamentPlatform.sol",
      "TournamentPlatform.json"
    );

    if (!fs.existsSync(contractAbiPath)) {
      throw new Error(`Contract ABI file not found at: ${contractAbiPath}`);
    }

    const contractData = JSON.parse(fs.readFileSync(contractAbiPath, "utf8"));

    // Initialize contract instance
    tournamentContract = new ethers.Contract(
      contractAddress,
      contractData.abi,
      wallet
    );

    console.log(`Contract initialized at address: ${contractAddress}`);
    return true;
  } catch (error) {
    console.error("Error initializing contract:", error);
    return false;
  }
};

/**
 * Fetch all tournaments from the contract
 */
const fetchAllTournaments = async () => {
  try {
    console.log("Fetching all tournaments from the blockchain...");

    if (!tournamentContract) {
      console.error("Contract not initialized. Cannot fetch tournaments.");
      return [];
    }

    const allTournaments = await tournamentContract.getAllTournaments();
    console.log(`Found ${allTournaments.length} tournaments.`);

    // Log tournament IDs and status
    if (allTournaments.length > 0) {
      console.log("Tournament summary:");
      allTournaments.forEach((t) => {
        const statusMap = [
          "Registration",
          "InProgress",
          "Completed",
          "Canceled",
        ];
        const status = statusMap[t.status] || "Unknown";
        console.log(
          `  - Tournament #${t.id.toString()}: ${
            t.name
          } (${status}) - ${t.currentPlayers.toString()}/${t.maxPlayers.toString()} players`
        );
      });
    }

    return allTournaments;
  } catch (error) {
    console.error("Error fetching tournaments:", error.message);
    if (error.code === "CALL_EXCEPTION") {
      console.error(
        "This may indicate the contract address is incorrect or the contract doesn't have the expected function."
      );
    }
    return [];
  }
};

/**
 * Generate a random score for a player based on game type
 * @param {string} gameType - The type of game
 * @returns {number} - Generated score
 */
const generateRandomScore = (gameType) => {
  // Base score between 100-1000
  let baseScore = Math.floor(Math.random() * 900) + 100;

  // Adjust based on game type
  switch (gameType) {
    case "Default":
      return baseScore;
    case "P2W":
      // P2W games might have higher score variance
      return baseScore * (Math.random() + 0.5); // 0.5x to 1.5x multiplier
    case "Free to play":
      // Free to play might have more standardized scores
      return Math.min(baseScore, 800); // Cap at 800
    default:
      return baseScore;
  }
};

/**
 * Simulate gameplay for a tournament by generating and submitting scores
 * @param {object} tournament - Tournament data from the contract
 */
const simulateGameplay = async (tournament) => {
  try {
    const tournamentId = tournament.id.toNumber();
    const players = tournament.players;
    const gameType = tournament.gameType;

    console.log(
      `Simulating gameplay for tournament #${tournamentId} (${gameType}) with ${players.length} players`
    );

    // Check if we can submit scores (tournament must be in progress)
    if (tournament.status !== 1) {
      // 1 = InProgress
      console.log(
        `Tournament #${tournamentId} is not in progress. Status: ${tournament.status}`
      );
      return false;
    }

    // Check if simulation already completed by checking if any player has a score already
    if (players.length > 0) {
      try {
        const existingScore = await tournamentContract.getPlayerScore(
          tournamentId,
          players[0]
        );
        if (existingScore.toNumber() > 0) {
          console.log(
            `Tournament #${tournamentId} already has scores submitted.`
          );
          return false;
        }
      } catch (error) {
        console.log(`Error checking existing scores: ${error.message}`);
        // Continue with simulation if we can't check scores
      }
    }

    // Generate and submit scores for each player
    for (const player of players) {
      const score = generateRandomScore(gameType);

      console.log(
        `Submitting score ${score} for player ${player} in tournament #${tournamentId}`
      );

      try {
        const tx = await tournamentContract.submitScore(
          tournamentId,
          player,
          score
        );
        await tx.wait();
        console.log(`Score submission transaction confirmed: ${tx.hash}`);
      } catch (error) {
        console.error(
          `Error submitting score for player ${player}:`,
          error.message
        );
        // Continue with next player even if one fails
      }
    }

    console.log(`Completed score simulation for tournament #${tournamentId}`);
    return true;
  } catch (error) {
    console.error(`Error in gameplay simulation for tournament:`, error);
    return false;
  }
};

/**
 * Finalize tournament and distribute rewards
 * @param {object} tournament - Tournament data from the contract
 */
const finalizeTournament = async (tournament) => {
  try {
    const tournamentId = tournament.id.toNumber();
    console.log(`Finalizing tournament #${tournamentId}`);

    // Tournament must be in progress and past end time
    if (tournament.status !== 1) {
      // 1 = InProgress
      console.log(
        `Tournament #${tournamentId} is not in progress. Status: ${tournament.status}`
      );
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime <= tournament.endTime.toNumber()) {
      console.log(
        `Tournament #${tournamentId} has not ended yet. Current time: ${currentTime}, End time: ${tournament.endTime.toNumber()}`
      );
      return false;
    }

    // Finalize the tournament
    const tx = await tournamentContract.finalizeTournament(tournamentId);
    const receipt = await tx.wait();

    console.log(
      `Tournament #${tournamentId} finalized successfully. Transaction: ${tx.hash}`
    );

    // Log the winners
    try {
      const winners = await tournamentContract.getTournamentWinners(
        tournamentId
      );
      console.log(`Tournament #${tournamentId} winners:`, winners);

      // Log the prize distribution
      const prizePool = ethers.utils.formatEther(tournament.totalPrizePool);
      console.log(`Prize pool: ${prizePool} ETH`);

      if (winners.length === 1) {
        console.log(`Winner ${winners[0]} receives 100%: ${prizePool} ETH`);
      } else if (winners.length === 2) {
        const firstPrize = parseFloat(prizePool) * 0.7;
        const secondPrize = parseFloat(prizePool) * 0.3;
        console.log(
          `1st place ${winners[0]} receives 70%: ${firstPrize.toFixed(4)} ETH`
        );
        console.log(
          `2nd place ${winners[1]} receives 30%: ${secondPrize.toFixed(4)} ETH`
        );
      } else if (winners.length >= 3) {
        const firstPrize = parseFloat(prizePool) * 0.5;
        const secondPrize = parseFloat(prizePool) * 0.3;
        const thirdPrize = parseFloat(prizePool) * 0.2;
        console.log(
          `1st place ${winners[0]} receives 50%: ${firstPrize.toFixed(4)} ETH`
        );
        console.log(
          `2nd place ${winners[1]} receives 30%: ${secondPrize.toFixed(4)} ETH`
        );
        console.log(
          `3rd place ${winners[2]} receives 20%: ${thirdPrize.toFixed(4)} ETH`
        );
      }
    } catch (error) {
      console.error(
        `Error fetching winners for tournament #${tournamentId}:`,
        error
      );
    }

    return true;
  } catch (error) {
    console.error(
      `Error finalizing tournament #${tournament.id.toNumber()}:`,
      error
    );
    return false;
  }
};

/**
 * Cancel a tournament that hasn't filled by its start time
 * @param {object} tournament - Tournament data from the contract
 */
const cancelUnfilledTournament = async (tournament) => {
  try {
    const tournamentId = tournament.id.toNumber();
    console.log(`Checking if tournament #${tournamentId} should be cancelled`);

    // Only cancel tournaments in registration phase
    if (tournament.status !== 0) {
      // 0 = Registration
      console.log(
        `Tournament #${tournamentId} is not in registration phase. Status: ${tournament.status}`
      );
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = tournament.startTime.toNumber();

    // Check if tournament start time has passed
    if (currentTime >= startTime) {
      // Check if it has less than 2 players or not full
      const playerCount = tournament.currentPlayers.toNumber();
      const maxPlayers = tournament.maxPlayers.toNumber();
      const hasMinimumPlayers = playerCount >= 2;

      if (!hasMinimumPlayers) {
        console.log(
          `Tournament #${tournamentId} doesn't have minimum required players (${playerCount}/2). Cancelling...`
        );
      } else if (playerCount < maxPlayers) {
        console.log(
          `Tournament #${tournamentId} is not full (${playerCount}/${maxPlayers}). You may want to start it manually or wait for more players to join.`
        );
        // If it has at least 2 players, we can let it be started manually
        return false;
      }

      if (!hasMinimumPlayers) {
        // Cancel the tournament
        try {
          const tx = await tournamentContract.cancelTournament(tournamentId);
          await tx.wait();

          console.log(
            `Tournament #${tournamentId} cancelled successfully. Transaction: ${tx.hash}`
          );
          return true;
        } catch (error) {
          console.error(
            `Error calling cancelTournament for tournament #${tournamentId}:`,
            error
          );
          console.log(
            "This could happen if the tournament was already cancelled or started"
          );
          return false;
        }
      }
    } else {
      console.log(
        `Tournament #${tournamentId} hasn't reached its start time yet (${new Date(
          startTime * 1000
        ).toLocaleString()})`
      );
      return false;
    }

    return false;
  } catch (error) {
    console.error(
      `Error cancelling tournament #${tournament.id.toNumber()}:`,
      error
    );
    return false;
  }
};

/**
 * Update tournaments that have passed their start time but are still in Registration phase
 * @param {object} tournament - Tournament data from the contract
 */
const updateTournamentPhase = async (tournament) => {
  try {
    const tournamentId = tournament.id.toNumber();
    console.log(`Checking if tournament #${tournamentId} needs to be canceled`);

    // Only update tournaments in registration phase
    if (tournament.status !== 0) {
      // 0 = Registration
      console.log(
        `Tournament #${tournamentId} is not in registration phase. Status: ${tournament.status}`
      );
      return false;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = tournament.startTime.toNumber();

    // Check if tournament start time has passed but it doesn't have enough players
    if (currentTime >= startTime && tournament.currentPlayers.toNumber() < 2) {
      console.log(
        `Tournament #${tournamentId} start time has passed but doesn't have enough players. Cancelling...`
      );

      // Cancel the tournament
      return await cancelUnfilledTournament(tournament);
    } else if (currentTime >= startTime) {
      console.log(
        `Tournament #${tournamentId} start time has passed. The contract will automatically transition it to InProgress when someone joins and it's full, or when the admin calls startTournament().`
      );
      // We don't need to do anything here - the contract handles starting tournaments
      // automatically when they get enough players, or the admin can start them manually
    }

    return false;
  } catch (error) {
    console.error(`Error updating tournament phase:`, error);
    return false;
  }
};

/**
 * Main function to manage all tournaments
 */
const manageTournaments = async () => {
  console.log("===== Starting tournament management task =====");
  const startTime = Date.now();

  try {
    // Wait for contract initialization to complete
    if (!tournamentContract) {
      console.log("Contract not initialized. Initializing now...");
      await initializeContract();

      // Wait for the contract to be fully initialized
      let attempts = 0;
      while (!tournamentContract && attempts < 10) {
        console.log("Waiting for contract initialization...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }

      if (!tournamentContract) {
        throw new Error(
          "Contract initialization failed after multiple attempts"
        );
      }
    }

    // Fetch all tournaments
    const tournaments = await fetchAllTournaments();
    if (!tournaments || tournaments.length === 0) {
      console.log("No tournaments found to manage.");
      return;
    }

    // Process each tournament
    let processed = 0;
    let errors = 0;

    for (const tournament of tournaments) {
      try {
        const tournamentId = tournament.id.toNumber();
        const status = tournament.status;
        const currentTime = Math.floor(Date.now() / 1000);
        const startTime = tournament.startTime.toNumber();
        const endTime = tournament.endTime.toNumber();

        console.log(
          `\nProcessing tournament #${tournamentId} (Status: ${status})`
        );
        console.log(
          `Start time: ${new Date(startTime * 1000).toLocaleString()}`
        );
        console.log(`End time: ${new Date(endTime * 1000).toLocaleString()}`);
        console.log(
          `Players: ${tournament.currentPlayers.toNumber()}/${tournament.maxPlayers.toNumber()}`
        );

        let actionTaken = false;

        // Case 1: Tournament in Registration phase but start time has passed - Check if it needs to be cancelled
        if (status === 0 && currentTime >= startTime) {
          // Only cancel tournaments that don't have enough players
          if (tournament.currentPlayers.toNumber() < 2) {
            actionTaken = await cancelUnfilledTournament(tournament);
            if (actionTaken) {
              console.log(
                `Tournament #${tournamentId} was cancelled due to insufficient players`
              );
            }
          } else {
            console.log(
              `Tournament #${tournamentId} has enough players. The contract will handle starting it automatically or it can be started manually.`
            );
          }
        }
        // Case 2: Tournament in Progress - Simulate gameplay if not done yet
        else if (status === 1 && currentTime < endTime) {
          actionTaken = await simulateGameplay(tournament);
          if (actionTaken) {
            console.log(
              `Gameplay simulation completed for tournament #${tournamentId}`
            );
          }
        }
        // Case 3: Tournament in Progress but end time has passed - Finalize it
        else if (status === 1 && currentTime >= endTime) {
          actionTaken = await finalizeTournament(tournament);
          if (actionTaken) {
            console.log(
              `Tournament #${tournamentId} was finalized and rewards distributed`
            );
          }
        } else {
          console.log(`No action needed for tournament #${tournamentId}`);
        }

        if (actionTaken) {
          console.log(`Successfully processed tournament #${tournamentId}`);
        }

        processed++;
      } catch (error) {
        console.error(`Error processing tournament: ${error.message}`);
        errors++;
        // Continue to next tournament even if this one fails
      }
    }

    console.log(`\n===== Tournament management task completed =====`);
    console.log(`Processed ${processed} tournaments with ${errors} errors`);
    console.log(`Time taken: ${(Date.now() - startTime) / 1000} seconds`);
  } catch (error) {
    console.error(`Fatal error in tournament management: ${error.message}`);
    console.error(error.stack);
  }
};

// Run the script if executed directly
if (require.main === module) {
  manageTournaments()
    .then(() => {
      console.log("Tournament management script executed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Error executing tournament management script:", error);
      process.exit(1);
    });
}

module.exports = {
  manageTournaments,
  simulateGameplay,
  finalizeTournament,
  cancelUnfilledTournament,
  updateTournamentPhase,
  generateRandomScore,
  fetchAllTournaments,
};
