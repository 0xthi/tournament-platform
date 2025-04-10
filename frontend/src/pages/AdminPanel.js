import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Box,
  CircularProgress,
  Alert,
  Divider,
  Snackbar,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
} from "@mui/material";
import { ethers } from "ethers";
import { getContractAddress, CONFIG } from "../config/contracts";

function AdminPanel({
  provider,
  account,
  isAdmin,
  contract,
  contractWithSigner,
}) {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [failedFetch, setFailedFetch] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    entryFee: "",
    maxPlayers: "10", // Default value
    startTime: "",
    endTime: "",
    gameType: "Default", // Default value
  });
  const [formErrors, setFormErrors] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState("info");

  // Add a ref to track if component is mounted
  const isMounted = useRef(true);

  // Set isMounted to false when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    console.log("AdminPanel useEffect - provider, account, isAdmin changed");
    console.log("Provider:", provider ? "exists" : "null");
    console.log("Account:", account);
    console.log("Is Admin:", isAdmin);
    console.log("Contract:", contract ? "exists" : "null");
    console.log("ContractWithSigner:", contractWithSigner ? "exists" : "null");

    // Debug more details about the contract
    if (contract) {
      console.log("Contract address:", contract.address);
      console.log("Contract functions:", Object.keys(contract.functions));
    }

    // Only fetch if we have what we need
    if (account && contract) {
      fetchTournaments();
    }
  }, [provider, account, isAdmin, contract]);

  // Show a notification if the user is not an admin
  useEffect(() => {
    if (account && isAdmin === false) {
      showNotification("You don't have admin permissions", "error");
    }
  }, [account, isAdmin]);

  const showNotification = (message, severity = "info") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const fetchTournaments = async () => {
    console.log("fetchTournaments called");
    if (!contract) {
      console.log("Contract not available, skipping fetch");
      return;
    }

    try {
      setLoading(true);
      console.log("Attempting to fetch tournaments");

      // Use the provided contract instance
      const contractInstance = contract;

      // Check if contract has the getAllTournaments function and try that first
      try {
        console.log("Trying getAllTournaments method");
        const allTournaments = await contractInstance.getAllTournaments();
        console.log("Got tournaments:", allTournaments.length);

        const formattedTournaments = allTournaments.map((tournament) => ({
          id: tournament.id.toNumber(),
          name: tournament.name,
          entryFee: ethers.utils.formatEther(tournament.entryFee),
          maxPlayers: tournament.maxPlayers.toString(),
          startTime: new Date(
            tournament.startTime.toNumber() * 1000
          ).toLocaleString(),
          endTime: new Date(
            tournament.endTime.toNumber() * 1000
          ).toLocaleString(),
          status: tournament.status,
          gameType: tournament.gameType,
          playerCount: tournament.currentPlayers.toString(),
          totalPrizePool: ethers.utils.formatEther(tournament.totalPrizePool),
        }));

        if (isMounted.current) {
          setTournaments(formattedTournaments);
          setFailedFetch(false);
        }
        return;
      } catch (err) {
        console.log("getAllTournaments failed, trying manual fetch:", err);
      }

      // Fallback to manual fetching by iterating through tournaments
      console.log("Fetching tournament count");
      const tournamentCount = await contractInstance.tournamentsCount();
      console.log("Tournament count:", tournamentCount.toString());

      const tournamentsList = [];

      for (let i = 1; i <= tournamentCount; i++) {
        try {
          console.log("Fetching tournament", i);
          // Get detailed tournament info
          const tournamentInfo = await contractInstance.getTournamentDetails(i);

          if (
            tournamentInfo &&
            tournamentInfo.id &&
            tournamentInfo.id.toNumber() > 0
          ) {
            tournamentsList.push({
              id: i,
              name: tournamentInfo.name,
              entryFee: ethers.utils.formatEther(tournamentInfo.entryFee),
              maxPlayers: tournamentInfo.maxPlayers.toString(),
              startTime: new Date(
                tournamentInfo.startTime.toNumber() * 1000
              ).toLocaleString(),
              endTime: new Date(
                tournamentInfo.endTime.toNumber() * 1000
              ).toLocaleString(),
              status: tournamentInfo.status,
              gameType: tournamentInfo.gameType,
              playerCount: tournamentInfo.currentPlayers.toString(),
              totalPrizePool: ethers.utils.formatEther(
                tournamentInfo.totalPrizePool
              ),
            });
          }
        } catch (err) {
          console.error(`Error fetching tournament ${i}:`, err);
        }
      }

      console.log("Tournaments fetched:", tournamentsList.length);
      if (isMounted.current) {
        setTournaments(tournamentsList);
        setFailedFetch(false);
      }
    } catch (err) {
      console.error("Error fetching tournaments:", err);
      if (isMounted.current) {
        setError(
          "Failed to fetch tournaments: " + (err.message || "Unknown error")
        );
        setFailedFetch(true);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  const validateForm = () => {
    console.log("Validating form");
    const errors = {};

    if (!formData.name.trim()) {
      errors.name = "Tournament name is required";
    }

    // Check if entry fee is valid based on game type
    if (formData.gameType === "Free to play") {
      // For Free to play, entry fee must be exactly 0
      if (formData.entryFee !== "0") {
        errors.entryFee = "Entry fee must be 0 for Free to play tournaments";
      }
    } else {
      // For other game types, check if it's a valid non-negative number
      if (!formData.entryFee || parseFloat(formData.entryFee) < 0) {
        errors.entryFee = "Valid entry fee is required";
      }
    }

    if (!formData.maxPlayers || parseInt(formData.maxPlayers) <= 1) {
      errors.maxPlayers = "At least 2 players required";
    }

    if (!formData.gameType.trim()) {
      errors.gameType = "Game type is required";
    }

    if (!formData.startTime) {
      errors.startTime = "Start time is required";
    }

    if (!formData.endTime) {
      errors.endTime = "End time is required";
    } else if (new Date(formData.endTime) <= new Date(formData.startTime)) {
      errors.endTime = "End time must be after start time";
    }

    console.log("Form validation errors:", errors);
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Create updated form data
    const updatedFormData = {
      ...formData,
      [name]: value,
    };

    // If gameType is set to "Free to play", automatically set entryFee to "0"
    if (name === "gameType" && value === "Free to play") {
      updatedFormData.entryFee = "0";
    }

    setFormData(updatedFormData);

    // Clear error for this field when user types
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    console.log("Create tournament form submitted");

    // Validate admin status
    if (!isAdmin) {
      showNotification("Only admin can create tournaments", "error");
      return;
    }

    // Clear previous errors
    setError(null);

    // Validate form before submission
    if (!validateForm()) {
      console.log("Form validation failed");
      return;
    }

    try {
      console.log("Starting tournament creation");
      setCreatingTournament(true);

      // Check if we have a contractWithSigner
      if (!contractWithSigner) {
        throw new Error("Contract with signer not available");
      }

      // Format values for the contract
      const name = formData.name;
      // Ensure entry fee is 0 for Free to play tournaments
      const entryFee =
        formData.gameType === "Free to play"
          ? ethers.utils.parseEther("0")
          : ethers.utils.parseEther(formData.entryFee);
      const maxPlayers = parseInt(formData.maxPlayers);
      const startTime = Math.floor(
        new Date(formData.startTime).getTime() / 1000
      );
      const endTime = Math.floor(new Date(formData.endTime).getTime() / 1000);
      const gameType = formData.gameType;

      console.log("Creating tournament with parameters:", {
        name,
        entryFee: entryFee.toString(),
        maxPlayers,
        startTime,
        endTime,
        gameType,
      });

      // Call the contract method
      const tx = await contractWithSigner.createTournament(
        name,
        entryFee,
        maxPlayers,
        startTime,
        endTime,
        gameType
      );

      console.log("Transaction sent:", tx.hash);
      showNotification(
        "Transaction submitted. Please wait for confirmation...",
        "info"
      );

      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log("Transaction confirmed:", receipt);

      // Show success message
      const successMsg = `Tournament "${name}" created successfully!`;
      setSuccessMessage(successMsg);
      showNotification(successMsg, "success");

      // Reset form
      setFormData({
        name: "",
        entryFee: "",
        maxPlayers: "10",
        startTime: "",
        endTime: "",
        gameType: "Default",
      });

      // Refresh tournaments list
      fetchTournaments();
    } catch (error) {
      console.error("Error creating tournament:", error);
      const errorMsg =
        error.data?.message || error.message || "Failed to create tournament";
      setError(errorMsg);
      showNotification(errorMsg, "error");
    } finally {
      setCreatingTournament(false);
    }
  };

  const handleFinalizeTournament = async (tournamentId) => {
    // Validate admin status
    if (!isAdmin) {
      showNotification("Only admin can finalize tournaments", "error");
      return;
    }

    if (!contractWithSigner) {
      showNotification("Contract not ready", "error");
      return;
    }

    try {
      console.log("Finalizing tournament:", tournamentId);

      const tx = await contractWithSigner.finalizeTournament(tournamentId);
      showNotification("Finalization transaction submitted", "info");

      await tx.wait();
      showNotification("Tournament finalized successfully!", "success");

      // Refresh tournaments
      fetchTournaments();
    } catch (error) {
      console.error("Error finalizing tournament:", error);
      const errorMsg =
        error.data?.message || error.message || "Failed to finalize tournament";
      showNotification(errorMsg, "error");
    }
  };

  const handleCancelTournament = async (tournamentId) => {
    // Validate admin status
    if (!isAdmin) {
      showNotification("Only admin can cancel tournaments", "error");
      return;
    }

    if (!contractWithSigner) {
      showNotification("Contract not ready", "error");
      return;
    }

    try {
      console.log("Cancelling tournament:", tournamentId);

      const tx = await contractWithSigner.cancelTournament(tournamentId);
      showNotification("Cancellation transaction submitted", "info");

      await tx.wait();
      showNotification("Tournament cancelled successfully!", "success");

      // Refresh tournaments
      fetchTournaments();
    } catch (error) {
      console.error("Error cancelling tournament:", error);
      const errorMsg =
        error.data?.message || error.message || "Failed to cancel tournament";
      showNotification(errorMsg, "error");
    }
  };

  const handleRetryFetch = () => {
    setFailedFetch(false);
    fetchTournaments();
  };

  // Clear success message after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  if (!account) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="warning">
          Please connect your wallet to access the admin panel.
        </Alert>
      </Container>
    );
  }

  if (!isAdmin) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Access denied. Only the admin can access this panel.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Success message */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage("")}
        message={successMessage}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      />

      <Typography variant="h4" component="h1" gutterBottom>
        Admin Panel
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Create New Tournament
        </Typography>
        <form onSubmit={handleCreateTournament}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Tournament Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                error={!!formErrors.name}
                helperText={formErrors.name}
                disabled={creatingTournament}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Entry Fee (ETH)"
                name="entryFee"
                type="number"
                value={formData.entryFee}
                onChange={handleInputChange}
                required
                inputProps={{ step: "0.01", min: "0" }}
                error={!!formErrors.entryFee}
                helperText={
                  formErrors.entryFee ||
                  (formData.gameType === "Free to play"
                    ? "Entry Fee set to 0 for Free to play"
                    : "")
                }
                disabled={
                  creatingTournament || formData.gameType === "Free to play"
                }
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Max Players"
                name="maxPlayers"
                type="number"
                value={formData.maxPlayers}
                onChange={handleInputChange}
                required
                inputProps={{ min: "2" }}
                error={!!formErrors.maxPlayers}
                helperText={formErrors.maxPlayers}
                disabled={creatingTournament}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl
                fullWidth
                error={!!formErrors.gameType}
                disabled={creatingTournament}
              >
                <InputLabel id="game-type-label">Game Type</InputLabel>
                <Select
                  labelId="game-type-label"
                  id="game-type"
                  name="gameType"
                  value={formData.gameType}
                  onChange={handleInputChange}
                  label="Game Type"
                  required
                >
                  <MenuItem value="Default">Default</MenuItem>
                  <MenuItem value="Free to play">Free to play</MenuItem>
                  <MenuItem value="P2W">P2W</MenuItem>
                </Select>
                {formErrors.gameType ? (
                  <FormHelperText error>{formErrors.gameType}</FormHelperText>
                ) : (
                  <FormHelperText>
                    Default: Standard tournament with entry fee
                    <br />
                    Free to play: No entry fee required
                    <br />
                    P2W: Pay to win format
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Start Time"
                name="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={handleInputChange}
                required
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.startTime}
                helperText={formErrors.startTime}
                disabled={creatingTournament}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Time"
                name="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={handleInputChange}
                required
                InputLabelProps={{ shrink: true }}
                error={!!formErrors.endTime}
                helperText={formErrors.endTime}
                disabled={creatingTournament}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                disabled={creatingTournament}
                sx={{ mt: 2 }}
              >
                {creatingTournament ? (
                  <CircularProgress size={24} />
                ) : (
                  "Create Tournament"
                )}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="h5">Existing Tournaments</Typography>

        {failedFetch && (
          <Button
            variant="outlined"
            color="primary"
            onClick={handleRetryFetch}
            disabled={loading}
          >
            Retry Loading
          </Button>
        )}
      </Box>

      {loading && !creatingTournament ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : failedFetch ? (
        <Alert severity="error" sx={{ my: 2 }}>
          Failed to load tournaments. Please click "Retry Loading" to try again.
        </Alert>
      ) : tournaments.length === 0 ? (
        <Alert severity="info" sx={{ my: 2 }}>
          No tournaments found. Create your first tournament above.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {tournaments.map((tournament) => (
            <Grid item xs={12} sm={6} md={4} key={tournament.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {tournament.name}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    Entry Fee: {tournament.entryFee} ETH
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Max Players: {tournament.maxPlayers}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Game Type: {tournament.gameType}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Start: {tournament.startTime}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    End: {tournament.endTime}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={
                      tournament.status === 0
                        ? "primary"
                        : tournament.status === 1
                        ? "success.main"
                        : "error.main"
                    }
                  >
                    Status:{" "}
                    {tournament.status === 0
                      ? "Not Started"
                      : tournament.status === 1
                      ? "In Progress"
                      : "Completed"}
                  </Typography>
                </CardContent>
                <CardActions>
                  {tournament.status === 1 && (
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleFinalizeTournament(tournament.id)}
                      disabled={loading}
                    >
                      Finalize Tournament
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default AdminPanel;
