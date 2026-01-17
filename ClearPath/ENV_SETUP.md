# Environment Setup for ClearPath Web

## Overview

ClearPath uses environment variables for API configuration. For Expo web, variables must be prefixed with `EXPO_PUBLIC_`.

## Setup Steps

### 1. Create a `.env` file in the ClearPath folder:

```bash
cd ClearPath
touch .env
```

### 2. Add your Overshoot API credentials:

```env
EXPO_PUBLIC_OVERSHOOT_API_KEY=your_api_key_here
EXPO_PUBLIC_OVERSHOOT_API_URL=https://cluster1.overshoot.ai/api/v0.2
```

### 3. Get your API key from Overshoot:

1. Go to [Overshoot Platform](https://overshoot.ai)
2. Sign up / Log in
3. Create a new API key
4. Copy the key to your `.env` file

## Running the App

### Development (with HTTPS tunnel for iPhone testing):

```bash
npm run tunnel
```

This starts the web server with an HTTPS tunnel. Open the tunnel URL on your iPhone.

### Local development only:

```bash
npm start
```

## Notes

- Environment variables with `EXPO_PUBLIC_` prefix are accessible in the browser
- Never commit your `.env` file to git (it's in `.gitignore`)
- The API URL defaults to `https://cluster1.overshoot.ai/api/v0.2` if not set
