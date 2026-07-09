// iOS風トグルスイッチの行
export default function ToggleRow({ label, icon, checked, onChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[15px] text-[#1C1C1E] flex items-center gap-2">
        {icon && <span aria-hidden>{icon}</span>}
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-[51px] h-[31px] rounded-full transition-colors duration-200 flex-shrink-0 ${
          checked ? 'bg-[#34C759]' : 'bg-[#E9E9EA]'
        }`}
      >
        <span
          className={`absolute top-[2px] left-[2px] w-[27px] h-[27px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-200 ${
            checked ? 'translate-x-[20px]' : ''
          }`}
        />
      </button>
    </div>
  )
}
