import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Container,
  Divider,
  Grid,
  Paper,
  Typography,
  Chip,
  Avatar,
  CircularProgress,
  Stack,
  Alert,
} from "@mui/material";
import {
  SportsEsports,
  EmojiEvents,
  AccessTime,
  Group,
  PersonAdd,
  TrendingUp,
  Money,
  Security,
} from "@mui/icons-material";

function Home({ account, contract, connectWallet }) {
  const navigate = useNavigate();
  const [playerDetails, setPlayerDetails] = useState(null);
  const [stats, setStats] = useState({
    joined: 0,
    won: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    const fetchPlayerDetails = async () => {
      if (account && contract) {
        try {
          setStats((prev) => ({ ...prev, loading: true }));

          // Get player details
          const details = await contract.getPlayerDetails(account);
          setPlayerDetails({
            id: details.id.toNumber(),
            exists: details.exists,
          });

          // Get all tournaments to count participation and wins
          const allTournaments = await contract.getAllTournaments();

          let joinedCount = 0;
          let wonCount = 0;

          // Process each tournament
          for (const tournament of allTournaments) {
            // Check if player joined this tournament
            const players = tournament.players;
            const isParticipant = players.some(
              (p) => p.toLowerCase() === account.toLowerCase()
            );

            if (isParticipant) {
              joinedCount++;

              // If tournament is completed, check if player won
              if (tournament.status === 2) {
                // Completed status
                const winners = await contract.getTournamentWinners(
                  tournament.id
                );
                if (
                  winners.some((w) => w.toLowerCase() === account.toLowerCase())
                ) {
                  wonCount++;
                }
              }
            }
          }

          setStats({
            joined: joinedCount,
            won: wonCount,
            loading: false,
            error: null,
          });
        } catch (error) {
          console.error("Error fetching player details:", error);
          setStats((prev) => ({
            ...prev,
            loading: false,
            error: "Failed to load player statistics",
          }));
        }
      }
    };

    fetchPlayerDetails();
  }, [account, contract]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Hero Section */}
      <Paper
        elevation={3}
        sx={{
          p: 4,
          mb: 4,
          borderRadius: 2,
          background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)",
          color: "white",
          textAlign: "center",
        }}
      >
        <Typography variant="h2" component="h1" fontWeight="bold" gutterBottom>
          Decentralized Tournament Platform
        </Typography>
        <Typography variant="h6" paragraph>
          Join tournaments, compete with other players, and win rewards through
          transparent blockchain technology.
        </Typography>

        {!account ? (
          <Button
            variant="contained"
            size="large"
            onClick={connectWallet}
            sx={{
              mt: 2,
              bgcolor: "white",
              color: "#1976d2",
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
            startIcon={<SportsEsports />}
          >
            Connect Wallet to Start
          </Button>
        ) : (
          <Button
            component={Link}
            to="/tournaments"
            variant="contained"
            size="large"
            sx={{
              mt: 2,
              bgcolor: "white",
              color: "#1976d2",
              "&:hover": {
                bgcolor: "#f5f5f5",
              },
            }}
            startIcon={<SportsEsports />}
          >
            View Tournaments
          </Button>
        )}
      </Paper>

      {/* Player Dashboard (only show if connected) */}
      {account && (
        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Typography
            variant="h5"
            component="h2"
            gutterBottom
            sx={{ display: "flex", alignItems: "center" }}
          >
            <Avatar sx={{ bgcolor: "#1976d2", mr: 1 }}>
              {playerDetails?.exists ? "P" : "?"}
            </Avatar>
            Player Dashboard
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Player ID
                  </Typography>
                  {stats.loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 2 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : playerDetails?.exists ? (
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <PersonAdd color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h4" component="div">
                        #{playerDetails.id}
                      </Typography>
                    </Box>
                  ) : (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      Join a tournament to get a player ID
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Tournaments Joined
                  </Typography>
                  {stats.loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 2 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <Group color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h4" component="div">
                        {stats.joined}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Tournaments Won
                  </Typography>
                  {stats.loading ? (
                    <Box
                      sx={{ display: "flex", justifyContent: "center", p: 2 }}
                    >
                      <CircularProgress size={24} />
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <EmojiEvents color="primary" sx={{ mr: 1 }} />
                      <Typography variant="h4" component="div">
                        {stats.won}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {stats.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {stats.error}
            </Alert>
          )}

          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              component={Link}
              to="/tournaments"
              startIcon={<SportsEsports />}
            >
              Browse Tournaments
            </Button>
          </Box>
        </Paper>
      )}

      {/* Features Section */}
      <Typography
        variant="h4"
        component="h2"
        gutterBottom
        sx={{ mt: 6, mb: 3, textAlign: "center" }}
      >
        Platform Features
      </Typography>

      <Grid container spacing={3} justifyContent="center">
        <Grid item xs={12} sm={6} md={4}>
          <Card
            sx={{
              height: "100%",
              transition: "0.3s",
              "&:hover": { transform: "translateY(-5px)" },
              textAlign: "center",
            }}
          >
            <CardContent sx={{ textAlign: "center", p: 3 }}>
              <Money sx={{ fontSize: 60, color: "#1976d2", mb: 2 }} />
              <Typography variant="h5" component="h3" gutterBottom>
                Transparent Rewards
              </Typography>
              <Typography variant="body1" color="text.secondary">
                All rewards are distributed automatically via smart contracts
                with no middlemen.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card
            sx={{
              height: "100%",
              transition: "0.3s",
              "&:hover": { transform: "translateY(-5px)" },
              textAlign: "center",
            }}
          >
            <CardContent sx={{ textAlign: "center", p: 3 }}>
              <Security sx={{ fontSize: 60, color: "#1976d2", mb: 2 }} />
              <Typography variant="h5" component="h3" gutterBottom>
                Fair Competition
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Score submissions are verified and secured on-chain to ensure
                fairness.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card
            sx={{
              height: "100%",
              transition: "0.3s",
              "&:hover": { transform: "translateY(-5px)" },
              textAlign: "center",
            }}
          >
            <CardContent sx={{ textAlign: "center", p: 3 }}>
              <TrendingUp sx={{ fontSize: 60, color: "#1976d2", mb: 2 }} />
              <Typography variant="h5" component="h3" gutterBottom>
                Decentralized
              </Typography>
              <Typography variant="body1" color="text.secondary">
                No central authority controls the tournaments or funds,
                everything is on the blockchain.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* How It Works Section */}
      <Typography
        variant="h4"
        component="h2"
        gutterBottom
        sx={{ mt: 6, mb: 3, textAlign: "center" }}
      >
        How It Works
      </Typography>

      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: "#1976d2",
                  mx: "auto",
                  mb: 2,
                }}
              >
                1
              </Avatar>
              <Typography variant="h5" component="h3" gutterBottom>
                Connect Your Wallet
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Link your Ethereum wallet to register as a player and access the
                platform.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: "#1976d2",
                  mx: "auto",
                  mb: 2,
                }}
              >
                2
              </Avatar>
              <Typography variant="h5" component="h3" gutterBottom>
                Join Tournaments
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Browse available tournaments and join by paying the entry fee
                with your wallet.
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4}>
            <Box sx={{ p: 2, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 60,
                  height: 60,
                  bgcolor: "#1976d2",
                  mx: "auto",
                  mb: 2,
                }}
              >
                3
              </Avatar>
              <Typography variant="h5" component="h3" gutterBottom>
                Compete & Earn
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Play the game, submit your score, and win rewards based on your
                final ranking.
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          {!account ? (
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={connectWallet}
              startIcon={<SportsEsports />}
            >
              Get Started Now
            </Button>
          ) : (
            <Button
              component={Link}
              to="/tournaments"
              variant="contained"
              color="primary"
              size="large"
              startIcon={<SportsEsports />}
            >
              See Active Tournaments
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

export default Home;
