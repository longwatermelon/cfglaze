# Codeforces Profile Glazer 🏆

A fun web application that takes your Codeforces username and generates enthusiastic, AI-powered praise of your competitive programming skills! Perfect for motivation and sharing your achievements.

## Features ✨

- Fetches comprehensive Codeforces profile data
- AI-powered enthusiastic praise generation
- Beautiful modern UI with dark theme
- Rate limiting protection
- Real-time submission analysis
- Responsive design for all devices

## Tech Stack 🛠️

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: OpenAI GPT-4o-mini
- **APIs**: Codeforces API
- **Deployment**: Vercel

## Setup Instructions 🚀

### 1. Prerequisites

- Node.js 18.18.0+ (but <19.0.0)
- npm or yarn
- OpenAI API key

### 2. Clone and Install

```bash
git clone <repository-url>
cd codeforces-glazer
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```bash
# OpenAI Configuration (required)
OPENAI_API_KEY=your-openai-api-key

# Optional: Vercel KV for rate limiting (recommended for production)
KV_URL=your-vercel-kv-url
KV_REST_API_URL=your-vercel-kv-rest-url
KV_REST_API_TOKEN=your-vercel-kv-token
KV_REST_API_READ_ONLY_TOKEN=your-vercel-kv-readonly-token
```

**OpenAI API Key:**
- Sign up at [OpenAI](https://platform.openai.com/)
- Create an API key in your dashboard
- Add billing information (GPT-4o-mini is very cost-effective)

**Important:** The `NEXT_PUBLIC_` prefix makes the hCaptcha site key available to the frontend

### 4. Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 5. Production Deployment

Deploy to Vercel (recommended):

```bash
npm install -g vercel
vercel
```

Set environment variables in Vercel dashboard:
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`: Your hCaptcha site key for frontend (required)
- `HCAPTCHA_SECRET_KEY`: Your hCaptcha secret key for backend verification (required)
- Vercel KV variables (if using)

**Required Environment Variables:**
- `OPENAI_API_KEY`: Your OpenAI API key for AI generation (required)
- Vercel KV variables for rate limiting (optional but recommended)

## Usage 💡

1. Enter your Codeforces username
2. Wait for the AI to fetch your profile and generate amazing praise
3. Share your personalized glaze with friends!

## API Endpoints 🔌

### POST `/api/glaze-profile`

Generate AI praise for a Codeforces profile.

**Request Body:**
```json
{
  "username": "your_codeforces_handle",
  "honeypot": ""
}
```

**Response:**
```json
{
  "glaze": "AI-generated praise text...",
  "userData": {
    "handle": "username",
    "rating": 1500,
    "maxRating": 1600,
    "rank": "specialist",
    "maxRank": "expert"
  },
  "tokensUsed": 2500
}
```

## Security & Rate Limiting

The application implements multiple layers of protection:

- **IP-based Rate Limiting**: 4 requests per day per IP address
- **Request Validation**: Origin and user-agent checks to block obvious bots
- **Input Sanitization**: Username validation and honeypot fields
- **Size Limits**: Request size capping to prevent memory exhaustion
- **OpenAI Token Limits**: 2M tokens daily limit for cost control

## Cost Considerations 💰

- Uses GPT-4o-mini (~$0.15 per 1M input tokens)
- Average request uses 2000-4000 tokens
- Daily limit of 2M tokens ≈ $0.30-0.60/day maximum
- Actual costs much lower due to rate limiting

## Development Notes 📝

### File Structure
```
app/
├── page.tsx           # Main frontend interface
├── layout.tsx         # Root layout
├── globals.css        # Global styles
└── api/
    └── glaze-profile/
        └── route.ts   # Main API handler
```

### Key Dependencies
- `next`: 14.0.4
- `openai`: ^4.20.1
- `axios`: ^1.6.2
- `@vercel/kv`: ^0.2.4

For development/testing, hCaptcha provides test keys:
- Site key: `10000000-ffff-ffff-ffff-000000000001`
- Secret key: `0x0000000000000000000000000000000000000000`

## Contributing 🤝

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License 📄

This project is open source and available under the MIT License.