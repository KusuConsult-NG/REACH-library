import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { FEED_SEED, FOLLOW_SUGGESTIONS } from '@/services/api/seed'
import type { FeedItem, FollowedUser } from '@/types'

export interface SocialState {
  following: string[]
  suggestions: FollowedUser[]
  /**
   * The activity feed is deliberately de-identified: entries name a cohort
   * ("a postgraduate in Law"), never a person. Reading habits are sensitive,
   * so the feed shows what is popular without exposing who read what.
   */
  feed: FeedItem[]
}

const now = Date.now()

const initialState: SocialState = {
  following: [],
  suggestions: FOLLOW_SUGGESTIONS,
  feed: FEED_SEED.map((item, index) => ({
    ...item,
    at: new Date(now - (index + 1) * 37 * 60 * 1000).toISOString(),
  })),
}

const socialSlice = createSlice({
  name: 'social',
  initialState,
  reducers: {
    toggleFollow(state, action: PayloadAction<string>) {
      state.following = state.following.includes(action.payload)
        ? state.following.filter((id) => id !== action.payload)
        : [...state.following, action.payload]
    },
    addFeedItem(state, action: PayloadAction<FeedItem>) {
      state.feed = [action.payload, ...state.feed].slice(0, 40)
    },
  },
})

export const { toggleFollow, addFeedItem } = socialSlice.actions
export default socialSlice.reducer
