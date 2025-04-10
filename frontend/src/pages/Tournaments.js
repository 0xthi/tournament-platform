import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  CardHeader,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  CircularProgress,
  Alert,
  Avatar,
  Snackbar,
} from "@mui/material";
import {
  SportsEsports,
  Refresh,
  EmojiEvents,
  AccessTime,
  People,
  MonetizationOn,
  Info,
  OpenInNew,
  Person,
  ArrowForward,
  Check,
  Close,
  Search,
} from "@mui/icons-material";
import TournamentPlatform from "../contracts/contracts/TournamentPlatform.sol/TournamentPlatform.json";

function Tournaments({ contract, account }) {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [playerDetails, setPlayerDetails] = useState(null);
  const [notification, setNotification] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [contractWithSigner, setContractWithSigner] = useState(null);

  const MIN_ENTRY_FEE = "0.0000001";

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

  const getStatusIcon = (status) => {
    switch (status) {
      case 0:
        return <Person />;
      case 1:
        return <SportsEsports />;
      case 2:
        return <EmojiEvents />;
      case 3:
        return <Close />;
      default:
        return <Info />;
    }
  };

  // Initialize contract with signer when account and contract are available
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
        console.log("Contract with signer initialized");
      } catch (error) {
        console.error("Error initializing contract with signer:", error);
      }
    };

    initContractWithSigner();
  }, [account, contract]);

  const fetchPlayerDetails = async () => {
    if (!account || !contract) return;
    try {
      const details = await contract.getPlayerDetails(account);
      setPlayerDetails({
        id: details.id.toNumber(),
        exists: details.exists,
      });
    } catch (error) {
      console.error("Error fetching player details:", error);
    }
  };

  const fetchTournaments = useCallback(async () => {
    if (!contract) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch player details
      if (account) {
        await fetchPlayerDetails();
      }

      const allTournaments = await contract.getAllTournaments();
      const currentTime = Math.floor(Date.now() / 1000);

      const formattedTournaments = await Promise.all(
        allTournaments.map(async (tournament) => {
          // Get timestamps for status determination
          const startTimestamp = tournament.startTime.toNumber();
          const endTimestamp = tournament.endTime.toNumber();

          // Determine the real status based on time and contract status
          let realStatus = tournament.status;

          // If status is Registration (0) but start time has passed, show as In Progress
          if (realStatus === 0 && currentTime >= startTimestamp) {
            realStatus = 1; // In Progress
          }

          // If status is In Progress (1) but end time has passed, it should be completed
          // but we'll still show it as In Progress until finalized by admin

          // Check if the current user is a participant
          const isParticipant = tournament.players.some(
            (p) => account && p.toLowerCase() === account.toLowerCase()
          );

          // Get player details for this tournament
          const playerAddresses = tournament.players;
          const players = [];

          // Only fetch details if there are players
          if (playerAddresses.length > 0) {
            for (const addr of playerAddresses) {
              try {
                const playerDetails = await contract.getPlayerDetails(addr);
                players.push({
                  address: addr,
                  id: playerDetails.id.toNumber(),
                  exists: playerDetails.exists,
                });
              } catch (error) {
                console.error(
                  `Error fetching details for player ${addr}:`,
                  error
                );
              }
            }
          }

          return {
            id: tournament.id.toNumber(),
            name: tournament.name,
            entryFee: ethers.utils.formatEther(tournament.entryFee),
            prizePool: ethers.utils.formatEther(tournament.totalPrizePool),
            startTime: new Date(startTimestamp * 1000),
            endTime: new Date(endTimestamp * 1000),
            status: tournament.status,
            displayStatus: realStatus, // Use this for UI display
            playerCount: tournament.currentPlayers.toNumber(),
            maxPlayers: tournament.maxPlayers.toNumber(),
            gameType: tournament.gameType,
            players: players,
            isParticipant,
          };
        })
      );

      setTournaments(formattedTournaments);
    } catch (err) {
      setError("Failed to fetch tournaments. Please try again.");
      console.error("Error fetching tournaments:", err);
    } finally {
      setLoading(false);
    }
  }, [contract, account]);

  useEffect(() => {
    fetchTournaments();
  }, [fetchTournaments]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  const handleJoinTournament = async (tournament) => {
    if (!account) {
      setNotification({
        open: true,
        message: "Please connect your wallet first",
        severity: "warning",
      });
      return;
    }

    if (!contractWithSigner) {
      console.error("Contract with signer not initialized");
      setNotification({
        open: true,
        message:
          "Contract not initialized correctly. Please try refreshing the page.",
        severity: "error",
      });
      return;
    }

    if (tournament.displayStatus !== 0) {
      setNotification({
        open: true,
        message: "This tournament is no longer open for registration",
        severity: "error",
      });
      return;
    }

    if (tournament.playerCount >= tournament.maxPlayers) {
      setNotification({
        open: true,
        message: "This tournament is full",
        severity: "error",
      });
      return;
    }

    try {
      setJoinLoading(true);

      // Fetch the latest tournament details directly from the contract
      // This ensures we're using the exact entry fee value from the contract
      let entryFeeWei;

      try {
        const rawTournament = await contract.getTournamentDetails(
          tournament.id
        );
        console.log("Raw tournament data from contract:", {
          id: rawTournament.id.toString(),
          entryFee: rawTournament.entryFee.toString(),
          formattedEntryFee: ethers.utils.formatEther(rawTournament.entryFee),
        });
        console.log("Tournament data from UI:", {
          id: tournament.id,
          entryFee: tournament.entryFee,
          entryFeeAsWei: ethers.utils
            .parseEther(tournament.entryFee.toString())
            .toString(),
        });

        // Use the exact entry fee from the contract
        entryFeeWei = rawTournament.entryFee;
      } catch (debugError) {
        console.error("Error fetching raw tournament data:", debugError);
        // Fallback to UI value if contract fetch fails
        entryFeeWei = ethers.utils.parseEther(tournament.entryFee.toString());
      }

      console.log(
        `Joining tournament #${
          tournament.id
        } with entry fee: ${ethers.utils.formatEther(
          entryFeeWei
        )} ETH (${entryFeeWei.toString()} wei)`
      );

      // Call the joinTournament function with the signer
      const tx = await contractWithSigner.joinTournament(tournament.id, {
        value: entryFeeWei,
        gasLimit: 300000, // Add gas limit to prevent transaction failures
      });

      console.log("Transaction sent:", tx.hash);
      setNotification({
        open: true,
        message: `Transaction submitted. Please wait for confirmation... (Hash: ${tx.hash.slice(
          0,
          10
        )}...)`,
        severity: "info",
      });

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Refresh tournaments after joining
      await fetchTournaments();

      setNotification({
        open: true,
        message: "Successfully joined the tournament!",
        severity: "success",
      });
    } catch (error) {
      console.error("Error joining tournament:", error);

      // Check for common errors
      let errorMessage = "Failed to join tournament. ";

      if (error.code === 4001) {
        errorMessage += "Transaction was rejected by user.";
      } else if (error.message.includes("insufficient funds")) {
        errorMessage += "Insufficient funds to cover entry fee and gas.";
      } else if (error.message.includes("execution reverted")) {
        // Try to extract the revert reason
        let revertReason = "Unknown reason";

        // More detailed error extraction
        if (error.data) {
          revertReason = error.data.message || error.message;
        } else if (error.reason) {
          revertReason = error.reason;
        } else if (error.message.match(/reverted with reason string '(.*)'/)) {
          revertReason = error.message.match(
            /reverted with reason string '(.*)'/
          )[1];
        } else if (error.message.match(/reverted with custom error '(.*)'/)) {
          revertReason = error.message.match(
            /reverted with custom error '(.*)'/
          )[1];
        }

        errorMessage += `Smart contract error: ${revertReason}`;
        console.error("Full error object:", JSON.stringify(error, null, 2));
      } else {
        errorMessage += error.message;
      }

      setNotification({
        open: true,
        message: errorMessage,
        severity: "error",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const filteredTournaments = () => {
    switch (tabValue) {
      case 0: // All tournaments
        return tournaments;
      case 1: // Registration Open
        return tournaments.filter((t) => t.status === 0);
      case 2: // In Progress
        return tournaments.filter((t) => t.displayStatus === 1);
      case 3: // Completed
        return tournaments.filter((t) => t.status === 2);
      case 4: // My Tournaments
        return tournaments.filter((t) => t.isParticipant);
      default:
        return tournaments;
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
            Please connect your wallet to view and join tournaments.
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            You'll need MetaMask or another Ethereum wallet to participate.
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
          <Typography variant="h6">Loading tournaments...</Typography>
        </Paper>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={fetchTournaments}>
              Retry
            </Button>
          }
          sx={{ mb: 4 }}
        >
          {error}
        </Alert>

        <Paper
          elevation={3}
          sx={{ p: 4, textAlign: "center", borderRadius: 2 }}
        >
          <Typography variant="h5" color="error" gutterBottom>
            Failed to load tournaments
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={fetchTournaments}
            startIcon={<Refresh />}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Paper elevation={2} sx={{ p: 2, mb: 4, borderRadius: 2 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Typography variant="h4" component="h1">
            Tournaments
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<Refresh />}
            onClick={fetchTournaments}
          >
            Refresh
          </Button>
        </Box>

        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 3 }}
        >
          <Tab label="All Tournaments" icon={<Search />} iconPosition="start" />
          <Tab
            label="Registration Open"
            icon={<Person />}
            iconPosition="start"
          />
          <Tab
            label="In Progress"
            icon={<SportsEsports />}
            iconPosition="start"
          />
          <Tab label="Completed" icon={<EmojiEvents />} iconPosition="start" />
          <Tab label="My Tournaments" icon={<Check />} iconPosition="start" />
        </Tabs>

        {filteredTournaments().length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary">
              No tournaments found in this category
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {filteredTournaments().map((tournament) => (
              <Grid item xs={12} sm={6} md={4} key={tournament.id}>
                <Card
                  elevation={3}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    transition: "0.3s",
                    "&:hover": {
                      transform: "translateY(-5px)",
                      boxShadow: 6,
                    },
                    position: "relative",
                  }}
                >
                  {tournament.isParticipant && (
                    <Chip
                      label="Joined"
                      color="primary"
                      icon={<Check />}
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 10,
                        right: 10,
                        zIndex: 1,
                      }}
                    />
                  )}

                  <CardHeader
                    title={tournament.name}
                    subheader={`#${tournament.id} - ${tournament.gameType}`}
                    sx={{ pb: 0 }}
                  />

                  <CardContent sx={{ pt: 1, pb: 1, flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>
                      <Chip
                        label={getStatusText(tournament.displayStatus)}
                        icon={getStatusIcon(tournament.displayStatus)}
                        sx={{
                          bgcolor: getStatusColor(tournament.displayStatus),
                          color: "white",
                          fontWeight: "bold",
                        }}
                      />
                    </Box>

                    <Grid container spacing={1}>
                      <Grid item xs={6}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center" }}
                        >
                          <MonetizationOn fontSize="small" sx={{ mr: 0.5 }} />
                          Entry Fee:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {tournament.entryFee} ETH
                        </Typography>
                      </Grid>

                      <Grid item xs={6}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center" }}
                        >
                          <EmojiEvents fontSize="small" sx={{ mr: 0.5 }} />
                          Prize Pool:
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {tournament.prizePool} ETH
                        </Typography>
                      </Grid>

                      <Grid item xs={12} sx={{ mt: 1 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center" }}
                        >
                          <People fontSize="small" sx={{ mr: 0.5 }} />
                          Players:
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Box sx={{ width: "100%", mr: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={
                                (tournament.playerCount /
                                  tournament.maxPlayers) *
                                100
                              }
                              sx={{ height: 8, borderRadius: 5 }}
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {tournament.playerCount}/{tournament.maxPlayers}
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sx={{ mt: 1 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: "flex", alignItems: "center" }}
                        >
                          <AccessTime fontSize="small" sx={{ mr: 0.5 }} />
                          {tournament.displayStatus === 0
                            ? "Starts:"
                            : tournament.displayStatus === 1
                            ? "Ends:"
                            : "Ended:"}
                        </Typography>
                        <Typography variant="body2">
                          {tournament.displayStatus === 0
                            ? tournament.startTime.toLocaleString()
                            : tournament.endTime.toLocaleString()}
                        </Typography>
                      </Grid>
                    </Grid>

                    {tournament.players.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5 }}
                        >
                          Participants:
                        </Typography>
                        <Box
                          sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}
                        >
                          {tournament.players
                            .slice(0, 5)
                            .map((player, index) => (
                              <Tooltip
                                title={`Player #${player.id}: ${player.address}`}
                                key={index}
                              >
                                <Avatar
                                  sx={{
                                    width: 30,
                                    height: 30,
                                    fontSize: "0.75rem",
                                    bgcolor:
                                      player.address.toLowerCase() ===
                                      account.toLowerCase()
                                        ? "#1976d2"
                                        : "#757575",
                                  }}
                                >
                                  {player.id}
                                </Avatar>
                              </Tooltip>
                            ))}
                          {tournament.players.length > 5 && (
                            <Tooltip
                              title={`${
                                tournament.players.length - 5
                              } more player(s)`}
                            >
                              <Avatar
                                sx={{
                                  width: 30,
                                  height: 30,
                                  fontSize: "0.75rem",
                                }}
                              >
                                +{tournament.players.length - 5}
                              </Avatar>
                            </Tooltip>
                          )}
                        </Box>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions sx={{ mt: "auto", pt: 0 }}>
                    <Button
                      component={Link}
                      to={`/tournaments/${tournament.id}`}
                      size="small"
                      endIcon={<OpenInNew />}
                      sx={{ mr: 1 }}
                    >
                      Details
                    </Button>

                    {tournament.displayStatus === 0 &&
                      !tournament.isParticipant &&
                      tournament.playerCount < tournament.maxPlayers && (
                        <Button
                          size="small"
                          variant="contained"
                          color="primary"
                          disabled={joinLoading}
                          onClick={() => handleJoinTournament(tournament)}
                          endIcon={
                            joinLoading ? (
                              <CircularProgress size={16} />
                            ) : (
                              <ArrowForward />
                            )
                          }
                        >
                          Join Tournament
                        </Button>
                      )}

                    {tournament.isParticipant && (
                      <Button
                        component={Link}
                        to={`/tournaments/${tournament.id}`}
                        size="small"
                        variant="contained"
                        color="secondary"
                      >
                        View My Entry
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default Tournaments;
