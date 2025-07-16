# Tournament Hub Frontend

A modern React frontend for the MultiversX Tournament Hub, providing a user-friendly interface for tournament management, player registration, and result submission.

## Features

- **Wallet Integration**: Connect with MultiversX web wallet
- **Tournament Management**: View, join, and create tournaments
- **Real-time Updates**: Live tournament status and player information
- **Admin Panel**: Create tournaments and manage results
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **MultiversX SDK** for blockchain interaction
- **React Router** for navigation
- **Axios** for API communication
- **Lucide React** for icons

## Prerequisites

- Node.js 16+ and npm
- MultiversX web wallet (https://web-wallet.multiversx.com)
- Tournament Hub backend server running (default: http://localhost:8000)

## Installation

1. **Clone the repository** (if not already done):
   ```bash
   cd tournament-hub-frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:3000`

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=http://localhost:8000
```

### API Proxy

The development server is configured to proxy API requests to your backend server. If your backend runs on a different port, update the `vite.config.ts` file.

## Usage

### Connecting Wallet

1. Click "Connect Wallet" in the navigation bar
2. You'll be redirected to the MultiversX web wallet
3. Sign in to your wallet and approve the connection
4. You'll be redirected back to the app with your wallet connected
5. Your wallet address will be displayed in the navbar

### Joining Tournaments

1. Navigate to the "Tournaments" page
2. Browse available tournaments
3. Click "Join" on a tournament you want to participate in
4. Confirm the transaction in your web wallet

### Creating Tournaments (Admin)

1. Navigate to the "Admin" page
2. Click "Create Tournament"
3. Fill in the tournament details:
   - Game ID
   - Entry Fee
   - Join Deadline
4. Submit the form

### Submitting Results

1. Navigate to a tournament's details page
2. Click "Submit Results" (only available for active tournaments)
3. Enter the podium addresses (1st, 2nd, 3rd place)
4. Submit the results

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Navbar.tsx      # Navigation bar with wallet connection
├── contexts/           # React contexts for state management
│   ├── WalletContext.tsx    # Wallet connection state
│   └── TournamentContext.tsx # Tournament data and API calls
├── pages/              # Page components
│   ├── Home.tsx        # Landing page
│   ├── Tournaments.tsx # Tournament listing
│   ├── TournamentDetails.tsx # Individual tournament view
│   └── Admin.tsx       # Admin panel
├── services/           # API and external services
│   └── api.ts         # Axios configuration and API calls
├── utils/              # Utility functions
│   └── wallet.ts      # Wallet-related utilities
├── App.tsx            # Main app component with routing
├── main.tsx           # React entry point
└── index.css          # Global styles and Tailwind imports
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Adding New Features

1. **New Pages**: Add routes in `App.tsx` and create page components in `src/pages/`
2. **New Components**: Create reusable components in `src/components/`
3. **API Integration**: Add new API calls in `src/services/api.ts`
4. **State Management**: Extend contexts in `src/contexts/` as needed

## Deployment

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

### Environment Setup

For production deployment, set the `VITE_API_URL` environment variable to point to your production backend server.

## Troubleshooting

### Common Issues

1. **Wallet Connection Fails**
   - Ensure you're using the MultiversX web wallet (https://web-wallet.multiversx.com)
   - Check if you're signed in to the web wallet
   - Try refreshing the page and reconnecting

2. **API Calls Fail**
   - Verify the backend server is running
   - Check the `VITE_API_URL` environment variable
   - Ensure CORS is properly configured on the backend

3. **Build Errors**
   - Clear `node_modules` and reinstall dependencies
   - Check TypeScript errors in the console
   - Verify all imports are correct

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 