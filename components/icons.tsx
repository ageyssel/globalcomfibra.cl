import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement> & { size?: number | string };

function BaseIcon({ size = 24, children, ...props }: Props & { children?: React.ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>{children ?? <><circle cx="12" cy="12" r="9"/><path d="M8 12h8M12 8v8"/></>}</svg>;
}

const make = (path: React.ReactNode) => function Icon(props: Props) { return <BaseIcon {...props}>{path}</BaseIcon>; };
export const ArrowRight = make(<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>);
export const CheckCircle2 = make(<><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>);
export const Menu = make(<><path d="M4 6h16M4 12h16M4 18h16"/></>);
export const X = make(<><path d="m6 6 12 12M18 6 6 18"/></>);
export const Search = make(<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>);
export const Download = make(<><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 20h14"/></>);
export const ExternalLink = make(<><path d="M14 5h5v5M19 5l-9 9"/><path d="M16 13v6H5V8h6"/></>);
export const Plus = make(<><path d="M12 5v14M5 12h14"/></>);
export const Pencil = make(<><path d="m4 20 4-1 10-10-3-3L5 16l-1 4Z"/><path d="m13 7 3 3"/></>);
export const RefreshCw = make(<><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.5 8a7 7 0 0 1 11.5-1l2 5M17.5 16A7 7 0 0 1 6 17l-2-5"/></>);
export const Send = make(<><path d="m3 3 18 9-18 9 4-9-4-9Z"/><path d="M7 12h14"/></>);
export const Eye = make(<><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>);
export const EyeOff = make(<><path d="m3 3 18 18"/><path d="M10.5 6.2A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-2.1 2.6M6.6 6.6C3.8 8.4 2 12 2 12s4 6 10 6a9 9 0 0 0 3.4-.6"/></>);
export const LoaderCircle = make(<><path d="M21 12a9 9 0 1 1-6.2-8.6"/></>);
export const AlertTriangle = make(<><path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v4M12 17h.01"/></>);
export const LogOut = make(<><path d="M10 5H5v14h5"/><path d="M13 8l4 4-4 4M17 12H9"/></>);
export const LockKeyhole = make(<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></>);
export const Wifi = make(<><path d="M4 9a12 12 0 0 1 16 0M7 13a8 8 0 0 1 10 0M10 17a4 4 0 0 1 4 0"/><circle cx="12" cy="20" r=".5" fill="currentColor"/></>);
export const Building2 = make(<><path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M2 21h20"/></>);
export const Headphones = make(<><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><path d="M4 14h3v6H5a1 1 0 0 1-1-1v-5ZM20 14h-3v6h2a1 1 0 0 0 1-1v-5Z"/></>);
export const CircleDollarSign = make(<><circle cx="12" cy="12" r="9"/><path d="M16 8h-5a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H8M12 6v12"/></>);
export const WalletCards = make(<><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M16 12h5M5 6l2-3 11 3"/></>);
export const FileText = make(<><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>);
export const FilePlus2 = make(<><path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h5M12 12v6M9 15h6"/></>);
export const ReceiptText = FileText;
export const History = make(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>);
export const LayoutDashboard = make(<><rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="15" width="7" height="6" rx="1"/></>);
export const MessageSquare = make(<><path d="M4 4h16v12H8l-4 4V4Z"/></>);
export const MessageSquarePlus = make(<><path d="M4 4h16v12H8l-4 4V4Z"/><path d="M12 7v6M9 10h6"/></>);
export const Store = make(<><path d="M4 10v11h16V10M3 4h18l-2 6H5L3 4Z"/><path d="M9 21v-6h6v6"/></>);
export const CalendarDays = make(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h.01M12 14h.01M17 14h.01M7 18h.01M12 18h.01"/></>);
export const Activity = make(<><path d="M3 12h4l2-6 4 12 2-6h6"/></>);
export const Cable = make(<><path d="M7 3v5M17 3v5M5 8h4v4a3 3 0 0 0 6 0V8h4M12 15v6"/></>);
export const Clock3 = make(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></>);
export const Gauge = make(<><path d="M4 18a9 9 0 1 1 16 0"/><path d="m12 14 4-5"/><path d="M7 18h10"/></>);
export const Network = make(<><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/></>);
export const RadioTower = make(<><path d="M12 10v11M9 21h6M8 6a6 6 0 0 0 0 8M16 6a6 6 0 0 1 0 8M5 3a10 10 0 0 0 0 14M19 3a10 10 0 0 1 0 14"/></>);
export const Server = make(<><rect x="4" y="3" width="16" height="7" rx="2"/><rect x="4" y="14" width="16" height="7" rx="2"/><path d="M8 6h.01M8 17h.01M12 6h5M12 17h5"/></>);
export const ShieldCheck = make(<><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="m8 12 2.5 2.5L16 9"/></>);
