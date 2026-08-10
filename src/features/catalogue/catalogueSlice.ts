import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { debug } from '@/services/debug'
import { api, ApiError, type SearchParams, type SearchResult } from '@/services/api'
import type { Resource, ResourceType, TrendingEntry } from '@/types'

export interface Filters {
  types: ResourceType[]
  subjects: string[]
  availableOnly: boolean
  repositoryOnly: boolean
  sort: NonNullable<SearchParams['sort']>
}

export interface CatalogueState {
  query: string
  filters: Filters
  results: Resource[]
  total: number
  page: number
  facets: SearchResult['facets']
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  /**
   * The search currently awaited. Responses that do not carry this id are
   * stale — a slower earlier query must never overwrite a newer one.
   */
  requestId: string | null
  /** Records already fetched, so detail views open instantly and work offline. */
  cache: Record<string, Resource>
  recentlyViewed: string[]
  saved: string[]
  trending: TrendingEntry[]
  recentSearches: string[]
}

export const EMPTY_FILTERS: Filters = {
  types: [],
  subjects: [],
  availableOnly: false,
  repositoryOnly: false,
  sort: 'relevance',
}

const initialState: CatalogueState = {
  query: '',
  filters: EMPTY_FILTERS,
  results: [],
  total: 0,
  page: 1,
  facets: { types: [], subjects: [] },
  status: 'idle',
  error: null,
  requestId: null,
  cache: {},
  recentlyViewed: [],
  saved: [],
  trending: [],
  recentSearches: [],
}

export const runSearch = createAsyncThunk<
  SearchResult,
  { page?: number } | undefined,
  { state: { catalogue: CatalogueState }; rejectValue: string }
>('catalogue/search', async (arg, { getState, rejectWithValue }) => {
  const { query, filters } = getState().catalogue
  try {
    return await api.search({
      query,
      types: filters.types,
      subjects: filters.subjects,
      availableOnly: filters.availableOnly,
      repositoryOnly: filters.repositoryOnly,
      sort: filters.sort,
      page: arg?.page ?? 1,
      pageSize: 10,
    })
  } catch (error) {
    return rejectWithValue(
      error instanceof ApiError ? error.message : 'Search is unavailable right now. Try again shortly.',
    )
  }
})

export const loadResource = createAsyncThunk<Resource | undefined, string, { rejectValue: string }>(
  'catalogue/loadResource',
  async (id, { rejectWithValue }) => {
    try {
      return await api.getResource(id)
    } catch (error) {
      return rejectWithValue(
        error instanceof ApiError ? error.message : 'That record could not be loaded.',
      )
    }
  },
)

export const loadTrending = createAsyncThunk<TrendingEntry[], string | undefined>(
  'catalogue/loadTrending',
  async (department) => api.getTrending(department).catch(() => []),
)

const catalogueSlice = createSlice({
  name: 'catalogue',
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload
    },
    setFilters(state, action: PayloadAction<Partial<Filters>>) {
      state.filters = { ...state.filters, ...action.payload }
    },
    toggleType(state, action: PayloadAction<ResourceType>) {
      const types = state.filters.types
      state.filters.types = types.includes(action.payload)
        ? types.filter((t) => t !== action.payload)
        : [...types, action.payload]
    },
    toggleSubject(state, action: PayloadAction<string>) {
      const subjects = state.filters.subjects
      state.filters.subjects = subjects.includes(action.payload)
        ? subjects.filter((s) => s !== action.payload)
        : [...subjects, action.payload]
    },
    clearFilters(state) {
      state.filters = EMPTY_FILTERS
    },
    rememberSearch(state, action: PayloadAction<string>) {
      const term = action.payload.trim()
      if (!term) return
      state.recentSearches = [term, ...state.recentSearches.filter((s) => s !== term)].slice(0, 6)
    },
    clearRecentSearches(state) {
      state.recentSearches = []
    },
    toggleSaved(state, action: PayloadAction<string>) {
      state.saved = state.saved.includes(action.payload)
        ? state.saved.filter((id) => id !== action.payload)
        : [action.payload, ...state.saved].slice(0, 60)
    },
    cacheResources(state, action: PayloadAction<Resource[]>) {
      for (const resource of action.payload) state.cache[resource.id] = resource
    },
    /**
     * Replace a record wherever it is currently on screen.
     *
     * Unlike `cacheResources` this also rewrites the open result list: after a
     * checkout the availability count has changed, and a search page still
     * showing "1 of 4 available" for a title with none left is how a user ends
     * up tapping Borrow and being refused.
     */
    applyResourceUpdate(state, action: PayloadAction<Resource[]>) {
      for (const resource of action.payload) {
        state.cache[resource.id] = resource
        state.results = state.results.map((item) => (item.id === resource.id ? resource : item))
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(runSearch.pending, (state, action) => {
        state.status = 'loading'
        state.error = null
        state.requestId = action.meta.requestId
      })
      .addCase(runSearch.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          // The one line that explains "I searched for X and got Y".
          debug('search', 'discarded a stale answer', {
            arrived: action.meta.requestId,
            awaiting: state.requestId,
          })
          return
        }
        state.requestId = null
        state.status = 'ready'
        state.results = action.payload.items
        state.total = action.payload.total
        state.page = action.payload.page
        state.facets = action.payload.facets
        for (const resource of action.payload.items) state.cache[resource.id] = resource
      })
      .addCase(runSearch.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) {
          // The one line that explains "I searched for X and got Y".
          debug('search', 'discarded a stale answer', {
            arrived: action.meta.requestId,
            awaiting: state.requestId,
          })
          return
        }
        state.requestId = null
        state.status = 'error'
        state.error = action.payload ?? 'Search failed.'
      })
      .addCase(loadResource.fulfilled, (state, action) => {
        const resource = action.payload
        if (!resource) return
        state.cache[resource.id] = resource
        state.recentlyViewed = [resource.id, ...state.recentlyViewed.filter((id) => id !== resource.id)].slice(
          0,
          12,
        )
      })
      .addCase(loadTrending.fulfilled, (state, action) => {
        state.trending = action.payload
      })
  },
})

export const {
  setQuery,
  setFilters,
  toggleType,
  toggleSubject,
  clearFilters,
  rememberSearch,
  clearRecentSearches,
  toggleSaved,
  cacheResources,
  applyResourceUpdate,
} = catalogueSlice.actions

export default catalogueSlice.reducer
