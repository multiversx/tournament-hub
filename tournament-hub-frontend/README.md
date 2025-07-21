# Tournament Hub Frontend

This is the frontend application for the Tournament Hub dApp, built with React, TypeScript, and Vite.

## Features

- **Wallet Integration**: Connect with MultiversX Web Wallet and xPortal (WalletConnect)
- **Tournament Management**: View, join, and create tournaments
- **Real-time Updates**: Live tournament status and participant information
- **Responsive Design**: Modern UI built with Tailwind CSS

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

## Wallet Integration

The app supports two wallet connection methods:

### Web Wallet
- Uses the official MultiversX Web Wallet
- No additional configuration required

### xPortal (WalletConnect)
- Requires a WalletConnect project ID
- To enable xPortal integration:
  1. Get a project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)
  2. Update the `projectId` in `src/contexts/WalletContext.tsx` (line 47)

## Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8000
VITE_WALLET_CONNECT_PROJECT_ID=your_project_id_here
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/     # Reusable UI components
├── contexts/       # React contexts (Wallet, Tournament, etc.)
├── pages/         # Page components
├── services/      # API and blockchain services
├── utils/         # Utility functions
└── config/        # Configuration files
``` 