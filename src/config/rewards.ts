/**
 * What XP can be spent on.
 *
 * Costs are library policy, not engineering: change them here and the whole
 * app follows — the rewards screen, the affordability checks and the server's
 * copy of the catalogue all read from this shape.
 */

export type RewardKind = 'loan_slot' | 'print_credit' | 'loan_extension' | 'room_priority'

export interface Reward {
  id: string
  name: string
  /** One line explaining what the member actually gets. */
  description: string
  /** What desk staff need to do when the voucher is presented. */
  fulfilment: string
  cost: number
  kind: RewardKind
  /** Days the voucher stays valid after it is issued. */
  validForDays: number
}

export const REWARDS: Reward[] = [
  {
    id: 'loan-slot',
    name: 'Extra loan slot',
    description: 'Borrow one item beyond your normal limit for 30 days.',
    fulfilment: 'Desk staff raise the borrower’s loan limit by one for 30 days.',
    cost: 500,
    kind: 'loan_slot',
    validForDays: 30,
  },
  {
    id: 'print-20',
    name: '20 sheets of printing',
    description: 'Print or photocopy 20 pages at the Digital Commons.',
    fulfilment: 'Add 20 sheets to the borrower’s print quota.',
    cost: 300,
    kind: 'print_credit',
    validForDays: 60,
  },
  {
    id: 'loan-extension',
    name: 'Seven extra days',
    description: 'Add a week to one item you already have on loan.',
    fulfilment: 'Extend the due date on the named loan by seven days.',
    cost: 200,
    kind: 'loan_extension',
    validForDays: 14,
  },
  {
    id: 'room-priority',
    name: 'Priority room booking',
    description: 'Reserve a discussion room up to two weeks ahead instead of one.',
    fulfilment: 'Allow a booking outside the standard window.',
    cost: 400,
    kind: 'room_priority',
    validForDays: 30,
  },
]

export function rewardById(id: string): Reward | undefined {
  return REWARDS.find((reward) => reward.id === id)
}

/** Cheapest reward, used to tell someone how close they are to spending. */
export const CHEAPEST_REWARD = REWARDS.reduce((low, reward) =>
  reward.cost < low.cost ? reward : low,
)
