# Codeforces Profile Glazer

A fun web application that takes your Codeforces username and uses AI to generate complimentary descriptions of your coding profile!

## Features

- Input your Codeforces username
- Fetches your profile data from the Codeforces API
- Uses OpenAI to generate an enthusiastic, complimentary description of your coding skills
- Beautiful, modern UI
- Ready for Vercel deployment

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory and add your OpenAI API key:
   ```bash
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env.local
   ```
   
   Or manually create `.env.local` with the content:
   ```
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ```
   
   **Important:** 
   - Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - Make sure you have billing enabled on your OpenAI account
   - Never commit your `.env.local` file to version control!

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

This project is ready to deploy on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your `OPENAI_API_KEY` environment variable in Vercel's dashboard
4. Deploy!

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required) 