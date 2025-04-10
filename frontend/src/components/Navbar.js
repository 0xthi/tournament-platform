import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Menu,
  MenuItem,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
import {
  AccountCircle,
  ArrowDropDown,
  SportsEsports,
  AdminPanelSettings,
  Logout,
  Person,
} from "@mui/icons-material";
import { ethers } from "ethers";
import { formatAddress } from "../utils/formatAddress";

function Navbar({ account, connectWallet, isAdmin, contract }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [avatar, setAvatar] = useState("");
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    if (account && contract) {
      getPlayerDetails();
    } else {
      setPlayerId(null);
    }

    if (account) {
      const randomAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${account}`;
      setAvatar(randomAvatar);
    }
  }, [account, contract]);

  const getPlayerDetails = async () => {
    try {
      const details = await contract.getPlayerDetails(account);
      if (details && details.id) {
        setPlayerId(details.id.toString());
      }
    } catch (error) {
      console.error("Error fetching player details:", error);
    }
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleDisconnect = () => {
    window.ethereum.removeAllListeners();
    connectWallet(null);
    handleClose();
  };

  // Direct method to connect wallet
  const handleConnectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask to use this application");
        return;
      }

      // Show loading state
      const button = document.querySelector(
        'button[startIcon="AccountCircle"]'
      );
      if (button) {
        button.disabled = true;
        button.textContent = "Connecting...";
      }

      // Direct call to MetaMask
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      // Explicitly call the parent connectWallet to reset the manuallyDisconnected flag
      if (accounts && accounts.length > 0) {
        connectWallet(accounts[0]);
      } else {
        console.error("No accounts returned from MetaMask");
        alert("Failed to connect wallet: No accounts available");
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      alert(`Failed to connect wallet: ${error.message || "Unknown error"}`);
    } finally {
      // Reset button state
      const button = document.querySelector(
        'button[startIcon="AccountCircle"]'
      );
      if (button) {
        button.disabled = false;
        button.textContent = "Connect Wallet";
      }
    }
  };

  return (
    <AppBar position="static" color="primary" elevation={1}>
      <Toolbar>
        <Typography
          variant="h6"
          component={Link}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: "none",
            color: "white",
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <SportsEsports />
          Tournament Platform
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            component={Link}
            to="/tournaments"
            color="inherit"
            startIcon={<SportsEsports />}
          >
            Tournaments
          </Button>

          {isAdmin && (
            <Button
              component={Link}
              to="/admin"
              color="inherit"
              startIcon={<AdminPanelSettings />}
            >
              Admin Panel
            </Button>
          )}

          {account ? (
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Tooltip title="Account Menu">
                <IconButton
                  onClick={handleMenu}
                  color="inherit"
                  sx={{ display: "flex", alignItems: "center", gap: 1 }}
                  aria-label="account menu"
                >
                  <Avatar
                    src={avatar}
                    alt="Avatar"
                    sx={{ width: 32, height: 32 }}
                  />
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    {formatAddress(account)}
                  </Typography>
                  <ArrowDropDown />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
              >
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    {account}
                  </Typography>
                </MenuItem>
                <MenuItem disabled>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Person sx={{ mr: 1, fontSize: 20 }} />
                    <Typography variant="body2" color="text.secondary">
                      Player ID: {playerId || "Not registered"}
                    </Typography>
                  </Box>
                </MenuItem>
                <Divider />
                <MenuItem disabled>
                  <Typography variant="body2" color="text.secondary">
                    Role: {isAdmin ? "Admin" : "Player"}
                  </Typography>
                </MenuItem>
                <MenuItem
                  onClick={handleDisconnect}
                  sx={{ color: "error.main" }}
                >
                  <Logout sx={{ mr: 1 }} />
                  Disconnect
                </MenuItem>
              </Menu>
            </Box>
          ) : (
            <Button
              color="inherit"
              variant="outlined"
              onClick={handleConnectWallet}
              startIcon={<AccountCircle />}
              aria-label="connect wallet"
              data-testid="connect-wallet-button"
            >
              Connect Wallet
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar;
