import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Tournaments from "./pages/Tournaments";
import TournamentDetails from "./pages/TournamentDetails";
import AdminPanel from "./pages/AdminPanel";
import { ethers } from "ethers";
import TournamentPlatform from "./contracts/contracts/TournamentPlatform.sol/TournamentPlatform.json";
// Import contract addresses from config
import { CONFIG, getContractAddress } from "./config/contracts.js";

const theme = createTheme({
  palette: {
    primary: {
      main: "#1976d2",
    },
    secondary: {
      main: "#dc004e",
    },
  },
});

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractWithSigner, setContractWithSigner] = useState(null);
  const [provider, setProvider] = useState(null);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);
  const prevAccount = useRef(null);
  const isInitializing = useRef(false);

  const connectWallet = async (newAccount = null) => {
    try {
      if (newAccount === null) {
        // Disconnect
        setAccount(null);
        setContract(null);
        setContractWithSigner(null);
        setProvider(null);
        setIsAdmin(false);
        setManuallyDisconnected(true);
        console.log("Wallet disconnected");
        return;
      }

      // Always clear the manually disconnected flag when connecting
      setManuallyDisconnected(false);

      if (!window.ethereum) {
        const errorMsg = "Please install MetaMask to use this application";
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      console.log("Connecting wallet...");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);

      // Get the network to determine which contract address to use
      const network = await provider.getNetwork();
      console.log("Connected to network:", network);

      // Get the contract address from config based on the chainId
      const contractAddress = getContractAddress(
        network.chainId.toString(),
        "TournamentPlatform"
      );

      if (!contractAddress) {
        const errorMsg = `No contract address configured for this network (Chain ID: ${network.chainId})`;
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      console.log("Using contract address from config:", contractAddress);

      let currentAccount = newAccount;
      if (!currentAccount) {
        try {
          // Direct request for accounts - simpler and works better
          const accounts = await window.ethereum.request({
            method: "eth_requestAccounts",
          });

          if (!accounts || accounts.length === 0) {
            const errorMsg = "No accounts returned from MetaMask";
            console.error(errorMsg);
            setError(errorMsg);
            return;
          }

          currentAccount = accounts[0];
          console.log("Connected account:", currentAccount);
        } catch (error) {
          const errorMsg = "User rejected the connection request";
          console.error(errorMsg, error);
          setError(errorMsg);
          return; // Exit early if user rejects
        }
      }

      // Validate the account format
      if (
        !currentAccount ||
        typeof currentAccount !== "string" ||
        !currentAccount.startsWith("0x")
      ) {
        const errorMsg = `Invalid account format: ${currentAccount}`;
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      setAccount(currentAccount);
      console.log("Account set:", currentAccount);

      // Get a read-only contract
      const tournamentContract = new ethers.Contract(
        contractAddress,
        TournamentPlatform.abi,
        provider
      );
      setContract(tournamentContract);
      console.log("Read-only contract initialized");

      // Get a contract with signer for writing transactions
      const signer = provider.getSigner();
      const contractWithSigner = new ethers.Contract(
        contractAddress,
        TournamentPlatform.abi,
        signer
      );
      setContractWithSigner(contractWithSigner);
      console.log("Contract with signer initialized");

      // Check if user is admin
      try {
        const owner = await tournamentContract.owner();
        const isCurrentUserAdmin =
          owner.toLowerCase() === currentAccount.toLowerCase();
        console.log("Admin check:", {
          owner,
          currentAccount,
          isAdmin: isCurrentUserAdmin,
        });
        setIsAdmin(isCurrentUserAdmin);
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      }

      setError(null);
      console.log("Wallet connected successfully");
    } catch (err) {
      const errorMsg =
        "Failed to connect wallet: " + (err.message || "Unknown error");
      console.error(errorMsg, err);
      setError(errorMsg);
    }
  };

  // Handle account changes from MetaMask
  const handleAccountsChanged = (accounts) => {
    // If user has manually disconnected, don't auto-connect
    if (manuallyDisconnected) return;

    if (accounts.length === 0) {
      // User disconnected from MetaMask UI
      connectWallet(null);
    } else if (!account || accounts[0] !== account) {
      // Account changed or new account connected
      connectWallet(accounts[0]);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      // Prevent multiple initializations
      if (isInitializing.current) return;
      isInitializing.current = true;

      if (!window.ethereum) {
        isInitializing.current = false;
        return;
      }

      try {
        // Setup event listeners
        window.ethereum.on("accountsChanged", handleAccountsChanged);
        window.ethereum.on("chainChanged", () => {
          window.location.reload();
        });

        // Only auto-connect if not manually disconnected before
        if (!manuallyDisconnected) {
          // Check for already connected accounts
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const accounts = await provider.listAccounts();

          if (accounts.length > 0) {
            connectWallet(accounts[0]);
          }
        }
      } catch (err) {
        console.error("Error initializing:", err);
      } finally {
        isInitializing.current = false;
      }
    };

    initialize();

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener(
          "accountsChanged",
          handleAccountsChanged
        );
        window.ethereum.removeListener("chainChanged", () => {});
      }
    };
  }, [account, manuallyDisconnected]); // Add manuallyDisconnected as dependency

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="app">
          <Navbar
            account={account}
            connectWallet={connectWallet}
            isAdmin={isAdmin}
            contract={contract}
          />
          <main className="container">
            <Routes>
              <Route
                path="/"
                element={
                  <Home
                    contract={contract}
                    account={account}
                    connectWallet={connectWallet}
                  />
                }
              />
              <Route
                path="/tournaments"
                element={<Tournaments contract={contract} account={account} />}
              />
              <Route
                path="/tournaments/:id"
                element={
                  <TournamentDetails contract={contract} account={account} />
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminPanel
                    provider={provider}
                    account={account}
                    isAdmin={isAdmin}
                    contract={contract}
                    contractWithSigner={contractWithSigner}
                  />
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
