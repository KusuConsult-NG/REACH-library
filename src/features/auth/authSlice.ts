import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api, ApiError } from '@/services/api'
import type { NotificationPrefs, PrivacySettings, User } from '@/types'

export interface AuthState {
  user: User | null
  token: string | null
  status: 'idle' | 'authenticating' | 'authenticated' | 'error'
  error: string | null
  /** Cleared once the user has been through the welcome carousel. */
  onboarded: boolean
  privacy: PrivacySettings
  notifications: NotificationPrefs
}

export const DEFAULT_PRIVACY: PrivacySettings = {
  // Sharing is opt-in: a library's borrowing record is sensitive by default.
  profileVisible: true,
  shareActivity: false,
}

export const DEFAULT_NOTIFICATIONS: NotificationPrefs = {
  dueDateReminders: true,
  newResourceAlerts: true,
  xpMilestones: true,
  libraryAnnouncements: true,
  returnConfirmations: true,
  interests: [],
}

const initialState: AuthState = {
  user: null,
  token: null,
  status: 'idle',
  error: null,
  onboarded: false,
  privacy: DEFAULT_PRIVACY,
  notifications: DEFAULT_NOTIFICATIONS,
}

export const login = createAsyncThunk<
  { user: User; token: string },
  { username: string; password: string },
  { rejectValue: string }
>('auth/login', async ({ username, password }, { rejectWithValue }) => {
  try {
    const session = await api.login(username, password)
    return { user: session.user, token: session.token }
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'Sign-in failed. Check your connection and try again.'
    return rejectWithValue(message)
  }
})

export const logout = createAsyncThunk('auth/logout', async () => {
  await api.logout()
})

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null
    },
    completeOnboarding(state) {
      state.onboarded = true
    },
    setPrivacy(state, action: PayloadAction<Partial<PrivacySettings>>) {
      state.privacy = { ...state.privacy, ...action.payload }
    },
    setNotificationPrefs(state, action: PayloadAction<Partial<NotificationPrefs>>) {
      state.notifications = { ...state.notifications, ...action.payload }
    },
    toggleInterest(state, action: PayloadAction<string>) {
      const interests = state.notifications.interests
      state.notifications.interests = interests.includes(action.payload)
        ? interests.filter((i) => i !== action.payload)
        : [...interests, action.payload]
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = 'authenticating'
        state.error = null
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'authenticated'
        state.user = action.payload.user
        state.token = action.payload.token
        state.error = null
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'error'
        state.error = action.payload ?? 'Sign-in failed.'
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null
        state.token = null
        state.status = 'idle'
      })
  },
})

export const { clearError, completeOnboarding, setPrivacy, setNotificationPrefs, toggleInterest } =
  authSlice.actions

export default authSlice.reducer
