import {
  ChartBar,
  ClockCounterClockwise,
  CloudArrowDown,
  Database,
  Images,
  PencilSimpleLine,
  Pill,
  UsersThree,
} from "@phosphor-icons/react/ssr";
import type { IconName } from "./navigation";

const ICONS = {
  catalog: Pill,
  dashboard: ChartBar,
  products: PencilSimpleLine,
  media: Images,
  masterData: Database,
  import: CloudArrowDown,
  users: UsersThree,
  log: ClockCounterClockwise,
} satisfies Record<IconName, typeof Pill>;

export function ModuleIcon({ name }: { name: IconName }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" />;
}
