import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AppNotification, NotificationKind } from '@/types'

export interface NotificationsState {
  items: AppNotification[]
  /** Notification keys already raised, so reminders are not repeated each session. */
  emitted: string[]
}

const initialState: NotificationsState = { items: [], emitted: [] }

const MAX_ITEMS = 80

let counter = 0

export interface PushInput {
  kind: NotificationKind
  title: string
  body: string
  link?: string
  /** Stable identity used to suppress duplicates, e.g. `due_soon:loan-abc:3`. */
  dedupeKey?: string
  at?: string
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    push: {
      reducer(state, action: PayloadAction<AppNotification & { dedupeKey?: string }>) {
        const { dedupeKey, ...notification } = action.payload
        if (dedupeKey) {
          if (state.emitted.includes(dedupeKey)) return
          state.emitted.push(dedupeKey)
          if (state.emitted.length > 400) state.emitted.splice(0, state.emitted.length - 400)
        }
        state.items.unshift(notification)
        if (state.items.length > MAX_ITEMS) state.items.length = MAX_ITEMS
      },
      prepare(input: PushInput) {
        counter += 1
        return {
          payload: {
            id: `n-${Date.now().toString(36)}-${counter.toString(36)}`,
            kind: input.kind,
            title: input.title,
            body: input.body,
            link: input.link,
            at: input.at ?? new Date().toISOString(),
            read: false,
            dedupeKey: input.dedupeKey,
          },
        }
      },
    },
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload)
      if (item) item.read = true
    },
    markAllRead(state) {
      state.items.forEach((n) => {
        n.read = true
      })
    },
    dismiss(state, action: PayloadAction<string>) {
      state.items = state.items.filter((n) => n.id !== action.payload)
    },
    clearAll(state) {
      state.items = []
    },
  },
})

export const { push, markRead, markAllRead, dismiss, clearAll } = notificationsSlice.actions
export default notificationsSlice.reducer
