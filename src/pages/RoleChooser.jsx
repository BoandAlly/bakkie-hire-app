import { VehicleSilhouette } from '../data/vehicleClasses.jsx'
import Icon from '../components/Icon.jsx'

// First screen. Which side of the marketplace are you on?

export default function RoleChooser({ onPick }) {
  return (
    <div className="onboard">
      <div className="onboard-inner">
        <div className="logo">
          <Icon name="truck" size={26} />
        </div>
        <h1>Bakkie Hire</h1>
        <p className="onboard-tag">Moving something, or moving it for someone else?</p>

        <div className="rolelist">
          <button className="rolecard" onClick={() => onPick('customer')}>
            <span className="rolecard-art">
              <VehicleSilhouette classId="bakkie-one" />
            </span>
            <span className="rolecard-body">
              <strong>I need a vehicle</strong>
              <em>Find one nearby and message the owner. No sign-up.</em>
            </span>
            <Icon name="chevron" size={19} className="dim" />
          </button>

          <button className="rolecard" onClick={() => onPick('driver')}>
            <span className="rolecard-art">
              <VehicleSilhouette classId="truck-small" />
            </span>
            <span className="rolecard-body">
              <strong>I have a vehicle</strong>
              <em>List it, set your rate, get work. Sign in with your email.</em>
            </span>
            <Icon name="chevron" size={19} className="dim" />
          </button>
        </div>
      </div>
    </div>
  )
}
