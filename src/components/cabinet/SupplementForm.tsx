import { useState, useEffect } from 'react'
import type { Supplement, ActiveIngredient, Schedule, TimingSlot, UnitType } from '../../schema/types'
import { Modal } from '../shared/Modal'
import { useStore } from '../../store'

type Props = { open: boolean; supplement?: Supplement | null; onClose: () => void }

type IngRow = { name: string; form: string; amount: string; unit: UnitType; source: string; brand: string }
type ScheduleKind = 'daily' | 'weekdays_lv' | 'fixed_interval' | 'as_needed' | 'custom_weekdays'

const DAYS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

function toSchedule(kind: ScheduleKind, intervalDays: string, alertDays: string, customDays: number[]): Schedule {
  if (kind === 'daily') return { kind: 'weekdays', days: [0,1,2,3,4,5,6] }
  if (kind === 'weekdays_lv') return { kind: 'weekdays', days: [0,1,2,3,4] }
  if (kind === 'custom_weekdays') return { kind: 'weekdays', days: customDays }
  if (kind === 'fixed_interval') return {
    kind: 'fixed_interval',
    intervalDays: parseInt(intervalDays) || 7,
    alertDaysBefore: parseInt(alertDays) || 2,
  }
  return { kind: 'as_needed' }
}

function fromSchedule(s: Schedule): { kind: ScheduleKind; intervalDays: string; alertDays: string; customDays: number[] } {
  if (s.kind === 'as_needed') return { kind: 'as_needed', intervalDays: '7', alertDays: '2', customDays: [] }
  if (s.kind === 'fixed_interval') return { kind: 'fixed_interval', intervalDays: String(s.intervalDays), alertDays: String(s.alertDaysBefore), customDays: [] }
  const { days } = s
  if (days.length === 7) return { kind: 'daily', intervalDays: '7', alertDays: '2', customDays: days }
  if (days.length === 5 && days.every((d, i) => d === i)) return { kind: 'weekdays_lv', intervalDays: '7', alertDays: '2', customDays: days }
  return { kind: 'custom_weekdays', intervalDays: '7', alertDays: '2', customDays: days }
}

