import { FAQS } from '@/services/api/seed'
import { Accordion } from '@/components/primitives'

const FLOORS = [
  {
    name: 'Level 1',
    zones: ['Entrance & security', 'Circulation desk', 'Agriculture', 'Education wing', 'Discussion rooms A–B', 'Reserve collection', 'Newspapers', 'Lockers'],
    key: ['Circulation desk', 'Discussion rooms A–B'],
  },
  {
    name: 'Level 2',
    zones: ['Health Sciences', 'Management', 'Silent carrels', 'Digital Commons', 'Photocopy', 'Serials', 'Reference', 'Staff office'],
    key: ['Digital Commons', 'Silent carrels'],
  },
  {
    name: 'Level 3',
    zones: ['Sciences', 'Engineering', 'Postgraduate room', 'Special collections', 'Africana', 'Map room', 'Bindery', 'Archives'],
    key: ['Postgraduate room', 'Special collections'],
  },
]

export function MapScreen() {
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <p className="small muted">
        Main Library, Bauchi Road Campus. Call numbers on each record tell you the level and the sequence to
        follow along the shelves.
      </p>

      {FLOORS.map((floor) => (
        <section key={floor.name} aria-labelledby={`floor-${floor.name}`}>
          <div className="section__head">
            <h2 id={`floor-${floor.name}`}>{floor.name}</h2>
          </div>
          <div className="card">
            <div className="floor">
              {floor.zones.map((zone) => (
                <div
                  key={zone}
                  className={floor.key.includes(zone) ? 'floor__zone floor__zone--key' : 'floor__zone'}
                >
                  {zone}
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section aria-labelledby="finding-heading">
        <div className="section__head">
          <h2 id="finding-heading">Finding a book</h2>
        </div>
        <div className="card">
          <Accordion
            question="How do I read a call number?"
            answer="Read it in parts: the letters first (QD before QP), then the number as a whole number, then the decimal, then the author cutter and year. Shelf labels at the end of each range show the span it holds."
          />
          <Accordion
            question="The shelf is empty — where is the book?"
            answer="It may be in use in the reading room, awaiting reshelving, or on the trolley at the end of the range. Ask at the circulation desk, or place a hold in REACH and we will retrieve it for you."
          />
          <Accordion question={FAQS[0].question} answer={FAQS[0].answer} />
        </div>
      </section>
    </div>
  )
}
