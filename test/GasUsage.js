const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentPlatform Gas Usage", function () {
  let tournamentPlatform;
  let owner;
  let player1;
  let player2;
  let player3;

  let entryFee;
  const maxPlayers = 3;
  let startTime;
  let endTime;

  beforeEach(async function () {
    // Set the entry fee using ethers
    entryFee = ethers.parseEther("0.01");

    // Use dynamic timestamps to ensure they're always in the future
    const latestBlock = await ethers.provider.getBlock("latest");
    const currentTimestamp = latestBlock.timestamp;
    startTime = currentTimestamp + 3600; // 1 hour from now
    endTime = currentTimestamp + 7200; // 2 hours from now

    // Deploy the contract
    const TournamentPlatform = await ethers.getContractFactory(
      "TournamentPlatform"
    );
    [owner, player1, player2, player3] = await ethers.getSigners();

    tournamentPlatform = await TournamentPlatform.deploy();
    await tournamentPlatform.waitForDeployment();
  });

  it("Should measure gas usage for player registration", async function () {
    const tx = await tournamentPlatform.connect(player1).registerPlayer();
    const receipt = await tx.wait();
    console.log(`Gas used for registerPlayer: ${receipt.gasUsed}`);
  });

  it("Should measure gas usage for tournament creation", async function () {
    const tx = await tournamentPlatform.createTournament(
      "Test Tournament",
      entryFee,
      maxPlayers,
      startTime,
      endTime,
      "TestGame"
    );
    const receipt = await tx.wait();
    console.log(`Gas used for createTournament: ${receipt.gasUsed}`);
  });

  it("Should measure gas usage for joining a tournament", async function () {
    // Create tournament
    await tournamentPlatform.createTournament(
      "Test Tournament",
      entryFee,
      maxPlayers,
      startTime,
      endTime,
      "TestGame"
    );

    // Register player
    await tournamentPlatform.connect(player1).registerPlayer();

    // Join tournament
    const tx = await tournamentPlatform
      .connect(player1)
      .joinTournament(1, { value: entryFee });
    const receipt = await tx.wait();
    console.log(`Gas used for joinTournament: ${receipt.gasUsed}`);
  });

  it("Should measure gas usage for score submission", async function () {
    // Create tournament
    await tournamentPlatform.createTournament(
      "Test Tournament",
      entryFee,
      maxPlayers,
      startTime,
      endTime,
      "TestGame"
    );

    // Register all players to fill tournament and start it automatically
    await tournamentPlatform.connect(player1).registerPlayer();
    await tournamentPlatform.connect(player2).registerPlayer();
    await tournamentPlatform.connect(player3).registerPlayer();

    // Join tournament (this will automatically start it when full)
    await tournamentPlatform
      .connect(player1)
      .joinTournament(1, { value: entryFee });
    await tournamentPlatform
      .connect(player2)
      .joinTournament(1, { value: entryFee });
    await tournamentPlatform
      .connect(player3)
      .joinTournament(1, { value: entryFee });

    // Submit score
    const tx = await tournamentPlatform.submitScore(1, player1.address, 100);
    const receipt = await tx.wait();
    console.log(`Gas used for submitScore: ${receipt.gasUsed}`);
  });

  it("Should measure gas usage for finalizing tournament", async function () {
    // Create tournament
    await tournamentPlatform.createTournament(
      "Test Tournament",
      entryFee,
      maxPlayers,
      startTime,
      endTime,
      "TestGame"
    );

    // Register players
    await tournamentPlatform.connect(player1).registerPlayer();
    await tournamentPlatform.connect(player2).registerPlayer();
    await tournamentPlatform.connect(player3).registerPlayer();

    // Join tournament
    await tournamentPlatform
      .connect(player1)
      .joinTournament(1, { value: entryFee });
    await tournamentPlatform
      .connect(player2)
      .joinTournament(1, { value: entryFee });
    await tournamentPlatform
      .connect(player3)
      .joinTournament(1, { value: entryFee });

    // Submit scores
    await tournamentPlatform.submitScore(1, player1.address, 100);
    await tournamentPlatform.submitScore(1, player2.address, 50);
    await tournamentPlatform.submitScore(1, player3.address, 75);

    // Advance time past tournament end
    await ethers.provider.send("evm_setNextBlockTimestamp", [endTime + 1]);
    await ethers.provider.send("evm_mine");

    // Finalize tournament
    const tx = await tournamentPlatform.finalizeTournament(1);
    const receipt = await tx.wait();
    console.log(`Gas used for finalizeTournament: ${receipt.gasUsed}`);
  });
});
