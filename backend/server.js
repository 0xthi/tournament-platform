require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const {
  manageTournaments,
  simulateGameplay,
  finalizeTournament,
  cancelUnfilledTournament,
} = require("./scripts/tournamentManager");

// Import contract config from the frontend directory
const contractConfig = require("../frontend/src/config/contracts-data.json");

const app = express();
const PORT = process.env.PORT || 3001;

// Get contract address from config
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

// Middleware
app.use(cors());
app.use(express.json());

// Contract setup
let provider;
let wallet;
let tournamentContract;

// Tournament management scheduler
let tournamentManagerInterval;
const SCHEDULER_INTERVAL = process.env.SCHEDULER_INTERVAL || 5 * 60 * 1000; // Default: 5 minutes

const initializeContract = async () => {
  try {
    // Check if we're using a local network or a testnet
    const isLocal = process.env.NETWORK === "localhost";
    const chainId = isLocal ? "31337" : "11155111"; // Default to Sepolia if not local

    // Set up provider based on network
    if (isLocal) {
      provider = new ethers.providers.JsonRpcProvider(
        process.env.RPC_URL || "http://localhost:8545"
      );
    } else {
      provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    }

    // Get contract address from config
    const contractAddress = getContractAddress(chainId);

    if (!contractAddress) {
      throw new Error(`No contract address configured for chain ID ${chainId}`);
    }

    console.log(
      `Using contract address from config: ${contractAddress} (Chain ID: ${chainId})`
    );

    // Setup wallet for signing transactions
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Load contract ABI
    const contractAbiPath = path.join(
      __dirname,
      "..",
      "artifacts",
      "contracts",
      "TournamentPlatform.sol",
      "TournamentPlatform.json"
    );
    const contractData = JSON.parse(fs.readFileSync(contractAbiPath, "utf8"));

    // Initialize contract instance
    tournamentContract = new ethers.Contract(
      contractAddress,
      contractData.abi,
      wallet
    );

    console.log("Contract initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing contract:", error);
    return false;
  }
};

/**
 * Start the tournament manager scheduler
 */
const startTournamentManager = () => {
  console.log(
    `Starting tournament manager scheduler (interval: ${SCHEDULER_INTERVAL}ms)`
  );

  // Run immediately on startup
  manageTournaments().catch((err) => {
    console.error("Error running tournament manager:", err);
  });

  // Then set up the interval
  tournamentManagerInterval = setInterval(() => {
    console.log("Running scheduled tournament management task...");
    manageTournaments().catch((err) => {
      console.error("Error running tournament manager:", err);
    });
  }, SCHEDULER_INTERVAL);
};

/**
 * Stop the tournament manager scheduler
 */
const stopTournamentManager = () => {
  if (tournamentManagerInterval) {
    clearInterval(tournamentManagerInterval);
    console.log("Tournament manager scheduler stopped");
  }
};

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Tournament Platform API is running" });
});

// Submit scores (Admin only endpoint)
app.post("/api/submit-score", async (req, res) => {
  try {
    const { tournamentId, playerAddress, score, adminKey } = req.body;

    // Simple admin check - in a production app, use a proper auth system
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!tournamentContract) {
      return res.status(500).json({ error: "Contract not initialized" });
    }

    // Submit the score to the blockchain
    const tx = await tournamentContract.submitScore(
      tournamentId,
      playerAddress,
      score
    );
    await tx.wait();

    res.json({
      success: true,
      message: "Score submitted successfully",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error submitting score:", error);
    res.status(500).json({ error: "Failed to submit score" });
  }
});

// Finalize tournament (Admin only endpoint)
app.post("/api/finalize-tournament", async (req, res) => {
  try {
    const { tournamentId, adminKey } = req.body;

    // Simple admin check
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!tournamentContract) {
      return res.status(500).json({ error: "Contract not initialized" });
    }

    // Finalize the tournament and distribute rewards
    const tx = await tournamentContract.finalizeTournament(tournamentId);
    await tx.wait();

    res.json({
      success: true,
      message: "Tournament finalized successfully",
      transactionHash: tx.hash,
    });
  } catch (error) {
    console.error("Error finalizing tournament:", error);
    res.status(500).json({ error: "Failed to finalize tournament" });
  }
});

// Manual endpoints for tournament management
app.post("/api/manage-tournaments", async (req, res) => {
  try {
    const { adminKey } = req.body;

    // Simple admin check
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Run the tournament manager
    await manageTournaments();

    res.json({
      success: true,
      message: "Tournament management task executed successfully",
    });
  } catch (error) {
    console.error("Error running tournament manager:", error);
    res.status(500).json({ error: "Failed to run tournament manager" });
  }
});

// Simulate scores for a specific tournament
app.post("/api/simulate-tournament", async (req, res) => {
  try {
    const { tournamentId, adminKey } = req.body;

    // Simple admin check
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!tournamentContract) {
      return res.status(500).json({ error: "Contract not initialized" });
    }

    // Get tournament details
    const tournament = await tournamentContract.getTournamentDetails(
      tournamentId
    );

    if (tournament.id.toNumber() === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    // Trigger score simulation
    const result = await simulateGameplay(tournament);

    if (result) {
      res.json({
        success: true,
        message: `Successfully simulated scores for tournament #${tournamentId}`,
      });
    } else {
      res.status(400).json({
        success: false,
        message:
          "Could not simulate scores. Tournament may not be in progress or already has scores.",
      });
    }
  } catch (error) {
    console.error("Error simulating tournament:", error);
    res.status(500).json({ error: "Failed to simulate tournament" });
  }
});

// API endpoint to update contract addresses
app.post("/api/update-contract-addresses", async (req, res) => {
  try {
    const { version, addresses, adminKey } = req.body;

    // Simple admin check
    if (adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Create the updated configuration object
    const updatedConfig = {
      VERSION: version || "1.0.0",
      CONTRACT_ADDRESSES: addresses,
    };

    // Update the contracts-data.json file
    fs.writeFileSync(
      path.join(__dirname, "../frontend/src/config/contracts-data.json"),
      JSON.stringify(updatedConfig, null, 2)
    );

    console.log("Contract addresses updated successfully");
    res.json({
      success: true,
      message: "Contract addresses updated successfully",
    });
  } catch (error) {
    console.error("Error updating contract addresses:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to update contract addresses" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initializeContract();

  // Start the tournament manager scheduler
  startTournamentManager();
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  stopTournamentManager();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  stopTournamentManager();
  process.exit(0);
});
