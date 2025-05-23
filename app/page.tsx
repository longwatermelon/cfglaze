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
  const [lastRequestTime, setLastRequestTime] = useState(0)
  const [tokensUsed, setTokensUsed] = useState(0)
  
  // New state for code submission feature
  const [codeFile, setCodeFile] = useState<File | null>(null)
  const [codeContent, setCodeContent] = useState('')
  const [codeGlaze, setCodeGlaze] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeTokensUsed, setCodeTokensUsed] = useState(0)
  const [activeTab, setActiveTab] = useState('profile') // 'profile' or 'code'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return

    // Client-side rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    
    if (timeSinceLastRequest < 20000) { // 20 seconds between requests
      setError('Please wait 20 seconds between requests')
      return
    }

    // Basic input validation
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 1 || trimmedUsername.length > 24) {
      setError('Username must be between 1 and 24 characters')
      return
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      setError('Username can only contain letters, numbers, dots, hyphens, and underscores')
      return
    }

    setLoading(true)
    setError('')
    setResult('')
    setUserData(null)
    setLastRequestTime(now)

    try {
      const response = await fetch('/api/glaze-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          username: trimmedUsername,
          honeypot: '' // Empty honeypot field
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setResult(data.glaze)
      setUserData(data.userData)
      setTokensUsed(data.tokensUsed || 0)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }
  
  // Handle file upload for code submission
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      
      // Basic file size validation
      if (file.size > 1024 * 500) {  // 500 KB max
        setCodeError('File is too large. Maximum size is 500KB.')
        e.target.value = '' // Reset the input
        return
      }
      
      setCodeFile(file)
      
      // Read file content
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result?.toString() || ''
        
        // Check if content is too large
        if (content.length > 50000) {
          setCodeError('Code content is too large. Maximum length is 50,000 characters.')
          setCodeFile(null)
          e.target.value = '' // Reset the input
          return
        }
        
        setCodeContent(content)
      }
      reader.readAsText(file)
    }
  }
  
  // Handle code glazing submission
  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!codeContent) {
      setCodeError('Please upload a code file')
      return
    }
    
    // Client-side rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime
    
    if (timeSinceLastRequest < 20000) { // 20 seconds between requests
      setCodeError('Please wait 20 seconds between requests')
      return
    }
    
    setCodeLoading(true)
    setCodeError('')
    setCodeGlaze('')
    setLastRequestTime(now)
    
    try {
      const response = await fetch('/api/glaze-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          code: codeContent,
          honeypot: '' // Empty honeypot field
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }
      
      setCodeGlaze(data.glaze)
      setCodeTokensUsed(data.tokensUsed || 0)
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setCodeLoading(false)
    }
  }
  
  // Clear code upload fields
  const handleClearCode = () => {
    setCodeFile(null)
    setCodeContent('')
    setCodeGlaze('')
    setCodeError('')
    // Reset any file input by targeting all file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]')
    fileInputs.forEach((input: any) => { input.value = '' })
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            🏆 Codeforces Glazer
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Let AI praise your Codeforces profile and code submissions!
          </p>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-dark-card border border-dark-border rounded-full overflow-hidden">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-2 text-sm font-medium ${activeTab === 'profile' 
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                : 'text-gray-300 hover:text-white'}`}
            >
              Profile Glazer
            </button>
            <button 
              onClick={() => setActiveTab('code')}
              className={`px-6 py-2 text-sm font-medium ${activeTab === 'code' 
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                : 'text-gray-300 hover:text-white'}`}
            >
              Code Glazer
            </button>
          </div>
        </div>

        {/* Profile Glazer Tab */}
        {activeTab === 'profile' && (
          <div className="bg-dark-card border border-dark-border rounded-2xl card-shadow p-8 mb-8 transition-all duration-300 hover:card-shadow-hover hover:bg-dark-cardHover">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Honeypot field - hidden from humans */}
              <input
                type="text"
                name="website"
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />
              
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
                  maxLength={24}
                />
                <p className="text-sm text-gray-400 mt-2">
                  Each IP address can make 4 requests per day
                </p>
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
                  'Glaze My Profile'
                )}
              </button>
            </form>
            
            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-6 py-4 rounded-lg mt-8 backdrop-blur-sm">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {userData && result && (
              <div className="mt-8">
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
                      {tokensUsed > 0 && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          ({tokensUsed} tokens used)
                        </span>
                      )}
                    </h3>
                    <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {result}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Code Glazer Tab */}
        {activeTab === 'code' && (
          <div className="bg-dark-card border border-dark-border rounded-2xl card-shadow p-8 mb-8 transition-all duration-300 hover:card-shadow-hover hover:bg-dark-cardHover">
            <form onSubmit={handleCodeSubmit} className="space-y-6">
              {/* Honeypot field - hidden from humans */}
              <input
                type="text"
                name="website"
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />
              
              <div>
                <label htmlFor="codeFile" className="block text-sm font-medium text-gray-300 mb-2">
                  Upload Your Codeforces Submission
                </label>
                <input
                  type="file"
                  id="codeFile"
                  onChange={handleFileChange}
                  accept=".cpp,.c,.py,.java,.js,.rb,.go,.txt,.cs,.php"
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                  disabled={codeLoading}
                />
                <p className="text-sm text-gray-400 mt-2">
                  Max file size: 500KB. Supported file types: .cpp, .c, .py, .java, .js, .rb, .go, .txt, .cs, .php
                </p>
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={codeLoading || !codeContent}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold text-lg transition-all duration-200 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  {codeLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing code...
                    </span>
                  ) : (
                    'Glaze My Code'
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleClearCode}
                  className="px-6 py-3 rounded-lg font-semibold text-gray-300 border border-gray-700 hover:bg-gray-800 transition-all duration-200"
                >
                  Clear
                </button>
              </div>
              
              <p className="text-sm text-gray-400">
                Each IP address can make 4 requests per day
              </p>
            </form>
            
            {codeError && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-6 py-4 rounded-lg mt-8 backdrop-blur-sm">
                <strong>Error:</strong> {codeError}
              </div>
            )}
            
            {codeFile && codeGlaze && (
              <div className="mt-8">
                <div className="prose prose-lg max-w-none">
                  <div className="bg-gradient-to-r from-green-900/30 to-teal-900/30 p-6 rounded-lg border-l-4 border-green-500 backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-green-300 mb-4 flex items-center">
                      Code Evaluation: {codeFile.name}
                      {codeTokensUsed > 0 && (
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          ({codeTokensUsed} tokens used)
                        </span>
                      )}
                    </h3>
                    <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {codeGlaze}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
} 