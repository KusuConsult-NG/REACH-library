import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Toast {
  id: string
  message: string
  tone: 'success' | 'error' | 'info' | 'xp'
  /** XP amount to render as a badge on reward toasts. */
  xp?: number
}

/** A mutation captured while offline, replayed in order on reconnection. */
export type QueuedOpInput =
  | { kind: 'renew'; loanId: string }
  | { kind: 'return'; loanId: string }
  | { kind: 'hold'; resourceId: string }

export type QueuedOp = QueuedOpInput & { id: string; at: string }

export interface UiState {
  online: boolean
  theme: 'system' | 'light' | 'dark'
  toasts: Toast[]
  queue: QueuedOp[]
  syncing: boolean
  /** Set when the browser offers an install prompt we have stashed. */
  installAvailable: boolean
}

export const uiInitialState: UiState = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  theme: 'system',
  toasts: [],
  queue: [],
  syncing: false,
  installAvailable: false,
}

let counter = 0

const uiSlice = createSlice({
  name: 'ui',
  initialState: uiInitialState,
  reducers: {
    setOnline(state, action: PayloadAction<boolean>) {
      state.online = action.payload
    },
    setTheme(state, action: PayloadAction<UiState['theme']>) {
      state.theme = action.payload
    },
    setInstallAvailable(state, action: PayloadAction<boolean>) {
      state.installAvailable = action.payload
    },
    toast: {
      reducer(state, action: PayloadAction<Toast>) {
        state.toasts = [...state.toasts.slice(-2), action.payload]
      },
      prepare(message: string, tone: Toast['tone'] = 'info', xp?: number) {
        counter += 1
        return { payload: { id: `t-${counter}-${Date.now().toString(36)}`, message, tone, xp } }
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload)
    },
    enqueue: {
      reducer(state, action: PayloadAction<QueuedOp>) {
        state.queue.push(action.payload)
      },
      prepare(op: QueuedOpInput, at?: string) {
        counter += 1
        return {
          payload: {
            ...op,
            id: `q-${counter}-${Date.now().toString(36)}`,
            at: at ?? new Date().toISOString(),
          } as QueuedOp,
        }
      },
    },
    dequeue(state, action: PayloadAction<string>) {
      state.queue = state.queue.filter((op) => op.id !== action.payload)
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.syncing = action.payload
    },
  },
})

export const {
  setOnline,
  setTheme,
  setInstallAvailable,
  toast,
  dismissToast,
  enqueue,
  dequeue,
  setSyncing,
} = uiSlice.actions

export default uiSlice.reducer
