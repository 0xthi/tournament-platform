import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Chip,
  Divider,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Avatar,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import {
  SportsEsports,
  EmojiEvents,
  AccessTime,
  People,
  Person,
  MonetizationOn,
  ArrowBack,
  ArrowForward,
  Check,
} from "@mui/icons-material";

function TournamentDetails({ contract, account }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contractWithSigner, setContractWithSigner] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [playerDetails, setPlayerDetails] = useState([]);
  const [winners, setWinners] = useState([]);

  // Initialize contract with signer
  useEffect(() => {
    const initContractWithSigner = async () => {
      if (!account || !contract) return;

      try {
        // Get provider from window.ethereum
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // Create new contract instance with signer
        const contractWithSigner = new ethers.Contract(
          contract.address,
          contract.interface,
          signer
        );

        setContractWithSigner(contractWithSigner);
      } catch (error) {
        console.error("Error initializing contract with signer:", error);
      }
    };

    initContractWithSigner();
  }, [account, contract]);

  useEffect(() => {
    const fetchTournamentDetails = async () => {
      if (!contract || !id) return;

      try {
        setLoading(true);
        setError(null);

        console.log("Fetching tournament details for ID:", id);
        const tournamentData = await contract.getTournamentDetails(id);

        console.log("Raw tournament data:", tournamentData);

        if (!tournamentData || tournamentData.id.toNumber() === 0) {
          setError("Tournament not found");
          setLoading(false);
          return;
        }

        // Get current timestamp to determine actual status
        const currentTime = Math.floor(Date.now() / 1000);
        const startTimestamp = tournamentData.startTime.toNumber();
        const endTimestamp = tournamentData.endTime.toNumber();

        // Determine real status
        let displayStatus = tournamentData.status;
        if (displayStatus === 0 && currentTime >= startTimestamp) {
          displayStatus = 1; // Show as In Progress if start time has passed
        }

        // Check if user has joined
        const isParticipant = tournamentData.players.some(
          (p) => account && p.toLowerCase() === account.toLowerCase()
        );

        // Format tournament data
        const formattedTournament = {
          id: tournamentData.id.toNumber(),
          name: tournamentData.name,
          entryFee: ethers.utils.formatEther(tournamentData.entryFee),
          prizePool: ethers.utils.formatEther(tournamentData.totalPrizePool),
          maxPlayers: tournamentData.maxPlayers.toNumber(),
          playerCount: tournamentData.currentPlayers.toNumber(),
          startTime: new Date(startTimestamp * 1000),
          endTime: new Date(endTimestamp * 1000),
          status: tournamentData.status,
          displayStatus: displayStatus,
          gameType: tournamentData.gameType,
          players: tournamentData.players,
          isParticipant: isParticipant,
        };

        setTournament(formattedTournament);

        // Fetch player details
        const playerDetailsPromises = tournamentData.players.map(
          async (playerAddress) => {
            try {
              const details = await contract.getPlayerDetails(playerAddress);
              const score = await contract.getPlayerScore(id, playerAddress);

              return {
                address: playerAddress,
                id: details.id.toNumber(),
                exists: details.exists,
                score: score.toNumber(),
                isCurrentUser:
                  account &&
                  playerAddress.toLowerCase() === account.toLowerCase(),
              };
            } catch (error) {
              console.error(
                `Error fetching details for player ${playerAddress}:`,
                error
              );
              return {
                address: playerAddress,
                id: 0,
                exists: false,
                score: 0,
                isCurrentUser:
                  account &&
                  playerAddress.toLowerCase() === account.toLowerCase(),
              };
            }
          }
        );

        const playerDetailsResults = await Promise.all(playerDetailsPromises);
        setPlayerDetails(playerDetailsResults);

        // Get tournament winners if completed
        if (tournamentData.status === 2) {
          try {
            const tournamentWinners = await contract.getTournamentWinners(id);
            setWinners(tournamentWinners);
          } catch (error) {
            console.error("Error fetching winners:", error);
          }
        }
      } catch (error) {
        console.error("Error fetching tournament details:", error);
        setError("Failed to fetch tournament details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTournamentDetails();
  }, [contract, id, account]);

  const getStatusText = (status) => {
    switch (status) {
      case 0:
        return "Registration Open";
      case 1:
        return "In Progress";
      case 2:
        return "Completed";
      case 3:
        return "Canceled";
      default:
        return "Unknown";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 0:
        return "#2196f3"; // Registration
      case 1:
        return "#4caf50"; // In Progress
      case 2:
        return "#9c27b0"; // Completed
      case 3:
        return "#f44336"; // Canceled
      default:
        return "#9e9e9e";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 0:
        return <Person />;
      case 1:
        return <SportsEsports />;
      case 2:
        return <EmojiEvents />;
      case 3:
        return <Check />;
      default:
        return <Person />;
    }
  };

  const handleJoinTournament = async () => {
    if (!account) {
      setError("Please connect your wallet first");
      return;
    }

    if (!contractWithSigner) {
      setError(
        "Contract not initialized correctly. Please try refreshing the page."
      );
      return;
    }

    if (tournament.displayStatus !== 0) {
      setError("This tournament is no longer open for registration");
      return;
    }

    if (tournament.playerCount >= tournament.maxPlayers) {
      setError("This tournament is full");
      return;
    }

    try {
      setJoinLoading(true);

      // Parse the entry fee to wei for the transaction
      const entryFeeWei = ethers.utils.parseEther(tournament.entryFee);

      console.log(
        `Joining tournament #${tournament.id} with entry fee: ${
          tournament.entryFee
        } ETH (${entryFeeWei.toString()} wei)`
      );

      // Call the joinTournament function with the signer
      const tx = await contractWithSigner.joinTournament(tournament.id, {
        value: entryFeeWei,
        gasLimit: 300000, // Add gas limit to prevent transaction failures
      });

      console.log("Transaction sent:", tx.hash);

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Refresh tournament details
      window.location.reload();
    } catch (error) {
      console.error("Error joining tournament:", error);

      // Extract error message
      let errorMessage = "Failed to join tournament: ";

      if (error.code === 4001) {
        errorMessage += "Transaction was rejected by user.";
      } else if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds to cover entry fee and gas.";
      } else if (error.message.includes("execution reverted")) {
        errorMessage +=
          "Smart contract rejected the transaction. Possible reasons: incorrect entry fee, tournament full, or already registered.";
      } else {
        errorMessage += error.message;
      }

      setError(errorMessage);
    } finally {
      setJoinLoading(false);
    }
  };

  if (!account) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper
          elevation={3}
          sx={{ p: 4, textAlign: "center", borderRadius: 2 }}
        >
          <SportsEsports sx={{ fontSize: 80, color: "#1976d2", my: 2 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            Connect Your Wallet
          </Typography>
          <Typography variant="body1" paragraph>
            Please connect your wallet to view tournament details.
          </Typography>
        </Paper>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper
          elevation={3}
          sx={{ p: 4, textAlign: "center", borderRadius: 2 }}
        >
          <CircularProgress sx={{ my: 4 }} />
          <Typography variant="h6">Loading tournament details...</Typography>
        </Paper>
      </Container>
    );
  }

  if (error && !tournament) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>

        <Paper
          elevation={3}
          sx={{ p: 4, textAlign: "center", borderRadius: 2 }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Failed to load tournament details
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBack />}
            component={Link}
            to="/tournaments"
            sx={{ mt: 2 }}
          >
            Back to Tournaments
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!tournament) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper
          elevation={3}
          sx={{ p: 4, textAlign: "center", borderRadius: 2 }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Tournament not found
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<ArrowBack />}
            component={Link}
            to="/tournaments"
            sx={{ mt: 2 }}
          >
            Back to Tournaments
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 3,
        }}
      >
        <Button
          variant="outlined"
          component={Link}
          to="/tournaments"
          startIcon={<ArrowBack />}
          sx={{ mb: 2 }}
        >
          Back to Tournaments
        </Button>

        {tournament.displayStatus === 0 &&
          !tournament.isParticipant &&
          tournament.playerCount < tournament.maxPlayers && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleJoinTournament}
              disabled={joinLoading}
              endIcon={
                joinLoading ? <CircularProgress size={20} /> : <ArrowForward />
              }
            >
              Join Tournament
            </Button>
          )}
      </Box>

      <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
        <Box
          sx={{
            mb: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="h4" component="h1">
            {tournament.name}
          </Typography>
          <Chip
            label={getStatusText(tournament.displayStatus)}
            icon={getStatusIcon(tournament.displayStatus)}
            sx={{
              bgcolor: getStatusColor(tournament.displayStatus),
              color: "white",
              fontWeight: "bold",
              px: 1,
            }}
          />
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Tournament Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <MonetizationOn color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Entry Fee:
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ pl: 4 }}>
                      {tournament.entryFee} ETH
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <EmojiEvents color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Prize Pool:
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ pl: 4 }}>
                      {tournament.prizePool} ETH
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <AccessTime color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Start Time:
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ pl: 4 }}>
                      {tournament.startTime.toLocaleString()}
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <AccessTime color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        End Time:
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ pl: 4 }}>
                      {tournament.endTime.toLocaleString()}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <SportsEsports color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Game Type:
                      </Typography>
                    </Box>
                    <Typography variant="body1" sx={{ pl: 4 }}>
                      {tournament.gameType}
                    </Typography>
                  </Grid>

                  <Grid item xs={12}>
                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                      <People color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">
                        Players:
                      </Typography>
                    </Box>
                    <Box sx={{ pl: 4, width: "100%" }}>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Box sx={{ width: "100%", mr: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={
                              (tournament.playerCount / tournament.maxPlayers) *
                              100
                            }
                            sx={{ height: 8, borderRadius: 5 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          {tournament.playerCount}/{tournament.maxPlayers}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {tournament.status === 2 && winners.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    <EmojiEvents color="primary" sx={{ mr: 1 }} />
                    Winners
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Position</TableCell>
                          <TableCell>Player</TableCell>
                          <TableCell align="right">Reward</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {winners.map((winner, index) => {
                          const playerDetail = playerDetails.find(
                            (p) =>
                              p.address.toLowerCase() === winner.toLowerCase()
                          );
                          const percentages = [50, 30, 20]; // First, second, third place percentages
                          const prizePercentage =
                            index < percentages.length ? percentages[index] : 0;
                          const prize = (
                            (parseFloat(tournament.prizePool) *
                              prizePercentage) /
                            100
                          ).toFixed(4);

                          return (
                            <TableRow
                              key={index}
                              sx={{
                                bgcolor: playerDetail?.isCurrentUser
                                  ? "rgba(25, 118, 210, 0.08)"
                                  : "inherit",
                              }}
                            >
                              <TableCell>{index + 1}</TableCell>
                              <TableCell>
                                <Box
                                  sx={{ display: "flex", alignItems: "center" }}
                                >
                                  <Avatar
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      fontSize: "0.75rem",
                                      mr: 1,
                                      bgcolor: playerDetail?.isCurrentUser
                                        ? "#1976d2"
                                        : "#757575",
                                    }}
                                  >
                                    {playerDetail?.id || "?"}
                                  </Avatar>
                                  <Tooltip title={winner}>
                                    <Typography
                                      variant="body2"
                                      noWrap
                                      sx={{ maxWidth: 150 }}
                                    >
                                      {winner.slice(0, 6)}...{winner.slice(-4)}
                                      {playerDetail?.isCurrentUser && " (You)"}
                                    </Typography>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                              <TableCell align="right">{prize} ETH</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <People color="primary" sx={{ mr: 1 }} />
                  Players & Scores
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {playerDetails.length === 0 ? (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: "center", py: 2 }}
                  >
                    No players have joined this tournament yet
                  </Typography>
                ) : (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Player</TableCell>
                          <TableCell align="right">Score</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {playerDetails
                          .sort((a, b) => b.score - a.score)
                          .map((player, index) => (
                            <TableRow
                              key={index}
                              sx={{
                                bgcolor: player.isCurrentUser
                                  ? "rgba(25, 118, 210, 0.08)"
                                  : "inherit",
                              }}
                            >
                              <TableCell>
                                <Box
                                  sx={{ display: "flex", alignItems: "center" }}
                                >
                                  <Avatar
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      fontSize: "0.75rem",
                                      mr: 1,
                                      bgcolor: player.isCurrentUser
                                        ? "#1976d2"
                                        : "#757575",
                                    }}
                                  >
                                    {player.id || "?"}
                                  </Avatar>
                                  <Tooltip title={player.address}>
                                    <Typography
                                      variant="body2"
                                      noWrap
                                      sx={{ maxWidth: 120 }}
                                    >
                                      {player.address.slice(0, 6)}...
                                      {player.address.slice(-4)}
                                      {player.isCurrentUser && " (You)"}
                                    </Typography>
                                  </Tooltip>
                                </Box>
                              </TableCell>
                              <TableCell align="right">
                                {player.score}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {tournament.isParticipant && tournament.displayStatus === 1 && (
                  <Box sx={{ mt: 2, textAlign: "center" }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      You are participating in this tournament!
                    </Typography>
                    <Typography variant="body2" gutterBottom>
                      Scores are submitted by the tournament admin.
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
}

export default TournamentDetails;
