import { useState } from 'react'
import { PLACES } from '../data/places.js'
import { VEHICLE_CLASSES, classById, VehicleSilhouette } from '../data/vehicleClasses.jsx'
import { RATE_UNITS, rand } from '../lib/pricing.js'
import { formatPhone } from '../lib/session.js'
import Icon from '../components/Icon.jsx'
import { shrinkImage } from '../lib/photos.js'

const BLANK = {
  ownerName: '',
  ownerPhone: '',
  vehicleClass: '',
  title: '',
  photos: [],
  bedLengthM: '',
  bedWidthM: '',
  payloadKg: '',
  features: { canopy: false, tailLift: false, trailer: false, straps: false },
  rateAmount: '',
  rateUnit: 'km',
  calloutFee: '',
  minCharge: '',
  helpersAvailable: 0,
  helperRate: '',
  baseLocation: '',
  serviceRadiusKm: 50,
  roundTrip: false,
  gitInsured: false,
  gitCoverAmount: '',
}

export default function CreateListing({ onSave, onCancel, initial = null, owner = null }) {
  const editing = Boolean(initial)

  // Name and number come off the signed-in profile, so a driver never retypes
  // them and their listings can't drift apart from each other.
  const [form, setForm] = useState(() =>
    initial
      ? { ...initial }
      : { ...BLANK, ownerName: owner?.name ?? '', ownerPhone: owner?.phone ?? '' },
  )

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const setFeature = (key, value) =>
    setForm((f) => ({ ...f, features: { ...f.features, [key]: value } }))

  // Picking a class prefills the usual dimensions — most owners don't know their
  // bed measurements off the top of their head, and a sensible starting number
  // they can correct beats an empty box they'll skip.
  const pickClass = (id) => {
    const c = classById(id)
    set({
      vehicleClass: id,
      bedLengthM: c.typical.bedLengthM,
      bedWidthM: c.typical.bedWidthM,
      payloadKg: c.typical.payloadKg,
    })
  }

  // Photos are shrunk before they are kept. A phone photo held at full size
  // overflows the storage budget, and the failure is silent — the listing looks
  // saved and is gone on next open. See src/lib/photos.js.
  const addPhotos = async (files) => {
    setPhotoError('')
    const room = Math.max(0, 6 - form.photos.length)
    const picked = Array.from(files).slice(0, room)
    if (!picked.length) return

    setAddingPhotos(true)
    const shrunk = []
    let failed = 0
    for (const file of picked) {
      try {
        shrunk.push(await shrinkImage(file))
      } catch {
        failed += 1
      }
    }
    if (shrunk.length) setForm((f) => ({ ...f, photos: [...f.photos, ...shrunk] }))
    if (failed) {
      setPhotoError(
        failed === picked.length
          ? "Couldn't read that picture. Try another one."
          : `${failed} of those pictures couldn't be read — the rest were added.`,
      )
    }
    setAddingPhotos(false)
  }

  const num = (v) => (v === '' || v == null ? 0 : Number(v))

  // The one thing a driver kept hitting: a greyed-out button with no clue what
  // it was waiting on. So we spell out exactly what's still needed, each item
  // pointing back at the numbered section it lives in, and let the button be
  // pressed at any time — pressing it early just surfaces the checklist.
  const missing = [
    !form.vehicleClass && { section: 1, label: 'Choose what you’re driving' },
    !form.title.trim() && { section: 3, label: 'Add a listing headline' },
    !form.baseLocation && { section: 3, label: 'Pick the area you’re based in' },
    !(num(form.rateAmount) > 0) && { section: 4, label: 'Set your rate' },
  ].filter(Boolean)

  const ready = Boolean(form.ownerName && form.ownerPhone) && missing.length === 0
  const [attempted, setAttempted] = useState(false)
  const [addingPhotos, setAddingPhotos] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const submit = () => {
    if (!ready) {
      setAttempted(true)
      // Bring the first unfinished section into view so the fix is one glance away.
      document
        .getElementById(`create-section-${missing[0].section}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    onSave({
      ...form,
      bedLengthM: num(form.bedLengthM),
      bedWidthM: num(form.bedWidthM),
      payloadKg: num(form.payloadKg),
      rateAmount: num(form.rateAmount),
      calloutFee: num(form.calloutFee),
      minCharge: num(form.minCharge),
      helpersAvailable: num(form.helpersAvailable),
      helperRate: num(form.helperRate),
      serviceRadiusKm: num(form.serviceRadiusKm),
      gitCoverAmount: form.gitInsured ? num(form.gitCoverAmount) : 0,
      // Reputation and history survive an edit — they belong to the operator,
      // not to this version of the listing.
      rating: initial?.rating ?? 0,
      jobsCompleted: initial?.jobsCompleted ?? 0,
      verified: initial?.verified ?? false,
      views: initial?.views ?? 0,
      paused: initial?.paused ?? false,
      memberSince: initial?.memberSince ?? new Date().toISOString().slice(0, 7),
    })
  }

  return (
    <div className="create">
      <header className="create-head">
        <h1>{editing ? 'Edit your listing' : 'List your vehicle'}</h1>
        <p>
          {editing
            ? 'Change anything you like — your rating and completed jobs stay with you.'
            : 'You set your own rate — there is no minimum and no maximum, and we take nothing off your jobs. Customers pay you directly.'}
        </p>
        {form.ownerName && (
          <p className="create-as">
            Listing as <strong>{form.ownerName}</strong> · {formatPhone(form.ownerPhone)}
          </p>
        )}
      </header>

      <section className="block" id="create-section-1">
        <h2>1. What are you driving?</h2>
        <div className="classpick">
          {VEHICLE_CLASSES.map((c) => (
            <button
              key={c.id}
              className={form.vehicleClass === c.id ? 'classcard on' : 'classcard'}
              onClick={() => pickClass(c.id)}
            >
              <VehicleSilhouette classId={c.id} />
              <strong>{c.name}</strong>
              <em>{c.examples}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="block">
        <h2>2. Photos</h2>
        <p className="blockhint">
          Take one of the whole vehicle and one looking into the load bed. The load bed
          picture is the one that gets you booked — it's how people decide their fridge fits.
        </p>
        <div className="photorow">
          {form.photos.map((src, i) => (
            <div className="thumb" key={i}>
              <img src={src} alt={`Photo ${i + 1}`} />
              <button
                onClick={() => set({ photos: form.photos.filter((_, j) => j !== i) })}
                aria-label="Remove photo"
              >
                ×
              </button>
            </div>
          ))}
          {form.photos.length < 6 && (
            <label className="thumb add">
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={addingPhotos}
                onChange={(e) => {
                  addPhotos(e.target.files)
                  e.target.value = '' // so the same picture can be picked again
                }}
              />
              <span>{addingPhotos ? 'Adding…' : '+ Add photos'}</span>
            </label>
          )}
        </div>
        {photoError && <p className="blockhint error">{photoError}</p>}
        {form.photos.length >= 6 && (
          <p className="blockhint">That's the six pictures — remove one to swap it out.</p>
        )}
      </section>

      <section className="block" id="create-section-3">
        <h2>3. The details</h2>
        <div className="formgrid">
          <label className="field wide">
            <span>Listing headline</span>
            <input
              value={form.title}
              placeholder="e.g. Toyota Hilux single cab — clean load bed"
              onChange={(e) => set({ title: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Load bed length (m)</span>
            <input
              type="number"
              step="0.1"
              value={form.bedLengthM}
              onChange={(e) => set({ bedLengthM: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Load bed width (m)</span>
            <input
              type="number"
              step="0.1"
              value={form.bedWidthM}
              onChange={(e) => set({ bedWidthM: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Payload (kg)</span>
            <input
              type="number"
              value={form.payloadKg}
              onChange={(e) => set({ payloadKg: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Based in</span>
            <select
              value={form.baseLocation}
              onChange={(e) => set({ baseLocation: e.target.value })}
            >
              <option value="">Choose area</option>
              {PLACES.map((p) => (
                <option key={p.name}>{p.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>How far will you travel? ({form.serviceRadiusKm} km)</span>
            <input
              type="range"
              min="10"
              max="800"
              step="10"
              value={form.serviceRadiusKm}
              onChange={(e) => set({ serviceRadiusKm: e.target.value })}
            />
          </label>
        </div>

        <div className="featurepick">
          {[
            ['canopy', 'Enclosed body / canopy'],
            ['tailLift', 'Tail-lift'],
            ['trailer', 'Trailer'],
            ['straps', 'Straps & blankets'],
          ].map(([key, label]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={form.features[key]}
                onChange={(e) => setFeature(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div className="roundtrip">
          <label className="check">
            <input
              type="checkbox"
              checked={form.roundTrip}
              onChange={(e) => set({ roundTrip: e.target.checked })}
            />
            <span>Willing to take the client back home?</span>
          </label>
          <p className="blockhint">
            Some customers want to ride along with their goods and come back afterwards.
            Tick this and you'll show a <strong>Round trip</strong> badge, so they know
            upfront you'll bring them home — not just drop the load and leave.
          </p>
        </div>
      </section>

      <section className="block" id="create-section-4">
        <h2>4. Your rate</h2>
        <p className="blockhint">
          Charge whatever you want — we don't cap it and we don't take a cut. Pick how you
          want to charge and customers get quoted on that basis.
        </p>

        <div className="ratepick">
          {RATE_UNITS.map((u) => (
            <button
              key={u.id}
              className={form.rateUnit === u.id ? 'rateunit on' : 'rateunit'}
              onClick={() => set({ rateUnit: u.id })}
            >
              <strong>{u.label}</strong>
              <em>{u.id === 'km' ? 'Best for deliveries' : 'Best for house moves'}</em>
            </button>
          ))}
        </div>

        <p className="notice">
          {form.rateUnit === 'km' ? (
            <>
              <strong>Charged on the delivery distance only.</strong> Driving home empty
              afterwards isn't counted, so build your return trip into the rate you set.
            </>
          ) : (
            <>
              <strong>Hours include your trip back.</strong> We estimate loading, the drive
              out, offloading and the drive home — so a job 40 km away is quoted at what it
              really costs you in time.
            </>
          )}
        </p>

        <div className="formgrid">
          <label className="field">
            <span>Rate ({form.rateUnit === 'km' ? 'R per km' : 'R per hour'})</span>
            <input
              type="number"
              value={form.rateAmount}
              onChange={(e) => set({ rateAmount: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Call-out fee (optional)</span>
            <input
              type="number"
              value={form.calloutFee}
              onChange={(e) => set({ calloutFee: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Your minimum charge (optional)</span>
            <input
              type="number"
              value={form.minCharge}
              placeholder="Won't take a job under this"
              onChange={(e) => set({ minCharge: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Helpers you can bring</span>
            <select
              value={form.helpersAvailable}
              onChange={(e) => set({ helpersAvailable: Number(e.target.value) })}
            >
              <option value={0}>None — driver only</option>
              <option value={1}>1 helper</option>
              <option value={2}>2 helpers</option>
            </select>
          </label>

          {form.helpersAvailable > 0 && (
            <label className="field">
              <span>Cost per helper (R)</span>
              <input
                type="number"
                value={form.helperRate}
                onChange={(e) => set({ helperRate: e.target.value })}
              />
            </label>
          )}
        </div>

        {num(form.rateAmount) > 0 && (
          <p className="ratepreview">
            A 20 km job would quote at roughly{' '}
            <strong>
              {rand(
                Math.max(
                  (form.rateUnit === 'km' ? num(form.rateAmount) * 20 : num(form.rateAmount) * 2) +
                    num(form.calloutFee),
                  num(form.minCharge),
                ),
              )}
            </strong>
          </p>
        )}
      </section>

      <section className="block">
        <h2>5. Insurance</h2>
        <p className="blockhint">
          Goods-in-transit cover pays out if a customer's load is damaged or stolen while
          you're carrying it. You don't need it to list — but insured operators show a badge
          and win more of the bigger jobs.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={form.gitInsured}
            onChange={(e) => set({ gitInsured: e.target.checked })}
          />
          <span>I have goods-in-transit cover</span>
        </label>
        {form.gitInsured && (
          <label className="field">
            <span>Cover amount (R)</span>
            <input
              type="number"
              value={form.gitCoverAmount}
              onChange={(e) => set({ gitCoverAmount: e.target.value })}
            />
          </label>
        )}
      </section>

      {attempted && !ready && (
        <div className="needlist">
          <strong>A few things left before you can publish:</strong>
          <ul>
            {missing.map((m) => (
              <li key={m.label}>
                <Icon name="chevron" size={15} />
                {m.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="create-actions">
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" onClick={submit}>
          {editing ? 'Save changes' : 'Publish & set up my profile'}
        </button>
      </div>

      <p className="fineprint center">
        By listing you agree that jobs, prices and payment are arranged directly between you
        and the customer. Bakkie Hire is not a party to that agreement.
      </p>
    </div>
  )
}
