// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Gas Optimized Tournament Platform
/// @notice Platform for creating and managing tournaments with prize distribution
contract TournamentPlatform is Ownable, ReentrancyGuard {
    // Custom errors
    error PlayerAlreadyRegistered();
    error StartTimeMustBeInFuture();
    error EndTimeMustBeAfterStartTime();
    error TournamentMustAllowAtLeastTwoPlayers();
    error PlayerNotRegistered();
    error TournamentDoesNotExist();
    error TournamentNotInRegistrationPhase();
    error PlayerAlreadyJoined();
    error TournamentIsFull();
    error TournamentHasAlreadyStarted();
    error IncorrectEntryFee();
    error CanOnlyCancelDuringRegistration();
    error TournamentNotInProgress();
    error PlayerNotInTournament();
    error TournamentScoreSubmissionEnded();
    error TournamentNotEndedYet();

    // Structs
    struct Player {
        uint256 id;
        bool exists;
    }

    struct Tournament {
        uint256 id;
        string name;
        uint256 entryFee;
        uint256 maxPlayers;
        uint256 startTime;
        uint256 endTime;
        string gameType;
        TournamentStatus status;
        uint256 totalPrizePool;
        address[] players;
        mapping(address => bool) playerJoined;
        mapping(address => uint256) playerScores;
        address[] winners;
    }

    struct TournamentView {
        uint256 id;
        string name;
        uint256 entryFee;
        uint256 maxPlayers;
        uint256 startTime;
        uint256 endTime;
        string gameType;
        TournamentStatus status;
        uint256 totalPrizePool;
        uint256 currentPlayers;
        address[] players;
    }

    enum TournamentStatus {
        Registration,
        InProgress,
        Completed,
        Canceled
    }

    // State variables
    uint256 public playersCount;
    uint256 public tournamentsCount;

    mapping(address => Player) public players;
    mapping(uint256 => Tournament) public tournaments;

    // Events
    event PlayerRegistered(uint256 playerId, address playerAddress);
    event TournamentCreated(
        uint256 tournamentId,
        string name,
        uint256 entryFee,
        uint256 maxPlayers,
        uint256 startTime
    );
    event PlayerJoinedTournament(uint256 tournamentId, address player);
    event TournamentStarted(uint256 tournamentId);
    event TournamentCanceled(uint256 tournamentId);
    event ScoreSubmitted(uint256 tournamentId, address player, uint256 score);
    event RewardsDistributed(uint256 tournamentId, address[] winners);

    constructor() Ownable(msg.sender) {
        // No need to initialize values as they default to 0
    }

    // Simplified player registration
    function registerPlayer() external {
        if (players[msg.sender].exists) revert PlayerAlreadyRegistered();

        unchecked {
            playersCount++;
        }

        players[msg.sender] = Player({id: playersCount, exists: true});

        emit PlayerRegistered(playersCount, msg.sender);
    }

    // Admin functions
    function createTournament(
        string calldata _name,
        uint256 _entryFee,
        uint256 _maxPlayers,
        uint256 _startTime,
        uint256 _endTime,
        string calldata _gameType
    ) external onlyOwner {
        if (_startTime <= block.timestamp) revert StartTimeMustBeInFuture();
        if (_endTime <= _startTime) revert EndTimeMustBeAfterStartTime();
        if (_maxPlayers <= 1) revert TournamentMustAllowAtLeastTwoPlayers();

        unchecked {
            tournamentsCount++;
        }

        Tournament storage newTournament = tournaments[tournamentsCount];

        newTournament.id = tournamentsCount;
        newTournament.name = _name;
        newTournament.entryFee = _entryFee;
        newTournament.maxPlayers = _maxPlayers;
        newTournament.startTime = _startTime;
        newTournament.endTime = _endTime;
        newTournament.gameType = _gameType;
        newTournament.status = TournamentStatus.Registration;
        // totalPrizePool defaults to 0

        emit TournamentCreated(
            tournamentsCount,
            _name,
            _entryFee,
            _maxPlayers,
            _startTime
        );
    }

    // User functions
    function joinTournament(
        uint256 _tournamentId
    ) external payable nonReentrant {
        Tournament storage tournament = tournaments[_tournamentId];

        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status != TournamentStatus.Registration)
            revert TournamentNotInRegistrationPhase();
        if (tournament.playerJoined[msg.sender]) revert PlayerAlreadyJoined();
        if (tournament.players.length >= tournament.maxPlayers)
            revert TournamentIsFull();
        if (tournament.startTime <= block.timestamp)
            revert TournamentHasAlreadyStarted();
        if (msg.value != tournament.entryFee) revert IncorrectEntryFee();

        // Always handle player registration if not already registered
        if (!players[msg.sender].exists) {
            unchecked {
                playersCount++;
            }
            players[msg.sender] = Player({id: playersCount, exists: true});
            emit PlayerRegistered(playersCount, msg.sender);
        }

        tournament.players.push(msg.sender);
        tournament.playerJoined[msg.sender] = true;
        tournament.totalPrizePool += msg.value;

        emit PlayerJoinedTournament(_tournamentId, msg.sender);

        // Check if tournament is full and start automatically
        if (tournament.players.length == tournament.maxPlayers) {
            _startTournament(_tournamentId);
        }
    }

    function _startTournament(uint256 _tournamentId) internal {
        Tournament storage tournament = tournaments[_tournamentId];
        tournament.status = TournamentStatus.InProgress;

        emit TournamentStarted(_tournamentId);
    }

    function cancelTournament(uint256 _tournamentId) external onlyOwner {
        Tournament storage tournament = tournaments[_tournamentId];

        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status != TournamentStatus.Registration)
            revert CanOnlyCancelDuringRegistration();

        tournament.status = TournamentStatus.Canceled;

        // Refund all players
        uint256 playerCount = tournament.players.length;
        for (uint256 i = 0; i < playerCount; ) {
            address player = tournament.players[i];
            payable(player).transfer(tournament.entryFee);

            unchecked {
                ++i;
            }
        }

        emit TournamentCanceled(_tournamentId);
    }

    // Function to manually start a tournament (admin only)
    function startTournament(uint256 _tournamentId) external onlyOwner {
        Tournament storage tournament = tournaments[_tournamentId];

        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status != TournamentStatus.Registration)
            revert TournamentNotInRegistrationPhase();
        if (tournament.players.length < 2)
            revert TournamentMustAllowAtLeastTwoPlayers();

        _startTournament(_tournamentId);
    }

    // Backend score submission (admin only)
    function submitScore(
        uint256 _tournamentId,
        address _player,
        uint256 _score
    ) external onlyOwner {
        Tournament storage tournament = tournaments[_tournamentId];

        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status != TournamentStatus.InProgress)
            revert TournamentNotInProgress();
        if (!tournament.playerJoined[_player]) revert PlayerNotInTournament();
        if (block.timestamp > tournament.endTime)
            revert TournamentScoreSubmissionEnded();

        tournament.playerScores[_player] = _score;

        emit ScoreSubmitted(_tournamentId, _player, _score);
    }

    // Finalize tournament and distribute rewards
    function finalizeTournament(uint256 _tournamentId) external onlyOwner {
        Tournament storage tournament = tournaments[_tournamentId];

        if (tournament.id == 0) revert TournamentDoesNotExist();
        if (tournament.status != TournamentStatus.InProgress)
            revert TournamentNotInProgress();
        if (block.timestamp <= tournament.endTime)
            revert TournamentNotEndedYet();

        // Find top 3 players or less if not enough participants
        address[] memory topPlayers = _getTopPlayers(_tournamentId, 3);
        tournament.winners = topPlayers;

        // Distribute rewards based on position
        uint256 topPlayersLength = topPlayers.length;
        if (topPlayersLength > 0) {
            uint256 prizePool = tournament.totalPrizePool;

            if (topPlayersLength == 1) {
                // Only one player gets 100%
                payable(topPlayers[0]).transfer(prizePool);
            } else if (topPlayersLength == 2) {
                // First place: 70%, Second place: 30%
                uint256 firstPlacePrize = (prizePool * 70) / 100;
                payable(topPlayers[0]).transfer(firstPlacePrize);
                payable(topPlayers[1]).transfer(prizePool - firstPlacePrize); // Safer than calculating 30%
            } else {
                // First place: 50%, Second place: 30%, Third place: 20%
                uint256 firstPlacePrize = (prizePool * 50) / 100;
                uint256 secondPlacePrize = (prizePool * 30) / 100;

                payable(topPlayers[0]).transfer(firstPlacePrize);
                payable(topPlayers[1]).transfer(secondPlacePrize);
                payable(topPlayers[2]).transfer(
                    prizePool - firstPlacePrize - secondPlacePrize
                );
            }
        }

        tournament.status = TournamentStatus.Completed;

        emit RewardsDistributed(_tournamentId, topPlayers);
    }

    // Helper function to get top N players by score
    function _getTopPlayers(
        uint256 _tournamentId,
        uint256 _count
    ) internal view returns (address[] memory) {
        Tournament storage tournament = tournaments[_tournamentId];

        // Determine how many players to return (min of _count or actual players)
        uint256 playerCount = tournament.players.length;
        uint256 returnCount = playerCount < _count ? playerCount : _count;

        // Create memory arrays for addresses and scores for sorting
        address[] memory playerAddresses = new address[](playerCount);
        uint256[] memory playerScores = new uint256[](playerCount);

        for (uint256 i = 0; i < playerCount; ) {
            address player = tournament.players[i];
            playerAddresses[i] = player;
            playerScores[i] = tournament.playerScores[player];

            unchecked {
                ++i;
            }
        }

        // Sort players by score (descending)
        for (uint256 i = 0; i < playerCount; ) {
            for (uint256 j = i + 1; j < playerCount; ) {
                if (playerScores[i] < playerScores[j]) {
                    // Swap scores
                    uint256 tempScore = playerScores[i];
                    playerScores[i] = playerScores[j];
                    playerScores[j] = tempScore;

                    // Swap addresses
                    address tempAddr = playerAddresses[i];
                    playerAddresses[i] = playerAddresses[j];
                    playerAddresses[j] = tempAddr;
                }

                unchecked {
                    ++j;
                }
            }

            unchecked {
                ++i;
            }
        }

        // Return top N players
        address[] memory topPlayers = new address[](returnCount);
        for (uint256 i = 0; i < returnCount; ) {
            topPlayers[i] = playerAddresses[i];

            unchecked {
                ++i;
            }
        }

        return topPlayers;
    }

    // View functions
    function getPlayerDetails(
        address _player
    ) external view returns (Player memory) {
        return players[_player];
    }

    function getTournamentDetails(
        uint256 _tournamentId
    ) external view returns (TournamentView memory) {
        Tournament storage tournament = tournaments[_tournamentId];
        return
            TournamentView({
                id: tournament.id,
                name: tournament.name,
                entryFee: tournament.entryFee,
                maxPlayers: tournament.maxPlayers,
                startTime: tournament.startTime,
                endTime: tournament.endTime,
                gameType: tournament.gameType,
                status: tournament.status,
                totalPrizePool: tournament.totalPrizePool,
                currentPlayers: tournament.players.length,
                players: tournament.players
            });
    }

    function getAllTournaments()
        external
        view
        returns (TournamentView[] memory)
    {
        TournamentView[] memory allTournaments = new TournamentView[](
            tournamentsCount
        );

        for (uint256 i = 0; i < tournamentsCount; ) {
            Tournament storage tournament = tournaments[i + 1]; // IDs start from 1
            allTournaments[i] = TournamentView({
                id: tournament.id,
                name: tournament.name,
                entryFee: tournament.entryFee,
                maxPlayers: tournament.maxPlayers,
                startTime: tournament.startTime,
                endTime: tournament.endTime,
                gameType: tournament.gameType,
                status: tournament.status,
                totalPrizePool: tournament.totalPrizePool,
                currentPlayers: tournament.players.length,
                players: tournament.players
            });

            unchecked {
                ++i;
            }
        }

        return allTournaments;
    }

    function getTournamentPlayers(
        uint256 _tournamentId
    ) external view returns (address[] memory) {
        return tournaments[_tournamentId].players;
    }

    function getPlayerScore(
        uint256 _tournamentId,
        address _player
    ) external view returns (uint256) {
        return tournaments[_tournamentId].playerScores[_player];
    }

    function getTournamentWinners(
        uint256 _tournamentId
    ) external view returns (address[] memory) {
        return tournaments[_tournamentId].winners;
    }

    function getTournamentStatus(
        uint256 _tournamentId
    ) external view returns (TournamentStatus) {
        return tournaments[_tournamentId].status;
    }
}
