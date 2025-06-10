// Codeforces API types with runtime validation helpers

export interface CodeforcesUser {
  handle: string
  email?: string
  vkId?: string
  openId?: string
  firstName?: string
  lastName?: string
  country?: string
  city?: string
  organization?: string
  contribution?: number
  rank?: string
  rating?: number
  maxRank?: string
  maxRating?: number
  lastOnlineTimeSeconds?: number
  registrationTimeSeconds?: number
  friendOfCount?: number
  avatar?: string
  titlePhoto?: string
}

export interface CodeforcesResponse {
  status: string
  result?: CodeforcesUser[]
  comment?: string
}

export interface Submission {
  id: number
  contestId?: number
  creationTimeSeconds: number
  relativeTimeSeconds: number
  problem: {
    contestId?: number
    index: string
    name: string
    type: string
    rating?: number
    tags: string[]
  }
  author: {
    contestId?: number
    members: Array<{ handle: string }>
    participantType: string
    ghost: boolean
    room?: number
    startTimeSeconds?: number
  }
  programmingLanguage: string
  verdict?: string
  testset: string
  passedTestCount: number
  timeConsumedMillis: number
  memoryConsumedBytes: number
}

export interface RatingDistribution {
  [key: string]: number
}

// Runtime validation helpers
export function isCodeforcesResponse(data: any): data is CodeforcesResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.status === 'string' &&
    (data.result === undefined || Array.isArray(data.result))
  )
}

export function isCodeforcesUser(data: any): data is CodeforcesUser {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.handle === 'string'
  )
}

export function isSubmissionArray(data: any): data is Submission[] {
  return Array.isArray(data) && data.every(item => 
    typeof item === 'object' &&
    item !== null &&
    typeof item.id === 'number' &&
    typeof item.problem === 'object' &&
    item.problem !== null &&
    typeof item.problem.name === 'string'
  )
}