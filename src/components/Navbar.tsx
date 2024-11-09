'use client';

import { truncateAddress } from '@/lib/utils';

interface NavbarProps {
  address: string;
}

export default function Navbar({ address }: NavbarProps) {
  return (
    <nav className="bg-white shadow-md px-4 py-3 flex items-center justify-between">
      <div className="text-xl font-bold">AO-CHAT</div>
      <div className="text-sm text-gray-600">
        {truncateAddress(address)}
      </div>
    </nav>
  );
} 