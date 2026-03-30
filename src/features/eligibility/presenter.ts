export type PresentEligibilityTone = 'success' | 'warning' | 'danger'

export type PresentEligibilityInput = {
  eligible: boolean
  reasonCode: string
}

export type PresentEligibility = {
  tone: PresentEligibilityTone
  badgeLabel: string
  title: string
  body: string
}

const badgeLabelByTone: Record<PresentEligibilityTone, string> = {
  success: '확인됨',
  warning: '주의',
  danger: '제한됨',
}

const presentationByReasonCode: Record<
  string,
  Omit<PresentEligibility, 'badgeLabel'>
> = {
  OK: {
    tone: 'success',
    title: '출석 또는 시험 접근이 가능합니다.',
    body: '현재 단말과 강의실 조건이 확인되었습니다.',
  },
  DEVICE_NOT_REGISTERED: {
    tone: 'warning',
    title: '등록된 단말이 필요합니다.',
    body: '프로필에서 단말을 등록한 뒤 다시 확인하세요.',
  },
  NETWORK_NOT_ELIGIBLE: {
    tone: 'danger',
    title: '현재 네트워크에서는 확인할 수 없습니다.',
    body: '수업 강의실 네트워크 연결 상태를 점검하세요.',
  },
}

const fallbackPresentation: Omit<PresentEligibility, 'badgeLabel'> = {
  tone: 'warning',
  title: '추가 확인이 필요합니다.',
  body: '아래 reason code 와 evidence 를 확인하세요.',
}

export function presentEligibility(input: PresentEligibilityInput): PresentEligibility {
  const presentation =
    presentationByReasonCode[input.reasonCode] ??
    (input.eligible
      ? presentationByReasonCode.OK
      : fallbackPresentation)

  return {
    ...presentation,
    badgeLabel: badgeLabelByTone[presentation.tone],
  }
}
