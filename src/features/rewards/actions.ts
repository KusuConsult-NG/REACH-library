import type { AppDispatch, RootState } from '@/app/store'
import type { Reward } from '@/config/rewards'
import { push } from '@/features/notifications/notificationsSlice'
import { toast } from '@/features/ui/uiSlice'
import { spend } from '@/features/xp/xpSlice'
import { formatDate } from '@/utils/date'
import { issue, markShared } from './rewardsSlice'

/**
 * Buy a reward.
 *
 * The balance is checked and debited in the same tick as the voucher is
 * issued, so a double tap cannot spend twice — there is no await in between
 * for a second click to slip through.
 */
export function redeemReward(reward: Reward) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const { balance } = getState().xp

    if (balance < reward.cost) {
      dispatch(
        toast(`You need ${(reward.cost - balance).toLocaleString()} more XP for that reward.`, 'error'),
      )
      return false
    }

    dispatch(spend(reward.cost))
    dispatch(
      issue({
        rewardId: reward.id,
        name: reward.name,
        cost: reward.cost,
        validForDays: reward.validForDays,
      }),
    )

    const voucher = getState().rewards.vouchers[0]
    dispatch(toast(`${reward.name} redeemed — voucher ${voucher.code}`, 'success'))
    dispatch(
      push({
        kind: 'announcement',
        title: `Voucher issued: ${reward.name}`,
        body: `Show code ${voucher.code} at the circulation desk before ${formatDate(voucher.expiresAt)}.`,
        link: '/rewards',
      }),
    )
    return true
  }
}

/**
 * Hand a voucher to someone else.
 *
 * Uses the platform share sheet where there is one and falls back to the
 * clipboard. Nothing moves between accounts: the code is the bearer token, so
 * sharing it is the transfer.
 */
export function shareVoucher(voucherId: string) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const voucher = getState().rewards.vouchers.find((v) => v.id === voucherId)
    if (!voucher) return

    const text = `REACH voucher — ${voucher.name}\nCode: ${voucher.code}\nValid until ${formatDate(
      voucher.expiresAt,
    )}. Present it at the University of Jos Library circulation desk.`

    try {
      if (navigator.share) {
        await navigator.share({ title: `REACH voucher: ${voucher.name}`, text })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        dispatch(toast('Voucher copied — paste it to whoever you are giving it to.', 'success'))
      } else {
        dispatch(toast(`Voucher code: ${voucher.code}`, 'info'))
      }
      dispatch(markShared(voucherId))
    } catch {
      // A cancelled share sheet is not a failure worth reporting.
    }
  }
}
