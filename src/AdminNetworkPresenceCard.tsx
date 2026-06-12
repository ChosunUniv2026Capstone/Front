import type {
  AdminPresenceAccessPoint,
  AdminPresenceSnapshot,
  AdminPresenceStation,
  Classroom,
  ClassroomNetwork,
} from './api'
import { formatJson } from './api'

type SnapshotSource = 'live' | 'demo'

type AdminNetworkPresenceCardProps = {
  readonly classroom: Classroom
  readonly classroomNetworks: readonly ClassroomNetwork[]
  readonly liveSnapshot?: AdminPresenceSnapshot
  readonly demoSnapshot?: AdminPresenceSnapshot
  readonly isExpanded: boolean
  readonly isLiveLoading: boolean
  readonly isDemoLoading: boolean
  readonly isAutoRefreshEnabled: boolean
  readonly formatDateTime: (value?: string | null) => string
  readonly onToggle: (classroomCode: string) => void
  readonly onRefreshLive: (classroomCode: string) => void
  readonly onRefreshDemo: (classroomCode: string) => void
  readonly onToggleAutoRefresh: (classroomCode: string) => void
  readonly onToggleDemoApEnabled: (classroomCode: string, enabled: boolean) => void
}

type SnapshotPanel = {
  readonly source: SnapshotSource
  readonly label: string
  readonly snapshot?: AdminPresenceSnapshot
  readonly isLoading: boolean
}

const AP_SOURCE_LABEL: Record<SnapshotSource, string> = {
  live: '실제 AP',
  demo: 'Demo AP',
}

function countStations(snapshot?: AdminPresenceSnapshot) {
  return snapshot?.aps.reduce((total, ap) => total + ap.stations.length, 0) ?? 0
}

function renderPresenceStation(station: AdminPresenceStation) {
  return (
    <article key={`${station.macAddress}-${station.ownerLoginId ?? 'guest'}`} className="entity-row">
      <div>
        <p className="entity-title">{station.ownerName ?? station.deviceLabel ?? station.macAddress}</p>
        <p className="entity-subtitle">
          {station.ownerLoginId ?? '미등록'} · {station.deviceLabel ?? '단말명 없음'} · {station.macAddress}
        </p>
      </div>
      <span className={`badge${station.associated ? '' : ' badge--muted'}`}>
        {station.associated ? '연결됨' : '연결 끊김'}
      </span>
    </article>
  )
}

function renderAccessPoint(ap: AdminPresenceAccessPoint, source: SnapshotSource) {
  return (
    <div key={`${source}-${ap.apId}`} className={`admin-ap-panel admin-ap-panel--${source}`}>
      <div className="helper-row">
        <strong>{AP_SOURCE_LABEL[source]} · {ap.apId}</strong>
        <span>{ap.ssid} · 단말 {ap.stations.length}대</span>
      </div>
      <div className="entity-list">
        {ap.stations.length ? (
          ap.stations.map(renderPresenceStation)
        ) : (
          <p className="empty-state">현재 관측된 단말이 없습니다.</p>
        )}
      </div>
    </div>
  )
}

function renderSnapshotPanel(panel: SnapshotPanel, formatDateTime: (value?: string | null) => string) {
  const { source, label, snapshot, isLoading } = panel

  if (isLoading && !snapshot) {
    return (
      <div key={source} className={`admin-presence-source admin-presence-source--${source}`}>
        <div className="helper-row admin-presence-source-head">
          <strong>{label}</strong>
          <span>snapshot 로딩 중</span>
        </div>
        <p className="empty-state">현재 연결 단말을 불러오는 중입니다.</p>
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div key={source} className={`admin-presence-source admin-presence-source--${source}`}>
        <div className="helper-row admin-presence-source-head">
          <strong>{label}</strong>
          <span>아직 조회 전</span>
        </div>
        <p className="empty-state">{label} snapshot 을 아직 불러오지 않았습니다.</p>
      </div>
    )
  }

  return (
    <div key={source} className={`admin-presence-source admin-presence-source--${source}`}>
      <div className="helper-row admin-presence-source-head">
        <strong>{label}</strong>
        <span>{snapshot.collectionMode ?? 'snapshot'} · AP {snapshot.aps.length} · 단말 {countStations(snapshot)}</span>
      </div>
      <div className="helper-list admin-presence-meta">
        <div className="helper-row">
          <strong>관측 시각</strong>
          <span>{formatDateTime(snapshot.observedAt)}</span>
        </div>
        <div className="helper-row">
          <strong>Threshold</strong>
          <span>
            {snapshot.classroomNetworks.map((network) => `${network.ap_id} ${network.signal_threshold_dbm ?? -65} dBm`).join(' · ')}
          </span>
        </div>
      </div>
      <div className="admin-presence-ap-list">
        {snapshot.aps.length ? (
          snapshot.aps.map((ap) => renderAccessPoint(ap, source))
        ) : (
          <p className="empty-state">{label} 에서 현재 관측된 AP 가 없습니다.</p>
        )}
      </div>
    </div>
  )
}

