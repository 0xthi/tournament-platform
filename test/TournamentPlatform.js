const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TournamentPlatform", function () {
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

  describe("Player Registration", function () {
    it("Should register a new player", async function () {
      await tournamentPlatform.connect(player1).registerPlayer();

      const playerInfo = await tournamentPlatform.players(player1.address);
      expect(playerInfo.exists).to.equal(true);
      expect(playerInfo.id).to.equal(1);
    });

    it("Should not allow a player to register twice", async function () {
      await tournamentPlatform.connect(player1).registerPlayer();
      await expect(
        tournamentPlatform.connect(player1).registerPlayer()
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "PlayerAlreadyRegistered"
      );
    });
  });

  describe("Tournament Creation", function () {
    it("Should allow owner to create a tournament", async function () {
      await tournamentPlatform.createTournament(
        "Test Tournament",
        entryFee,
        maxPlayers,
        startTime,
        endTime,
        "TestGame"
      );

      expect(await tournamentPlatform.tournamentsCount()).to.equal(1);
    });

    it("Should not allow non-owner to create a tournament", async function () {
      await expect(
        tournamentPlatform
          .connect(player1)
          .createTournament(
            "Test Tournament",
            entryFee,
            maxPlayers,
            startTime,
            endTime,
            "TestGame"
          )
      ).to.be.reverted;
    });

    it("Should revert if start time is in the past", async function () {
      const latestBlock = await ethers.provider.getBlock("latest");
      const pastTime = latestBlock.timestamp - 3600; // 1 hour ago

      await expect(
        tournamentPlatform.createTournament(
          "Past Tournament",
          entryFee,
          maxPlayers,
          pastTime,
          endTime,
          "TestGame"
        )
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "StartTimeMustBeInFuture"
      );
    });

    it("Should revert if end time is before start time", async function () {
      await expect(
        tournamentPlatform.createTournament(
          "Invalid Tournament",
          entryFee,
          maxPlayers,
          startTime,
          startTime - 1, // End time before start time
          "TestGame"
        )
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "EndTimeMustBeAfterStartTime"
      );
    });
  });

  describe("Tournament Joining", function () {
    beforeEach(async function () {
      // Create a tournament
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
    });

    it("Should allow players to join a tournament", async function () {
      await tournamentPlatform
        .connect(player1)
        .joinTournament(1, { value: entryFee });

      const players = await tournamentPlatform.getTournamentPlayers(1);
      expect(players.length).to.equal(1);
      expect(players[0]).to.equal(player1.address);
    });

    it("Should automatically register unregistered players when joining", async function () {
      const player4 = (await ethers.getSigners())[4];

      // Check that player4 doesn't exist yet
      const playerDetailsBefore = await tournamentPlatform.getPlayerDetails(
        player4.address
      );
      expect(playerDetailsBefore.exists).to.equal(false);

      // Join tournament
      await tournamentPlatform
        .connect(player4)
        .joinTournament(1, { value: entryFee });

      // Verify player was registered automatically
      const playerDetailsAfter = await tournamentPlatform.getPlayerDetails(
        player4.address
      );
      expect(playerDetailsAfter.exists).to.equal(true);

      // Verify player was added to tournament
      const players = await tournamentPlatform.getTournamentPlayers(1);
      expect(players).to.include(player4.address);
    });

    it("Should not allow joining with incorrect fee", async function () {
      const incorrectFee = ethers.parseEther("0.005");

      await expect(
        tournamentPlatform
          .connect(player1)
          .joinTournament(1, { value: incorrectFee })
      ).to.be.revertedWithCustomError(tournamentPlatform, "IncorrectEntryFee");
    });

    it("Should automatically start tournament when full", async function () {
      await tournamentPlatform
        .connect(player1)
        .joinTournament(1, { value: entryFee });
      await tournamentPlatform
        .connect(player2)
        .joinTournament(1, { value: entryFee });

      // This should fill the tournament and trigger automatic start
      await tournamentPlatform
        .connect(player3)
        .joinTournament(1, { value: entryFee });

      // For example, trying to join again should fail because it's not in registration phase
      const player4 = (await ethers.getSigners())[4];
      await tournamentPlatform.connect(player4).registerPlayer();

      await expect(
        tournamentPlatform
          .connect(player4)
          .joinTournament(1, { value: entryFee })
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "TournamentNotInRegistrationPhase"
      );
    });

    it("Should not allow joining a non-existent tournament", async function () {
      await expect(
        tournamentPlatform
          .connect(player1)
          .joinTournament(999, { value: entryFee })
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "TournamentDoesNotExist"
      );
    });

    it("Should not allow joining a tournament twice", async function () {
      await tournamentPlatform
        .connect(player1)
        .joinTournament(1, { value: entryFee });

      await expect(
        tournamentPlatform
          .connect(player1)
          .joinTournament(1, { value: entryFee })
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "PlayerAlreadyJoined"
      );
    });
  });

  describe("Score Submission and Reward Distribution", function () {
    beforeEach(async function () {
      // Create a tournament with dynamic timestamps
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTimestamp = latestBlock.timestamp;
      const tournamentStart = currentTimestamp + 3600; // 1 hour from now
      const tournamentEnd = currentTimestamp + 7200; // 2 hours from now

      await tournamentPlatform.createTournament(
        "Test Tournament",
        entryFee,
        maxPlayers,
        tournamentStart,
        tournamentEnd,
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

      // Tournament should be in progress now
    });

    it("Should allow admin to submit scores", async function () {
      await tournamentPlatform.submitScore(1, player1.address, 100);
      await tournamentPlatform.submitScore(1, player2.address, 50);
      await tournamentPlatform.submitScore(1, player3.address, 75);

      expect(
        await tournamentPlatform.getPlayerScore(1, player1.address)
      ).to.equal(100);
      expect(
        await tournamentPlatform.getPlayerScore(1, player2.address)
      ).to.equal(50);
      expect(
        await tournamentPlatform.getPlayerScore(1, player3.address)
      ).to.equal(75);
    });

    it("Should distribute rewards correctly", async function () {
      await tournamentPlatform.submitScore(1, player1.address, 100); // 1st place
      await tournamentPlatform.submitScore(1, player2.address, 50); // 3rd place
      await tournamentPlatform.submitScore(1, player3.address, 75); // 2nd place

      // We need to increase the timestamp to after endTime to finalize
      const tournament = await ethers.provider.getBlock("latest");
      const tournamentEndTime = endTime + 100; // Ensure we're past the end time

      await ethers.provider.send("evm_setNextBlockTimestamp", [
        tournamentEndTime,
      ]);
      await ethers.provider.send("evm_mine");

      // Record balances before distribution
      const initialBalance1 = await ethers.provider.getBalance(player1.address);
      const initialBalance2 = await ethers.provider.getBalance(player2.address);
      const initialBalance3 = await ethers.provider.getBalance(player3.address);

      // Finalize tournament and distribute rewards
      await tournamentPlatform.finalizeTournament(1);

      // Check winners array
      const winners = await tournamentPlatform.getTournamentWinners(1);
      expect(winners.length).to.equal(3);
      expect(winners[0]).to.equal(player1.address); // 1st place
      expect(winners[1]).to.equal(player3.address); // 2nd place
      expect(winners[2]).to.equal(player2.address); // 3rd place

      // Check balances after distribution
      const finalBalance1 = await ethers.provider.getBalance(player1.address);
      const finalBalance2 = await ethers.provider.getBalance(player2.address);
      const finalBalance3 = await ethers.provider.getBalance(player3.address);

      const totalPrize = entryFee * BigInt(3);
      const firstPlacePrize = (totalPrize * BigInt(50)) / BigInt(100);
      const secondPlacePrize = (totalPrize * BigInt(30)) / BigInt(100);
      const thirdPlacePrize = (totalPrize * BigInt(20)) / BigInt(100);

      expect(finalBalance1 - initialBalance1).to.equal(firstPlacePrize);
      expect(finalBalance3 - initialBalance3).to.equal(secondPlacePrize);
      expect(finalBalance2 - initialBalance2).to.equal(thirdPlacePrize);
    });

    it("Should not allow non-owner to submit scores", async function () {
      await expect(
        tournamentPlatform.connect(player1).submitScore(1, player2.address, 100)
      ).to.be.reverted;
    });

    it("Should not allow score submission for non-existent tournament", async function () {
      await expect(
        tournamentPlatform.submitScore(999, player1.address, 100)
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "TournamentDoesNotExist"
      );
    });

    it("Should not allow score submission for player not in tournament", async function () {
      const player4 = (await ethers.getSigners())[4];
      await expect(
        tournamentPlatform.submitScore(1, player4.address, 100)
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "PlayerNotInTournament"
      );
    });

    it("Should not allow finalizing a tournament before it ends", async function () {
      await expect(
        tournamentPlatform.finalizeTournament(1)
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "TournamentNotEndedYet"
      );
    });
  });

  describe("Tournament Cancellation", function () {
    beforeEach(async function () {
      // Create a tournament with dynamic timestamps
      const latestBlock = await ethers.provider.getBlock("latest");
      const currentTimestamp = latestBlock.timestamp;
      const tournamentStart = currentTimestamp + 3600; // 1 hour from now
      const tournamentEnd = currentTimestamp + 7200; // 2 hours from now

      await tournamentPlatform.createTournament(
        "Test Tournament",
        entryFee,
        maxPlayers,
        tournamentStart,
        tournamentEnd,
        "TestGame"
      );

      // Register player
      await tournamentPlatform.connect(player1).registerPlayer();
    });

    it("Should allow owner to cancel tournament in registration phase", async function () {
      // Player joins tournament
      await tournamentPlatform
        .connect(player1)
        .joinTournament(1, { value: entryFee });

      // Check player balance before cancellation
      const initialBalance = await ethers.provider.getBalance(player1.address);

      // Cancel tournament
      await tournamentPlatform.cancelTournament(1);

      // Check player balance after refund (should be higher by entry fee)
      const finalBalance = await ethers.provider.getBalance(player1.address);
      expect(finalBalance - initialBalance).to.equal(entryFee);
    });

    it("Should not allow non-owner to cancel tournament", async function () {
      await expect(tournamentPlatform.connect(player1).cancelTournament(1)).to
        .be.reverted;
    });

    it("Should not allow cancelling a tournament that doesn't exist", async function () {
      await expect(
        tournamentPlatform.cancelTournament(999)
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "TournamentDoesNotExist"
      );
    });

    it("Should not allow cancelling a tournament that's already started", async function () {
      // Fill tournament to start it automatically
      await tournamentPlatform
        .connect(player1)
        .joinTournament(1, { value: entryFee });
      await tournamentPlatform.connect(player2).registerPlayer();
      await tournamentPlatform
        .connect(player2)
        .joinTournament(1, { value: entryFee });
      await tournamentPlatform.connect(player3).registerPlayer();
      await tournamentPlatform
        .connect(player3)
        .joinTournament(1, { value: entryFee });

      // Try to cancel tournament that's already in progress
      await expect(
        tournamentPlatform.cancelTournament(1)
      ).to.be.revertedWithCustomError(
        tournamentPlatform,
        "CanOnlyCancelDuringRegistration"
      );
    });
  });
});
