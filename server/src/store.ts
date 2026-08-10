import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { IncomingTransfer } from './transfers.js'
import type { Activity, ConsultationRequest, SpaceBooking } from './types.js'

/**
 * Durable store for the data no other system owns: space bookings,
 * consultation requests and the XP ledger. Koha remains the source of truth
 * for everything bibliographic and circulatory.
 *
 * A JSON file is deliberate — this is a few kilobytes per user and a single
 * process. Swap `load`/`persist` for a database when it outgrows that; nothing
 * outside this module knows how it is stored.
 */

export interface StoreShape {
  bookings: SpaceBooking[]
  /** Bookings are keyed by borrower so one user cannot see another's. */
  bookingOwners: Record<string, string>
  consultations: ConsultationRequest[]
  consultationOwners: Record<string, string>
  /** XP ledger per borrower number. */
  activity: Record<string, Activity[]>
  /** ISO weeks whose goal bonus has been paid, per borrower. */
  bonusWeeks: Record<string, string[]>
  /** Rolling access counts per resource, used for trending. */
  accessCounts: Record<string, number>
  /** XP sent but not yet collected, keyed by the recipient's borrower number. */
  inbox: Record<string, IncomingTransfer[]>
  /** XP sent per borrower per ISO week, for the weekly transfer ceiling. */
  sentByWeek: Record<string, number>
}

function empty(): StoreShape {
  return {
    bookings: [],
    bookingOwners: {},
    consultations: [],
    consultationOwners: {},
    activity: {},
    bonusWeeks: {},
    accessCounts: {},
    inbox: {},
    sentByWeek: {},
  }
}

export class Store {
  private state: StoreShape = empty()
  /** Serialises writes so concurrent requests cannot interleave a save. */
  private writing: Promise<void> = Promise.resolve()

  constructor(private readonly file: string | null) {}

  static async open(file: string | null): Promise<Store> {
    const store = new Store(file)
    await store.load()
    return store
  }

  private async load() {
    if (!this.file) return
    try {
      const raw = await readFile(this.file, 'utf8')
      this.state = { ...empty(), ...(JSON.parse(raw) as Partial<StoreShape>) }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`[reach-api] could not read ${this.file}, starting empty:`, error)
      }
      this.state = empty()
    }
  }

  /** Read-only view. Mutate through `update` so the change is persisted. */
  get data(): Readonly<StoreShape> {
    return this.state
  }

  async update<T>(mutate: (state: StoreShape) => T): Promise<T> {
    const result = mutate(this.state)
    await this.persist()
    return result
  }

  private persist(): Promise<void> {
    if (!this.file) return Promise.resolve()

    // Write via a temp file and rename, so a crash mid-write cannot truncate
    // the store — rename is atomic within a filesystem.
    this.writing = this.writing.then(async () => {
      const snapshot = JSON.stringify(this.state)
      await mkdir(dirname(this.file!), { recursive: true })
      const temp = `${this.file}.tmp`
      await writeFile(temp, snapshot, 'utf8')
      await rename(temp, this.file!)
    })
    return this.writing
  }
}