export function AdminNetworkPresenceCard({
  classroom,
  classroomNetworks,
  liveSnapshot,
  demoSnapshot,
  isExpanded,
  isLiveLoading,
  isDemoLoading,
  isAutoRefreshEnabled,
  formatDateTime,
  onToggle,
  onRefreshLive,
  onRefreshDemo,
  onToggleAutoRefresh,
  onToggleDemoApEnabled,
}: AdminNetworkPresenceCardProps) {
  const stationCount = countStations(liveSnapshot) + countStations(demoSnapshot)
  const demoEnabled = countStations(demoSnapshot) > 0
  const snapshotSummary = liveSnapshot || demoSnapshot
    ? `실제 AP ${liveSnapshot?.aps.length ?? 0} · Demo AP ${demoSnapshot?.aps.length ?? 0} · 단말 ${stationCount}`
    : `AP ${classroomNetworks.length}`
  const panels: readonly SnapshotPanel[] = [
    { source: 'live', label: '실제 AP snapshot', snapshot: liveSnapshot, isLoading: isLiveLoading },
    { source: 'demo', label: 'Demo AP snapshot', snapshot: demoSnapshot, isLoading: isDemoLoading },
  ]

  return (
    <article className={`admin-card${isExpanded ? ' admin-card--selected' : ''}`}>
      <div className="admin-card-head">
        <button
          type="button"
          className="admin-card-selector"
          onClick={() => onToggle(classroom.classroom_code)}
          aria-expanded={isExpanded}
        >
          <span className="entity-title">{classroom.classroom_code}</span>
          <span className="entity-subtitle">
            {classroom.name} · {classroom.building ?? '-'} / {classroom.floor_label ?? '-'}
          </span>
        </button>
        <span className="info-chip">{snapshotSummary}</span>
      </div>
      <div className="admin-card-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onRefreshLive(classroom.classroom_code)}
          disabled={isLiveLoading}
        >
          {isLiveLoading ? '실제 새로고침 중...' : '실제 새로고침'}
        </button>
        <button
          type="button"
          className={isAutoRefreshEnabled ? 'secondary-button is-active' : 'secondary-button'}
          onClick={() => onToggleAutoRefresh(classroom.classroom_code)}
        >
          10초 자동 {isAutoRefreshEnabled ? '끄기' : '켜기'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onRefreshDemo(classroom.classroom_code)}
          disabled={isDemoLoading}
        >
          {isDemoLoading ? 'Demo 새로고침 중...' : 'Demo 새로고침'}
        </button>
        <button
          type="button"
          className={demoEnabled ? 'secondary-button is-active' : 'secondary-button'}
          onClick={() => onToggleDemoApEnabled(classroom.classroom_code, !demoEnabled)}
          disabled={isDemoLoading}
        >
          데모 AP 전체 {demoEnabled ? 'OFF' : 'ON'}
        </button>
      </div>
      {!isExpanded ? (
        <p className="empty-state">강의실을 클릭하면 실제 AP 와 Demo AP snapshot 을 한 목록으로 불러옵니다.</p>
      ) : liveSnapshot || demoSnapshot || isLiveLoading || isDemoLoading ? (
        <div className="helper-list admin-presence-tree">
          {panels.map((panel) => renderSnapshotPanel(panel, formatDateTime))}
        </div>
      ) : (
        <pre>{formatJson(classroomNetworks)}</pre>
      )}
    </article>
  )
}
