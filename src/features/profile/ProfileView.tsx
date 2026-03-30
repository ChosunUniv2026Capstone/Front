import type { FormEventHandler } from 'react'

import type { Device, LoginUser } from '../../api.js'

type ProfileViewProps = {
  currentUser: LoginUser
  deviceManagementEnabled: boolean
  label: string
  macAddress: string
  devices: Device[]
  onLabelChange: (value: string) => void
  onMacAddressChange: (value: string) => void
  onRegisterDevice: FormEventHandler<HTMLFormElement>
  onDeleteDevice: (deviceId: number) => void
}

export function ProfileView({
  currentUser,
  deviceManagementEnabled,
  label,
  macAddress,
  devices,
  onLabelChange,
  onMacAddressChange,
  onRegisterDevice,
  onDeleteDevice,
}: ProfileViewProps) {
  return (
    <section className="grid grid--devices profile-surface">
      <article className="panel surface-panel">
        <header className="panel-header">
          <h2>Profile</h2>
          <p>계정 정보와 역할 요약입니다.</p>
        </header>
        <div className="stack profile-surface__fields">
          <label>
            Name
            <input value={currentUser.name} disabled />
          </label>
          <label>
            Role
            <input value={currentUser.role} disabled />
          </label>
          <label>
            Login ID
            <input value={currentUser.login_id} disabled />
          </label>
        </div>
      </article>

      <article className="panel panel--wide surface-panel">
        <header className="panel-header">
          <h2>Register Device</h2>
          <p>학생 프로필에서 단말 등록과 관리를 수행합니다.</p>
        </header>
        {deviceManagementEnabled ? (
          <form className="stack" onSubmit={onRegisterDevice}>
            <label>
              Label
              <input value={label} onChange={(event) => onLabelChange(event.target.value)} placeholder="Dev Laptop" />
            </label>
            <label>
              MAC Address
              <input
                value={macAddress}
                onChange={(event) => onMacAddressChange(event.target.value)}
                placeholder="36:68:99:4f:01:db"
              />
            </label>
            <button type="submit">기기 등록</button>
          </form>
        ) : (
          <p className="empty">학생 계정에서만 단말 관리가 활성화됩니다.</p>
        )}
      </article>

      <article className="panel panel--wide surface-panel">
        <header className="panel-header">
          <h2>Registered Devices</h2>
          <p>현재 등록된 단말 목록입니다.</p>
        </header>
        {deviceManagementEnabled ? (
          <div className="device-list">
            {devices.length === 0 ? (
              <p className="empty">등록된 단말이 없습니다.</p>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="device-card">
                  <div>
                    <p className="device-label">{device.label}</p>
                    <code>{device.mac_address}</code>
                  </div>
                  <div className="device-actions">
                    <span className={`status-tag status-tag--${device.status}`}>{device.status}</span>
                    <button type="button" className="danger-button" onClick={() => onDeleteDevice(device.id)}>
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="empty">학생 프로필에서만 단말 목록이 표시됩니다.</p>
        )}
      </article>
    </section>
  )
}
