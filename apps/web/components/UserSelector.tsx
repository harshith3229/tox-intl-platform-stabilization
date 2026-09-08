import type { DemoUser } from '@/lib/api';

type Props = {
  value: DemoUser;
  onChange: (user: DemoUser) => void;
};

export function UserSelector({ value, onChange }: Props) {
  return (
    <label className="userSelector">
      Demo identity
      <select value={value} onChange={(event) => onChange(event.target.value as DemoUser)}>
        <option value="alice">Alice - Northwind Finance</option>
        <option value="bob">Bob - Contoso Operations</option>
      </select>
    </label>
  );
}
