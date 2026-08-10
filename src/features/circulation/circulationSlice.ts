import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api, ApiError } from '@/services/api'
import { applyResourceUpdate } from '@/features/catalogue/catalogueSlice'
import type { ConsultationRequest, Hold, Loan, Resource, SpaceBooking, StudySpace } from '@/types'

export interface CirculationState {
  loans: Loan[]
  holds: Hold[]
  spaces: StudySpace[]
  bookings: SpaceBooking[]
  consultations: ConsultationRequest[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Id of the record currently being acted on, so only its button spins. */
  busyId: string | null
  error: string | null
}

const initialState: CirculationState = {
  loans: [],
  holds: [],
  spaces: [],
  bookings: [],
  consultations: [],
  status: 'idle',
  busyId: null,
  error: null,
}

function message(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * Re-read a record after a transaction that changed its availability.
 *
 * Issuing or returning a copy changes the shelf count that every screen shows.
 * Doing this inside the circulation thunks rather than at each call site means
 * the profile screen's "Mark returned" and the resource page's Borrow both keep
 * the catalogue honest without either of them having to remember to.
 */
async function refreshAvailability(
  dispatch: (action: { type: string; payload: Resource[] }) => void,
  resourceId: string | undefined,
) {
  if (!resourceId) return
  try {
    const fresh = await api.getResource(resourceId)
    if (fresh) dispatch(applyResourceUpdate([fresh]))
  } catch {
    // A stale count beats a failed transaction; the next load corrects it.
  }
}

export const loadCirculation = createAsyncThunk('circulation/load', async () => {
  const [loans, holds, spaces, bookings] = await Promise.all([
    api.getLoans(),
    api.getHolds(),
    api.getSpaces(),
    api.getBookings(),
  ])
  return { loans, holds, spaces, bookings }
})

export const checkoutResource = createAsyncThunk<Loan, string, { rejectValue: string }>(
  'circulation/checkout',
  async (resourceId, { rejectWithValue, dispatch }) => {
    try {
      const loan = await api.checkout(resourceId)
      await refreshAvailability(dispatch, resourceId)
      return loan
    } catch (error) {
      // A refusal is usually "somebody else took the last copy", so re-read the
      // record too: the button the user just pressed should not still say the
      // item is available.
      await refreshAvailability(dispatch, resourceId)
      return rejectWithValue(message(error, 'The item could not be issued. Please try again.'))
    }
  },
)

export const renewLoan = createAsyncThunk<Loan, string, { rejectValue: string }>(
  'circulation/renew',
  async (loanId, { rejectWithValue }) => {
    try {
      return await api.renew(loanId)
    } catch (error) {
      return rejectWithValue(message(error, 'The renewal could not be completed.'))
    }
  },
)

export const returnLoan = createAsyncThunk<Loan, string, { rejectValue: string }>(
  'circulation/return',
  async (loanId, { rejectWithValue, dispatch }) => {
    try {
      const returned = await api.returnLoan(loanId)
      await refreshAvailability(dispatch, returned.resourceId)
      return returned
    } catch (error) {
      return rejectWithValue(message(error, 'The return could not be recorded.'))
    }
  },
)

export const placeHold = createAsyncThunk<Hold, string, { rejectValue: string }>(
  'circulation/placeHold',
  async (resourceId, { rejectWithValue, dispatch }) => {
    try {
      const hold = await api.placeHold(resourceId)
      await refreshAvailability(dispatch, resourceId)
      return hold
    } catch (error) {
      return rejectWithValue(message(error, 'The hold could not be placed.'))
    }
  },
)

export const cancelHold = createAsyncThunk<
  string,
  string,
  { rejectValue: string; state: { circulation: CirculationState } }
>(
  'circulation/cancelHold',
  async (holdId, { rejectWithValue, dispatch, getState }) => {
    // Read the record id before the hold is gone from state.
    const resourceId = getState().circulation.holds.find((hold) => hold.id === holdId)?.resourceId
    try {
      await api.cancelHold(holdId)
      await refreshAvailability(dispatch, resourceId)
      return holdId
    } catch (error) {
      return rejectWithValue(message(error, 'The hold could not be cancelled.'))
    }
  },
)

export const bookSpace = createAsyncThunk<
  SpaceBooking,
  { spaceId: string; date: string; slot: string },
  { rejectValue: string }
>('circulation/bookSpace', async ({ spaceId, date, slot }, { rejectWithValue }) => {
  try {
    return await api.bookSpace(spaceId, date, slot)
  } catch (error) {
    return rejectWithValue(message(error, 'The booking could not be made.'))
  }
})

export const cancelBooking = createAsyncThunk<string, string, { rejectValue: string }>(
  'circulation/cancelBooking',
  async (bookingId, { rejectWithValue }) => {
    try {
      await api.cancelBooking(bookingId)
      return bookingId
    } catch (error) {
      return rejectWithValue(message(error, 'The booking could not be cancelled.'))
    }
  },
)

export const requestConsultation = createAsyncThunk<
  ConsultationRequest,
  Omit<ConsultationRequest, 'id' | 'submittedAt' | 'status'>,
  { rejectValue: string }
>('circulation/requestConsultation', async (input, { rejectWithValue }) => {
  try {
    return await api.requestConsultation(input)
  } catch (error) {
    return rejectWithValue(message(error, 'Your request could not be sent.'))
  }
})

const circulationSlice = createSlice({
  name: 'circulation',
  initialState,
  reducers: {
    setBusy(state, action: PayloadAction<string | null>) {
      state.busyId = action.payload
    },
    clearError(state) {
      state.error = null
    },
    /** Locally extend a due date for a renewal queued while offline. */
    applyOfflineRenewal(state, action: PayloadAction<{ loanId: string; dueAt: string }>) {
      const loan = state.loans.find((l) => l.id === action.payload.loanId)
      if (!loan) return
      loan.dueAt = action.payload.dueAt
      loan.renewals += 1
      loan.status = 'active'
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCirculation.pending, (state) => {
        state.status = 'loading'
      })
      .addCase(loadCirculation.fulfilled, (state, action) => {
        state.status = 'ready'
        state.loans = action.payload.loans
        state.holds = action.payload.holds
        state.spaces = action.payload.spaces
        state.bookings = action.payload.bookings
      })
      .addCase(loadCirculation.rejected, (state) => {
        // Keep whatever was persisted; the cached record is still useful offline.
        state.status = 'error'
      })
      .addCase(checkoutResource.fulfilled, (state, action) => {
        state.loans = [action.payload, ...state.loans.filter((l) => l.id !== action.payload.id)]
        state.holds = state.holds.filter((h) => h.resourceId !== action.payload.resourceId)
        state.busyId = null
      })
      .addCase(renewLoan.fulfilled, (state, action) => {
        state.loans = state.loans.map((l) => (l.id === action.payload.id ? action.payload : l))
        state.busyId = null
      })
      .addCase(returnLoan.fulfilled, (state, action) => {
        state.loans = state.loans.map((l) => (l.id === action.payload.id ? action.payload : l))
        state.busyId = null
      })
      .addCase(placeHold.fulfilled, (state, action) => {
        state.holds = [action.payload, ...state.holds]
        state.busyId = null
      })
      .addCase(cancelHold.fulfilled, (state, action) => {
        state.holds = state.holds.filter((h) => h.id !== action.payload)
        state.busyId = null
      })
      .addCase(bookSpace.fulfilled, (state, action) => {
        state.bookings = [action.payload, ...state.bookings]
        const space = state.spaces.find((s) => s.id === action.payload.spaceId)
        if (space && action.payload.date === new Date().toISOString().slice(0, 10)) {
          space.bookedSlots = [...space.bookedSlots, action.payload.slot]
        }
        state.busyId = null
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        const removed = state.bookings.find((b) => b.id === action.payload)
        state.bookings = state.bookings.filter((b) => b.id !== action.payload)
        if (removed) {
          const space = state.spaces.find((s) => s.id === removed.spaceId)
          if (space) space.bookedSlots = space.bookedSlots.filter((slot) => slot !== removed.slot)
        }
        state.busyId = null
      })
      .addCase(requestConsultation.fulfilled, (state, action) => {
        state.consultations = [action.payload, ...state.consultations]
        state.busyId = null
      })
      .addMatcher(
        (action): action is { type: string; payload?: string } => action.type.endsWith('/rejected'),
        (state, action) => {
          if (!action.type.startsWith('circulation/')) return
          state.busyId = null
          state.error = typeof action.payload === 'string' ? action.payload : state.error
        },
      )
  },
})

export const { setBusy, clearError, applyOfflineRenewal } = circulationSlice.actions
export default circulationSlice.reducer
