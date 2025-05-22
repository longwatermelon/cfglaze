'use client'

import { useState } from 'react'

interface CodeforcesData {
  handle: string
  rating?: number
  maxRating?: number
  rank?: string
  maxRank?: string
  contribution?: number
  friendOfCount?: number
  avatar?: string
  titlePhoto?: string
}

export default function Home() {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [userData, setUserData] = useState<CodeforcesData | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    setLoading(true)
    setError('')
    setResult('')
    setUserData(null)

    try {
      const response = await fetch('/api/glaze-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setResult(data.glaze)
      setUserData(data.userData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            🏆 Codeforces Profile Glazer
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Enter your Codeforces username and let AI praise your incredible coding skills!
          </p>
        </div>

        <div className="bg-dark-card border border-dark-border rounded-2xl card-shadow p-8 mb-8 transition-all duration-300 hover:card-shadow-hover hover:bg-dark-cardHover">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Codeforces Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-white placeholder-gray-500"
                placeholder="Enter your Codeforces handle..."
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold text-lg transition-all duration-200 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating amazing praise...
                </span>
              ) : (
                'Glaze Me'
              )}
            </button>
          </form>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-6 py-4 rounded-lg mb-8 backdrop-blur-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {userData && result && (
          <div className="bg-dark-card border border-dark-border rounded-2xl card-shadow p-8 transition-all duration-300 hover:card-shadow-hover">
            <div className="flex items-center mb-6">
              {userData.avatar && (
                <img 
                  src={userData.avatar} 
                  alt="Avatar" 
                  className="w-16 h-16 rounded-full mr-4 ring-2 ring-purple-500/30"
                />
              )}
              <div>
                <h2 className="text-2xl font-bold text-white">{userData.handle}</h2>
                {userData.rating && (
                  <div className="text-lg text-gray-300">
                    Rating: <span className="font-semibold text-purple-400">{userData.rating}</span>
                    {userData.maxRating && userData.maxRating !== userData.rating && (
                      <span className="ml-2 text-sm text-gray-400">(Max: {userData.maxRating})</span>
                    )}
                  </div>
                )}
                {userData.rank && (
                  <div className="text-sm text-gray-400 capitalize">{userData.rank}</div>
                )}
              </div>
            </div>
            
            <div className="prose prose-lg max-w-none">
              <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 p-6 rounded-lg border-l-4 border-yellow-500 backdrop-blur-sm">
                <h3 className="text-xl font-bold text-yellow-300 mb-4 flex items-center">
                  Profile Evaluation
                </h3>
                <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {result}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 