# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Codeforces Glazer is a Next.js 14 web application that generates enthusiastic AI-powered praise for Codeforces profiles and code submissions. It uses OpenAI's GPT-4o-mini to create over-the-top motivational content for competitive programmers.

## Development Commands

### Core Commands
- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build production application
- `npm run start` - Start production server
- `npm run lint` - Run Next.js ESLint linting

### Prerequisites
- Node.js 18+ (specified in package.json engines)
- `OPENAI_API_KEY` environment variable required for AI features

## Architecture

### Frontend (Next.js App Router)
- **Main UI**: `app/page.tsx` - Single-page app with tabbed interface for profile/code glazing
- **Layout**: `app/layout.tsx` - Root layout with metadata and global styling
- **Styling**: `app/globals.css` + Tailwind CSS for responsive design

### Backend (API Routes)
- **Profile API**: `app/api/glaze-profile/route.ts` - Fetches Codeforces data and generates profile praise
- **Code API**: `app/api/glaze-code/route.ts` - Analyzes uploaded code and generates code praise
- **Token API**: `app/api/tokens/route.ts` - Manages global OpenAI token usage tracking

### Key Features
- **Rate Limiting**: 50 requests per IP per day using Vercel KV storage
- **Global Token Tracking**: Daily 2M token limit with read-modify-write consistency
- **Security**: Origin validation, user-agent filtering, honeypot fields
- **File Uploads**: Code files up to 500KB with multiple language support

### External Dependencies
- **Codeforces API**: Fetches user profiles and submission history
- **OpenAI API**: GPT-4o-mini for generating enthusiastic content
- **Vercel KV**: Rate limiting and token tracking storage

### Data Flow
1. User submits username/code → Frontend validation
2. API validates request origin/rate limits → Codeforces/OpenAI API calls
3. Token usage tracked → Response with AI-generated praise

## Environment Configuration

Required environment variables:
- `OPENAI_API_KEY` - For AI content generation
- Vercel KV automatically configured for rate limiting/token tracking

## Security Considerations

The application implements multiple security layers:
- IP-based rate limiting (50 requests/day)
- Request origin validation for production
- User-agent filtering to block bots
- Honeypot fields for bot detection
- Input validation and sanitization
- File size/content limits for uploads
