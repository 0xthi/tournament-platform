# Decentralized Tournament Platform

A blockchain-based tournament platform where users can join competitions, compete, and win rewards distributed automatically through smart contracts. The platform features tournament creation with custom parameters, player registration via wallet connection, secure score submission, and automated reward distribution based on player rankings.

## Project Overview

This platform allows:

- Tournament organizers to create and manage competitions
- Players to register, join tournaments, and compete for prizes
- Secure reward distribution based on final rankings (50% to 1st, 30% to 2nd, 20% to 3rd)
- Full transparency with all tournament data stored on-chain

## Architecture

- **Smart Contract**: Core tournament logic and fund management
- **Frontend**: Direct interaction with contract for reading tournament data
- **Backend**: Handles automated tournament management tasks (starting tournaments, simulating gameplay, finalizing tournaments)

## Features

- **User Registration**: Connect wallet and register as a player
- **Tournament Creation**: Admin can create tournaments with customizable parameters
- **Tournament Joining**: Players can join tournaments by paying an entry fee
- **Score Submission**: Admin submits scores through a secure backend
- **Reward Distribution**: Winners receive rewards automatically based on their ranking

## Tech Stack

- **Smart Contracts**: Solidity (Ethereum)
- **Development Framework**: Hardhat
- **Backend**: Node.js, Express
- **Frontend**: React, ethers.js
- **Testing**: Chai, Mocha

## Project Structure

```
tournament-platform/
├── contracts/             # Solidity smart contracts
├── frontend/              # React frontend
├── backend/               # Node.js/Express backend
├── test/                  # Contract tests
└── scripts/               # Deployment scripts
```

## Quick Start

### Environment Setup

```bash
# Copy environment files
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Install & Build

```bash
# Install all dependencies
npm run install:all

# Compile contracts
npm run compile
```

### Test

```bash
# Run all tests
npm test

# Gas usage tests only
npm run test:gas
```

### Deployment

```bash
# Local development
npm run node
npm run deploy:local

# Sepolia testnet
npm run deploy:sepolia
npm run verify:sepolia YOUR_CONTRACT_ADDRESS
```

### Run Application

```bash
# Start backend
npm run dev:backend

# Start frontend (in new terminal)
npm start
```

Visit `http://localhost:3000` to access the application.

## Using the Platform

### Admin Features

- Create tournaments with custom parameters
- Submit scores for players
- Start and finalize tournaments
- Distribute rewards automatically

### Player Features

- Register with wallet connection
- Browse and join tournaments
- View tournament results and leaderboards

### Wallet Setup

- Connect MetaMask to appropriate network:
  - Local: `http://localhost:8545` (Chain ID: `31337`)
  - Sepolia: Select Sepolia testnet in MetaMask
- Ensure you have ETH for gas fees and tournament entry