export function SupplementForm({ open, supplement, onClose }: Props) {
  const add = useStore(s => s.addSupplement)
  const update = useStore(s => s.updateSupplement)
  const isEdit = !!supplement

  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState<Supplement['category']>('supplement')
  const [description, setDescription] = useState('')
  const [form, setForm] = useState('')
  const [presentation, setPresentation] = useState('')
  const [ingredients, setIngredients] = useState<IngRow[]>([{ name:'', form:'', amount:'', unit:'mg', source:'', brand:'' }])
  const [excipients, setExcipients] = useState('')
  const [benefits, setBenefits] = useState('')
  const [instructions, setInstructions] = useState('')
  const [warnings, setWarnings] = useState('')
  const [certifications, setCertifications] = useState('')
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>('daily')
  const [intervalDays, setIntervalDays] = useState('7')
  const [alertDays, setAlertDays] = useState('2')
  const [customDays, setCustomDays] = useState<number[]>([0,1,2,3,4])
  const [defaultDose, setDefaultDose] = useState('1')
  const [doseUnit, setDoseUnit] = useState('cáps')
  const [doseStep, setDoseStep] = useState('1')
  const [timing, setTiming] = useState<TimingSlot | 'null'>('morning')

  useEffect(() => {
    if (!open) return
    if (supplement) {
      setName(supplement.name)
      setBrand(supplement.brand ?? '')
      setCategory(supplement.category)
      setDescription(supplement.description)
      setForm(supplement.form)
      setPresentation(supplement.presentation ?? '')
      setIngredients(supplement.activeIngredients.length > 0
        ? supplement.activeIngredients.map(i => ({ name: i.name, form: i.form, amount: String(i.amount), unit: i.unit, source: i.source ?? '', brand: i.brand ?? '' }))
        : [{ name:'', form:'', amount:'', unit:'mg', source:'', brand:'' }])
      setExcipients(supplement.excipients ?? '')
      setBenefits(supplement.benefits ?? '')
      setInstructions(supplement.instructions)
      setWarnings(supplement.warnings ?? '')
      setCertifications(supplement.certifications.join(', '))
      const sch = fromSchedule(supplement.schedule)
      setScheduleKind(sch.kind)
      setIntervalDays(sch.intervalDays)
      setAlertDays(sch.alertDays)
      setCustomDays(sch.customDays)
      setDefaultDose(String(supplement.defaultDose))
      setDoseUnit(supplement.doseUnit)
      setDoseStep(String(supplement.doseStep))
      setTiming(supplement.timing ?? 'null')
    } else {
      setName(''); setBrand(''); setCategory('supplement'); setDescription('')
      setForm(''); setPresentation('')
      setIngredients([{ name:'', form:'', amount:'', unit:'mg', source:'', brand:'' }])
      setExcipients(''); setBenefits(''); setInstructions(''); setWarnings(''); setCertifications('')
      setScheduleKind('daily'); setIntervalDays('7'); setAlertDays('2'); setCustomDays([0,1,2,3,4])
      setDefaultDose('1'); setDoseUnit('cáps'); setDoseStep('1'); setTiming('morning')
    }
  }, [open, supplement])

  const updateIng = (i: number, field: keyof IngRow, value: string) =>
    setIngredients(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const handleSubmit = () => {
    if (!name.trim()) return
    const activeIngredients: ActiveIngredient[] = ingredients
      .filter(r => r.name.trim() && r.amount)
      .map(r => ({
        name: r.name.trim(), form: r.form.trim(), amount: parseFloat(r.amount),
        unit: r.unit, source: r.source.trim() || undefined, brand: r.brand.trim() || undefined,
      }))
    const data = {
      name: name.trim(), brand: brand.trim() || undefined, category,
      description, form, presentation: presentation || undefined,
      activeIngredients, excipients: excipients || undefined,
      benefits: benefits || undefined, instructions, warnings: warnings || undefined,
      certifications: certifications.split(',').map(c => c.trim()).filter(Boolean),
      schedule: toSchedule(scheduleKind, intervalDays, alertDays, customDays),
      defaultDose: parseFloat(defaultDose) || 1,
      doseUnit, doseStep: parseFloat(doseStep) || 1,
      timing: timing === 'null' ? null : timing as TimingSlot,
    }
    if (isEdit && supplement) {
      update(supplement.id, data)
    } else {
      add(data)
    }
    onClose()
  }

  const field = (label: string, el: React.ReactNode) => (
    <div>
      <label className="block text-slate-400 text-xs uppercase tracking-wide mb-1">{label}</label>
      {el}
    </div>
  )
  const inp = (value: string, onChange: (v: string) => void, placeholder = '') => (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500" />
  )
  const textarea = (value: string, onChange: (v: string) => void, rows = 2) => (
    <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows}
      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-sky-500 resize-none" />
  )
  const sel = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[]) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar suplemento' : 'Nuevo suplemento'}>
      <div className="space-y-4">

        {field('Nombre *', inp(name, setName, 'NOW Mega D3 & MK-7'))}
        {field('Marca', inp(brand, setBrand, 'NOW Foods'))}
        {field('Categoría', sel(category, v => setCategory(v as Supplement['category']), [
          { value:'supplement', label:'Suplemento' }, { value:'medication', label:'Medicamento' },
          { value:'vitamin', label:'Vitamina' }, { value:'mineral', label:'Mineral' },
          { value:'hormone', label:'Hormona' }, { value:'adaptogen', label:'Adaptógeno' },
          { value:'herb', label:'Hierba' }, { value:'other', label:'Otro' },
        ]))}
        {field('Descripción', textarea(description, setDescription, 3))}
        {field('Forma farmacéutica', inp(form, setForm, 'Cápsulas vegetarianas'))}
        {field('Presentación', inp(presentation, setPresentation, 'Frasco 60 cáps'))}

        {/* ingredients */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-slate-400 text-xs uppercase tracking-wide">Ingredientes activos</label>
            <button onClick={() => setIngredients(r => [...r, { name:'', form:'', amount:'', unit:'mg', source:'', brand:'' }])}
              className="text-sky-400 text-xs">+ Agregar</button>
          </div>
          {ingredients.map((row, i) => (
            <div key={i} className="bg-slate-900 rounded-lg p-3 mb-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={row.name} onChange={e => updateIng(i,'name',e.target.value)} placeholder="Vitamina D3"
                  className="bg-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none col-span-2" />
                <input value={row.form} onChange={e => updateIng(i,'form',e.target.value)} placeholder="Colecalciferol"
                  className="bg-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none" />
                <input value={row.source} onChange={e => updateIng(i,'source',e.target.value)} placeholder="Fuente (lanolina)"
                  className="bg-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none" />
                <input value={row.amount} onChange={e => updateIng(i,'amount',e.target.value)} placeholder="5000" type="number"
                  className="bg-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none" />
                <select value={row.unit} onChange={e => updateIng(i,'unit',e.target.value as UnitType)}
                  className="bg-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none">
                  {(['IU','mcg','mg','ml','g','caps','custom'] as UnitType[]).map(u => <option key={u}>{u}</option>)}
                </select>
                <input value={row.brand} onChange={e => updateIng(i,'brand',e.target.value)} placeholder="Marca (MenaQ7®)"
                  className="bg-slate-700 text-white rounded px-2 py-1.5 text-xs outline-none col-span-2" />
              </div>
              {ingredients.length > 1 && (
                <button onClick={() => setIngredients(r => r.filter((_,idx) => idx !== i))}
                  className="text-red-400 text-xs">× Eliminar</button>
              )}
            </div>
          ))}
        </div>

        {field('Excipientes', inp(excipients, setExcipients, 'Celulosa microcristalina...'))}
        {field('Beneficios', textarea(benefits, setBenefits))}
        {field('Instrucciones *', inp(instructions, setInstructions, '1 cáp diaria con comida que contenga grasa'))}
        {field('Advertencias', textarea(warnings, setWarnings))}
        {field('Certificaciones (separadas por coma)', inp(certifications, setCertifications, 'Non-GMO, Kosher, GMP'))}

        {/* schedule */}
        <div>
          <label className="block text-slate-400 text-xs uppercase tracking-wide mb-2">Programación</label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              ['daily', 'Diario'],
              ['weekdays_lv', 'Lun–Vie'],
              ['custom_weekdays', 'Días custom'],
              ['fixed_interval', 'Cada N días'],
              ['as_needed', 'A demanda'],
            ] as [ScheduleKind, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setScheduleKind(k)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${scheduleKind === k ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {label}
              </button>
            ))}
          </div>
          {scheduleKind === 'custom_weekdays' && (
            <div className="flex gap-2 flex-wrap mb-2">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => setCustomDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i].sort())}
                  className={`w-10 h-10 rounded-lg text-xs font-bold transition-colors ${customDays.includes(i) ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {d}
                </button>
              ))}
            </div>
          )}
          {scheduleKind === 'fixed_interval' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-500 text-xs">Cada (días)</label>
                <input value={intervalDays} onChange={e => setIntervalDays(e.target.value)} type="number" min="1"
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none mt-1" />
              </div>
              <div>
                <label className="text-slate-500 text-xs">Alerta (días antes)</label>
                <input value={alertDays} onChange={e => setAlertDays(e.target.value)} type="number" min="0"
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none mt-1" />
              </div>
            </div>
          )}
        </div>

        {/* dose */}
        <div className="grid grid-cols-3 gap-2">
          {field('Dosis default', inp(defaultDose, setDefaultDose, '1'))}
          {field('Unidad', inp(doseUnit, setDoseUnit, 'cáps'))}
          {field('Paso +/−', inp(doseStep, setDoseStep, '1'))}
        </div>

        {field('Momento del día', sel(timing, v => setTiming(v as TimingSlot | 'null'), [
          { value:'morning', label:'Mañana' }, { value:'midday', label:'Mediodía' },
          { value:'afternoon', label:'Tarde' }, { value:'evening', label:'Tarde-noche' },
          { value:'night', label:'Noche' }, { value:'null', label:'Sin momento fijo' },
        ]))}

        <button onClick={handleSubmit} disabled={!name.trim()}
          className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold transition-colors mt-2">
          {isEdit ? 'Guardar cambios' : 'Agregar suplemento'}
        </button>
      </div>
    </Modal>
  )
}
