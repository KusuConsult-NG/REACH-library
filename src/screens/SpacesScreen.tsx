import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { bookSpace, cancelBooking, setBusy } from '@/features/circulation/circulationSlice'
import { toast } from '@/features/ui/uiSlice'
import { EmptyState, Sheet, Spinner } from '@/components/primitives'
import { CalendarIcon } from '@/components/icons'
import { BOOKING_SLOTS } from '@/services/api/seed'
import { formatDate } from '@/utils/date'
import type { StudySpace } from '@/types'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

/** Dates offered for booking: today plus the next six days. */
function bookableDates() {
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date()
    date.setDate(date.getDate() + offset)
    return date.toISOString().slice(0, 10)
  })
}

export function SpacesScreen() {
  const dispatch = useAppDispatch()
  const { spaces, bookings, busyId } = useAppSelector((state) => state.circulation)
  const online = useAppSelector((state) => state.ui.online)

  const [selected, setSelected] = useState<StudySpace | null>(null)
  const [date, setDate] = useState(todayIso())
  const [slot, setSlot] = useState<string | null>(null)

  const dates = bookableDates()

  async function confirm() {
    if (!selected || !slot) return
    dispatch(setBusy(selected.id))
    const action = await dispatch(bookSpace({ spaceId: selected.id, date, slot }))
    if (bookSpace.fulfilled.match(action)) {
      dispatch(toast(`${selected.name} booked for ${slot} on ${formatDate(date)}.`, 'success'))
      setSelected(null)
      setSlot(null)
    } else {
      dispatch(toast(action.payload ?? 'The booking could not be made.', 'error'))
    }
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      {bookings.length > 0 ? (
        <section aria-labelledby="my-bookings">
          <div className="section__head">
            <h2 id="my-bookings">Your bookings</h2>
          </div>
          <ul className="stack stack--tight">
            {bookings.map((booking) => (
              <li key={booking.id} className="card">
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontWeight: 650 }}>{booking.spaceName}</p>
                    <p className="small muted">
                      {formatDate(booking.date)} at {booking.slot}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    disabled={busyId === booking.id}
                    onClick={() => {
                      dispatch(setBusy(booking.id))
                      void dispatch(cancelBooking(booking.id))
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="spaces-heading">
        <div className="section__head">
          <h2 id="spaces-heading">Available spaces</h2>
        </div>

        {spaces.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<CalendarIcon size={28} />}
              title="Space availability unavailable"
              body="Reconnect to load today's room availability."
            />
          </div>
        ) : (
          <ul className="stack stack--tight">
            {spaces.map((space) => {
              const free = BOOKING_SLOTS.filter((s) => !space.bookedSlots.includes(s)).length
              return (
                <li key={space.id} className="card">
                  <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 650 }}>{space.name}</p>
                      <p className="small muted">
                        {space.floor} · seats {space.capacity}
                      </p>
                      <div className="resource__tags">
                        {space.amenities.map((amenity) => (
                          <span key={amenity} className="tag">
                            {amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={free > 0 ? 'tag tag--available' : 'tag tag--out'}>
                      {free > 0 ? `${free} slots free` : 'Fully booked'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    style={{ marginTop: 'var(--space-3)' }}
                    disabled={!online || free === 0}
                    onClick={() => {
                      setSelected(space)
                      setSlot(null)
                    }}
                  >
                    {online ? 'Book this space' : 'Booking needs a connection'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {selected ? (
        <Sheet
          title={`Book ${selected.name}`}
          onClose={() => setSelected(null)}
          footer={
            <button type="button" className="btn btn--block" disabled={!slot || busyId === selected.id} onClick={() => void confirm()}>
              {busyId === selected.id ? <Spinner label="Booking" /> : null}
              {slot ? `Confirm ${slot} on ${formatDate(date)}` : 'Choose a time'}
            </button>
          }
        >
          <div className="stack">
            <div className="field">
              <label className="field__label" htmlFor="booking-date">
                Date
              </label>
              <select
                id="booking-date"
                className="select"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value)
                  setSlot(null)
                }}
              >
                {dates.map((value) => (
                  <option key={value} value={value}>
                    {formatDate(value)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <h3 style={{ marginBottom: 'var(--space-2)' }}>Time</h3>
              <div className="slotgrid">
                {BOOKING_SLOTS.map((value) => {
                  const taken = date === todayIso() && selected.bookedSlots.includes(value)
                  return (
                    <button
                      key={value}
                      type="button"
                      className="slot"
                      aria-pressed={slot === value}
                      disabled={taken}
                      onClick={() => setSlot(value)}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
              <p className="field__hint" style={{ marginTop: 'var(--space-2)' }}>
                Each booking lasts one hour. Please arrive within 15 minutes or the slot is released.
              </p>
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  )
}
